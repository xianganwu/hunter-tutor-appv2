"use client";

import { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
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
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
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

export function MathText({ text }: MathTextProps) {
  const parts = useMemo(() => parseText(text), [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "svg") {
          return (
            <div
              key={i}
              className="my-3 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl [&_svg]:bg-white [&_svg]:p-3 [&_svg]:shadow-sm [&_svg]:border [&_svg]:border-surface-200 [&_svg]:dark:border-surface-300"
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
        // Plain text — render lines with basic formatting
        return (
          <span key={i}>
            {part.content.split("\n").map((line, j, arr) => (
              <span key={j}>
                {renderTextLine(line)}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}
