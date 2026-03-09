"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SerializedSkillState, SkillNodeLayout } from "./types";
import {
  computeSkillLayout,
  getMasteryFill,
  getMasteryLabel,
  getMasteryIcon,
  DOMAIN_LABELS,
} from "./skill-map-layout";
import { curriculum } from "@/lib/exam/curriculum";

interface SkillMapProps {
  readonly states: readonly SerializedSkillState[];
}

export function SkillMap({ states }: SkillMapProps) {
  const router = useRouter();
  const [hoveredSkill, setHoveredSkill] = useState<SkillNodeLayout | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const stateMap = useMemo(
    () => new Map(states.map((s) => [s.skillId, s])),
    [states]
  );

  const layout = useMemo(
    () => computeSkillLayout(curriculum, stateMap),
    [stateMap]
  );

  const handleNodeClick = useCallback(
    (skillId: string) => {
      const route = skillId.startsWith("rc_")
        ? `/tutor/reading?skill=${skillId}`
        : `/tutor/math?skill=${skillId}`;
      router.push(route);
    },
    [router]
  );

  const handleNodeHover = useCallback(
    (node: SkillNodeLayout | null, event?: React.MouseEvent) => {
      setHoveredSkill(node);
      if (node && event) {
        const rect = (event.currentTarget as Element)
          .closest("svg")
          ?.getBoundingClientRect();
        if (rect) {
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }
      }
    },
    []
  );

  const NODE_RADIUS = 22;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 overflow-x-auto">
      <h3 className="text-lg font-semibold mb-3">Skill Map</h3>
      <div className="relative">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height + 30}`}
          className="w-full"
          style={{ minWidth: "600px", maxHeight: "520px" }}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Skill tree showing mastery levels and prerequisite connections"
        >
          {/* Domain column headers */}
          {DOMAIN_LABELS.map((d, i) => (
            <text
              key={d.id}
              x={50 + i * 300 + 150}
              y={24}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400"
              fontSize="13"
              fontWeight="600"
            >
              {d.label}
            </text>
          ))}

          {/* Edges (prerequisite lines) */}
          <g aria-hidden="true">
            {layout.edges.map((edge) => {
              const dx = edge.x2 - edge.x1;
              const dy = edge.y2 - edge.y1;
              const cpx = edge.x1 + dx * 0.5;
              const cpy = edge.y1 + dy * 0.3;
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M ${edge.x1} ${edge.y1 + NODE_RADIUS} Q ${cpx} ${cpy + NODE_RADIUS} ${edge.x2} ${edge.y2 - NODE_RADIUS}`}
                  stroke="#D1D5DB"
                  strokeWidth="1.5"
                  fill="none"
                  className="dark:stroke-gray-700"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {layout.nodes.map((node) => {
              const fill = getMasteryFill(node.mastery);
              const icon = getMasteryIcon(node.mastery);
              const label = getMasteryLabel(node.mastery);
              const percent = Math.round(node.mastery * 100);

              // Truncate name to fit
              const displayName =
                node.name.length > 18
                  ? node.name.slice(0, 16) + "..."
                  : node.name;

              return (
                <g
                  key={node.skillId}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node.skillId)}
                  onMouseEnter={(e) => handleNodeHover(node, e)}
                  onMouseLeave={() => handleNodeHover(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.name} — ${percent}% mastery — ${label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNodeClick(node.skillId);
                    }
                  }}
                >
                  {/* Outer ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    fill={node.attemptsCount === 0 ? "#9CA3AF" : fill}
                    opacity={node.attemptsCount === 0 ? 0.4 : 0.9}
                    stroke={node.attemptsCount === 0 ? "#6B7280" : fill}
                    strokeWidth="2"
                  />

                  {/* Status icon (for accessibility — not sole indicator) */}
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill="white"
                    aria-hidden="true"
                  >
                    {node.attemptsCount === 0 ? "?" : icon}
                  </text>

                  {/* Label below node */}
                  <text
                    x={node.x}
                    y={node.y + NODE_RADIUS + 14}
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-gray-600 dark:fill-gray-400"
                  >
                    {displayName}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredSkill && (
          <div
            className="absolute z-10 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none max-w-[200px]"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 70}px`,
              transform: "translateX(-50%)",
            }}
            role="tooltip"
          >
            <div className="font-semibold">{hoveredSkill.name}</div>
            <div className="mt-1">
              Mastery: {Math.round(hoveredSkill.mastery * 100)}%
            </div>
            <div className="text-gray-300">
              Trend:{" "}
              {hoveredSkill.confidenceTrend === "improving"
                ? "↑ Improving"
                : hoveredSkill.confidenceTrend === "declining"
                  ? "↓ Declining"
                  : "→ Stable"}
            </div>
            <div className="text-gray-400 text-xs mt-1">Click to practice</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
          <span>Mastered (&gt;70%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-500" aria-hidden="true" />
          <span>In Progress (40-70%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true" />
          <span>Needs Practice (&lt;40%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-400 opacity-50" aria-hidden="true" />
          <span>Not Started</span>
        </div>
      </div>
    </div>
  );
}
