"use client";

import { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  readonly text: string;
}

interface TextPart {
  readonly type: "text" | "inline-math" | "display-math";
  readonly content: string;
}

function parseText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  // Match $$...$$ (display) or $...$ (inline), non-greedy
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

  return parts;
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
