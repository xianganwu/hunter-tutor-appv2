"use client";

import type { MasterySnapshot } from "@/lib/parent-data";

interface MasteryChartProps {
  readonly data: readonly MasterySnapshot[];
}

const COLORS = {
  reading: "#22c55e",  // green-500
  mathQr: "#3b82f6",   // blue-500
  mathMa: "#8b5cf6",   // purple-500
};

const W = 600;
const H = 240;
const PAD = { top: 20, right: 20, bottom: 40, left: 45 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export function MasteryChart({ data }: MasteryChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-400">
        No mastery data yet. Progress will appear here after practice sessions.
      </div>
    );
  }

  const n = data.length;
  const xStep = n > 1 ? INNER_W / (n - 1) : INNER_W / 2;
  const toX = (i: number) => PAD.left + (n > 1 ? i * xStep : INNER_W / 2);
  const toY = (pct: number) => PAD.top + INNER_H - (pct / 100) * INNER_H;

  const makeLine = (key: "reading" | "mathQr" | "mathMa") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d[key])}`)
      .join(" ");

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Y-axis grid lines
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.reading }} />
          <span className="text-gray-600 dark:text-gray-400">Reading</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.mathQr }} />
          <span className="text-gray-600 dark:text-gray-400">Math QR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: COLORS.mathMa }} />
          <span className="text-gray-600 dark:text-gray-400">Math Ach.</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Mastery progress over time"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={toY(tick)}
              x2={W - PAD.right}
              y2={toY(tick)}
              stroke="currentColor"
              className="text-gray-100 dark:text-gray-700"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={toY(tick) + 4}
              textAnchor="end"
              className="fill-gray-400 text-[10px]"
            >
              {tick}%
            </text>
          </g>
        ))}

        {/* Lines */}
        {(["reading", "mathQr", "mathMa"] as const).map((key) => (
          <path
            key={key}
            d={makeLine(key)}
            fill="none"
            stroke={COLORS[key]}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Dots */}
        {data.map((d, i) =>
          (["reading", "mathQr", "mathMa"] as const).map((key) => (
            <circle
              key={`${i}-${key}`}
              cx={toX(i)}
              cy={toY(d[key])}
              r="3.5"
              fill={COLORS[key]}
            />
          ))
        )}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Skip some labels if too many data points
          if (n > 8 && i % 2 !== 0 && i !== n - 1) return null;
          return (
            <text
              key={d.date}
              x={toX(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-gray-400 text-[10px]"
            >
              {formatDate(d.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
