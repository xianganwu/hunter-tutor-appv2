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
 *  Detects both $non-digit…$ and $digit…operator…$ patterns.
 *  Bare currency like $15 (digit with no operator) is not matched. */
function containsMathOrSvg(text: string): boolean {
  if (text.includes("<svg")) return true;
  // $non-digit… (original) OR $digit…operator…$ (number-starting math)
  return /\$(?!\d)/.test(text) || /\$\d[^$\n]*?[+\-×÷=<>^_\\]/.test(text);
}

/**
 * Convert plain-text fractions in a non-math segment to LaTeX.
 * Handles mixed numbers ("2 1/4" → "$2\frac{1}{4}$") and
 * simple fractions ("3/8" → "$\frac{3}{8}$").
 * Skips date-like patterns (slash followed by another slash).
 */
function convertFractionsInSegment(segment: string): string {
  // Mixed numbers: "2 1/4", "12 3/8" — whole + space + numerator/denominator
  // (?!\/) prevents matching date-like "1/3/2024"
  segment = segment.replace(
    /\b(\d+)\s+(\d+)\/(\d{1,3})\b(?!\/)/g,
    (_, whole, num, den) => `$${whole}\\frac{${num}}{${den}}$`,
  );

  // Simple fractions: "1/4", "11/8" — not preceded by $ (already converted)
  // (?<![$/\\]) avoids re-matching inside just-inserted LaTeX or paths
  segment = segment.replace(
    /(?<![$/\\])(\d+)\/(\d{1,3})\b(?!\/)/g,
    (_, num, den) => `$\\frac{${num}}{${den}}$`,
  );

  return segment;
}

/**
 * Pre-process text to convert plain-text fractions to LaTeX notation.
 * Only converts fractions OUTSIDE existing $...$ or $$...$$ delimiters.
 */
function convertPlainFractionsToLatex(text: string): string {
  // Quick check: if no slash, nothing to convert
  if (!text.includes("/")) return text;

  // Split around existing math delimiters — preserve them untouched
  // Matches $$display$$, $digit…operator…$ (e.g. $24 - 6$), or $non-digit…$
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$\d[^$\n]*?[+\-×÷=<>^_\\][^$\n]*?\$|\$(?!\d)[^$\n]+?\$)/g;
  const result: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(convertFractionsInSegment(text.slice(lastIndex, match.index)));
    }
    result.push(match[0]); // preserve existing math as-is
    lastIndex = mathRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push(convertFractionsInSegment(text.slice(lastIndex)));
  }

  return result.join("");
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
  // Convert plain-text fractions (e.g. "2 1/4") to LaTeX before rendering
  const processed = convertPlainFractionsToLatex(text);

  if (!containsMathOrSvg(processed)) {
    return (
      <>
        {processed.split("\n").map((line, j, arr) => (
          <span key={j}>
            {renderTextLine(line)}
            {j < arr.length - 1 && <br />}
          </span>
        ))}
      </>
    );
  }

  return <MathTextRenderer text={processed} />;
}
