"use client";

import dynamic from "next/dynamic";

interface MathTextProps {
  readonly text: string;
}

const MathTextRenderer = dynamic(() =>
  import("./MathTextRenderer").then((mod) => ({ default: mod.MathTextRenderer })),
  { ssr: false }
);

/** Fast check — does the text contain LaTeX math delimiters or SVG tags?
 *  Skips currency patterns like $15 — only matches $ not followed by a digit. */
function containsMathOrSvg(text: string): boolean {
  if (text.includes("<svg")) return true;
  return /\$(?!\d)/.test(text);
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

/**
 * Render a plain text line with basic markdown-like formatting:
 * - ## or ### headers → bold text
 * - Lines starting with "- " or "* " → bullet points
 * - **bold** → bold spans
 */
function renderTextLine(line: string): React.ReactNode {
  const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
  if (headerMatch) {
    return (
      <strong className="text-surface-900 dark:text-surface-100">
        {renderInlineFormatting(headerMatch[1])}
      </strong>
    );
  }

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

export function MathText({ text }: MathTextProps) {
  if (!containsMathOrSvg(text)) {
    return (
      <>
        {text.split("\n").map((line, j, arr) => (
          <span key={j}>
            {renderTextLine(line)}
            {j < arr.length - 1 && <br />}
          </span>
        ))}
      </>
    );
  }

  return <MathTextRenderer text={text} />;
}
