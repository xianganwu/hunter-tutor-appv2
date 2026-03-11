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
      // Parse the text before this SVG for LaTeX
      parseMath(text.slice(lastIndex, match.index), parts);
    }
    parts.push({ type: "svg", content: match[1] });
    lastIndex = svgRegex.lastIndex;
  }

  // Remaining text after last SVG (or all text if no SVGs)
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    // If there's an incomplete <svg tag being streamed, treat it as text
    parseMath(remaining, parts);
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

export function MathText({ text }: MathTextProps) {
  const parts = useMemo(() => parseText(text), [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "svg") {
          return (
            <div
              key={i}
              className="my-3 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl [&_svg]:bg-white [&_svg]:dark:bg-surface-800 [&_svg]:p-3 [&_svg]:shadow-sm [&_svg]:border [&_svg]:border-surface-200 [&_svg]:dark:border-surface-700"
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
        // Plain text — preserve newlines
        return (
          <span key={i}>
            {part.content.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}
