"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathTextRendererProps {
  readonly text: string;
}

type PartType = "text" | "inline-math" | "display-math" | "svg";

interface TextPart {
  readonly type: PartType;
  readonly content: string;
}

/**
 * Sanitize SVG content — strip dangerous elements and attributes.
 * We trust the source (our own Claude API) but defense-in-depth is good practice.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
}

/**
 * Attempt to repair a truncated SVG by closing any open tags and adding </svg>.
 * Returns null if the content doesn't look like SVG.
 */
function repairTruncatedSvg(text: string): string | null {
  const svgStart = text.match(/<svg[^>]*>/i);
  if (!svgStart) return null;

  let repaired = text;

  // Close any obviously open tags (text, tspan, g, etc.)
  const openTags = ["text", "tspan", "g", "a", "defs", "pattern", "clipPath", "mask"];
  for (const tag of openTags) {
    const openCount = (repaired.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length;
    const closeCount = (repaired.match(new RegExp(`</${tag}>`, "gi")) ?? []).length;
    for (let i = closeCount; i < openCount; i++) {
      repaired += `</${tag}>`;
    }
  }

  repaired += "</svg>";
  return repaired;
}

/**
 * Parse text into parts: plain text, LaTeX math, and SVG diagrams.
 * SVG blocks are extracted first, then LaTeX from the remaining text.
 */
function parseText(text: string): TextPart[] {
  const parts: TextPart[] = [];

  // First pass: split out complete <svg>...</svg> blocks
  const svgRegex = /(<svg[\s\S]*?<\/svg>)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = svgRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parseMath(text.slice(lastIndex, match.index), parts);
    }
    parts.push({ type: "svg", content: match[1] });
    lastIndex = svgRegex.lastIndex;
  }

  // Remaining text after last SVG (or all text if no SVGs)
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);

    // Check for truncated SVG (has <svg but no </svg>)
    if (remaining.match(/<svg[^>]*>/i) && !remaining.match(/<\/svg>/i)) {
      // Split at the <svg start
      const svgStartIdx = remaining.search(/<svg[^>]*>/i);
      if (svgStartIdx > 0) {
        parseMath(remaining.slice(0, svgStartIdx), parts);
      }
      const repaired = repairTruncatedSvg(remaining.slice(svgStartIdx));
      if (repaired) {
        parts.push({ type: "svg", content: repaired });
      }
    } else {
      parseMath(remaining, parts);
    }
  }

  return parts;
}

/**
 * Parse a text segment for LaTeX math delimiters and push parts.
 */
function parseMath(text: string, parts: TextPart[]): void {
  // Match LaTeX math delimiters: $$display$$, $digit…operator…$ (e.g. $24 - 6 = 18$),
  // or $non-digit…$ (original). The digit variant requires a math operator so bare
  // currency like $15 is not mistaken for LaTeX.
  const regex = /(\$\$[\s\S]+?\$\$|\$\d[^$\n]*?[+\-×÷=<>^_\\][^$\n]*?\$|\$(?!\d)[^$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("$$")) {
      parts.push({ type: "display-math", content: raw.slice(2, -2) });
    } else {
      parts.push({ type: "inline-math", content: raw.slice(1, -1) });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
}

function renderKatex(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      trust: false,
    });
  } catch {
    return math;
  }
}

/**
 * Render a plain text line with basic markdown-like formatting:
 * - ## or ### headers → bold text
 * - Lines starting with "- " → bullet points
 * - **bold** → bold spans
 */
function renderTextLine(line: string): React.ReactNode {
  // Headers: ## or ###
  const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
  if (headerMatch) {
    return (
      <strong className="text-surface-900 dark:text-surface-100">
        {renderInlineFormatting(headerMatch[1])}
      </strong>
    );
  }

  // Bullet points: "- text"
  const bulletMatch = line.match(/^[-*]\s+(.+)$/);
  if (bulletMatch) {
    return (
      <span className="flex gap-2">
        <span className="text-brand-500 flex-shrink-0">&#x2022;</span>
        <span>{renderInlineFormatting(bulletMatch[1])}</span>
      </span>
    );
  }

  return renderInlineFormatting(line);
}

// ─── Markdown Table Detection & Rendering ────────────────────────────

/**
 * Detect if a block of consecutive lines forms a markdown pipe table.
 * Returns the table rows or null if not a table.
 */
function parseMarkdownTable(
  lines: string[],
  startIdx: number
): { rows: string[][]; endIdx: number } | null {
  // Need at least 2 lines (header + separator or header + data)
  if (startIdx >= lines.length) return null;
  const firstLine = lines[startIdx].trim();
  if (!firstLine.startsWith("|") || !firstLine.endsWith("|")) return null;

  // Collect all consecutive pipe-delimited lines
  const tableLines: string[] = [];
  let idx = startIdx;
  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (!line.startsWith("|")) break;
    tableLines.push(line);
    idx++;
  }

  if (tableLines.length < 2) return null;

  // Parse cells: split by | and trim, ignoring first/last empty from leading/trailing |
  const rows = tableLines
    .filter((line) => !line.match(/^\|[\s-:|]+\|$/)) // skip separator rows like |---|---|
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;

  return { rows, endIdx: idx };
}

function renderTable(rows: string[][]): React.ReactNode {
  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-surface-100 dark:bg-surface-800">
            {header.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold text-surface-700 dark:text-surface-200 border-b border-surface-200 dark:border-surface-700"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr
              key={ri}
              className={
                ri % 2 === 0
                  ? "bg-surface-0 dark:bg-surface-900"
                  : "bg-surface-50 dark:bg-surface-800/50"
              }
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1.5 text-surface-800 dark:text-surface-200 border-b border-surface-100 dark:border-surface-800"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Handle **bold** within a line */
function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MathTextRenderer({ text }: MathTextRendererProps) {
  const parts = useMemo(() => parseText(text), [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "svg") {
          return (
            <div
              key={i}
              className="my-3 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl [&_svg]:bg-white [&_svg]:dark:bg-surface-100 [&_svg]:p-3 [&_svg]:shadow-sm [&_svg]:border [&_svg]:border-surface-200 [&_svg]:dark:border-surface-600"
              dangerouslySetInnerHTML={{
                __html: sanitizeSvg(part.content),
              }}
            />
          );
        }
        if (part.type === "display-math") {
          return (
            <div
              key={i}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: renderKatex(part.content, true),
              }}
            />
          );
        }
        if (part.type === "inline-math") {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{
                __html: renderKatex(part.content, false),
              }}
            />
          );
        }
        // Plain text — render lines with basic formatting and table detection
        {
          const lines = part.content.split("\n");
          const elements: React.ReactNode[] = [];
          let lineIdx = 0;

          while (lineIdx < lines.length) {
            // Check if current line starts a markdown table
            const table = parseMarkdownTable(lines, lineIdx);
            if (table) {
              elements.push(
                <span key={`${i}-table-${lineIdx}`}>{renderTable(table.rows)}</span>
              );
              lineIdx = table.endIdx;
              continue;
            }

            // Regular line
            elements.push(
              <span key={`${i}-${lineIdx}`}>
                {renderTextLine(lines[lineIdx])}
                {lineIdx < lines.length - 1 && <br />}
              </span>
            );
            lineIdx++;
          }

          return <span key={i}>{elements}</span>;
        }
      })}
    </>
  );
}
