"use client";

interface MascotProps {
  /** 1=Hatchling, 2=Explorer, 3=Bookworm, 4=Scholar, 5=Champion */
  readonly tier?: 1 | 2 | 3 | 4 | 5;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

const TIER_LABELS = [
  "",
  "Hatchling",
  "Explorer",
  "Bookworm",
  "Scholar",
  "Champion",
] as const;

/** Base penguin body — shared by all tiers */
function PenguinBase() {
  return (
    <>
      {/* Body */}
      <ellipse cx="32" cy="38" rx="18" ry="22" fill="#1e293b" />
      {/* Belly */}
      <ellipse cx="32" cy="41" rx="12" ry="16" fill="#f1f5f9" />
      {/* Left flipper */}
      <ellipse
        cx="15"
        cy="38"
        rx="5"
        ry="10"
        fill="#1e293b"
        transform="rotate(-10 15 38)"
      />
      {/* Right flipper */}
      <ellipse
        cx="49"
        cy="38"
        rx="5"
        ry="10"
        fill="#1e293b"
        transform="rotate(10 49 38)"
      />
      {/* Left eye */}
      <circle cx="27" cy="30" r="3" fill="white" />
      <circle cx="28" cy="30" r="1.5" fill="#1e293b" />
      {/* Right eye */}
      <circle cx="37" cy="30" r="3" fill="white" />
      <circle cx="38" cy="30" r="1.5" fill="#1e293b" />
      {/* Beak */}
      <polygon points="32,33 29,37 35,37" fill="#f59e0b" />
      {/* Feet */}
      <ellipse cx="26" cy="59" rx="6" ry="3" fill="#f59e0b" />
      <ellipse cx="38" cy="59" rx="6" ry="3" fill="#f59e0b" />
      {/* Cheek blush */}
      <circle cx="23" cy="35" r="3" fill="#fda4af" opacity="0.4" />
      <circle cx="41" cy="35" r="3" fill="#fda4af" opacity="0.4" />
    </>
  );
}

/** Tier 1: Baby penguin hatching from egg */
function Hatchling() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <PenguinBase />
      {/* Egg shell on head */}
      <path
        d="M20 26 Q22 14 32 12 Q42 14 44 26 L40 24 L36 27 L32 22 L28 27 L24 24 Z"
        fill="#fef3c7"
        stroke="#fbbf24"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Tier 2: Penguin with red scarf */
function Explorer() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <PenguinBase />
      {/* Scarf wrap */}
      <path
        d="M18 42 Q22 46 32 46 Q42 46 46 42 Q44 48 32 48 Q20 48 18 42Z"
        fill="#ef4444"
      />
      {/* Scarf tail */}
      <rect x="38" y="44" width="5" height="12" rx="2" fill="#ef4444" />
      <rect x="40" y="44" width="5" height="10" rx="2" fill="#dc2626" />
    </svg>
  );
}

/** Tier 3: Penguin with round glasses */
function Bookworm() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <PenguinBase />
      {/* Left lens */}
      <circle
        cx="27"
        cy="30"
        r="5"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
      />
      {/* Right lens */}
      <circle
        cx="37"
        cy="30"
        r="5"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
      />
      {/* Bridge */}
      <path
        d="M32 29 Q32 28 32 29"
        stroke="#7c3aed"
        strokeWidth="1.5"
      />
      <line x1="32" y1="28" x2="32" y2="29" stroke="#7c3aed" strokeWidth="1.5" />
      {/* Small book held */}
      <rect x="8" y="44" width="10" height="8" rx="1" fill="#3b82f6" />
      <rect x="8" y="44" width="10" height="1.5" rx="0.5" fill="#2563eb" />
      <line x1="13" y1="46" x2="13" y2="52" stroke="#bfdbfe" strokeWidth="0.5" />
    </svg>
  );
}

/** Tier 4: Penguin with graduation cap */
function Scholar() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <PenguinBase />
      {/* Graduation cap board */}
      <polygon points="16,20 32,14 48,20 32,26" fill="#1e293b" />
      {/* Cap base */}
      <rect x="24" y="20" width="16" height="4" rx="1" fill="#334155" />
      {/* Tassel string */}
      <line x1="42" y1="18" x2="48" y2="26" stroke="#f59e0b" strokeWidth="1.5" />
      {/* Tassel end */}
      <circle cx="48" cy="27" r="2" fill="#f59e0b" />
    </svg>
  );
}

/** Tier 5: Penguin with golden crown and sparkles */
function Champion() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <PenguinBase />
      {/* Crown */}
      <path
        d="M21 22 L24 12 L28 18 L32 10 L36 18 L40 12 L43 22 Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.8"
      />
      {/* Crown band */}
      <rect x="21" y="20" width="22" height="3" rx="1" fill="#f59e0b" />
      {/* Crown jewels */}
      <circle cx="27" cy="21.5" r="1.2" fill="#ef4444" />
      <circle cx="32" cy="21.5" r="1.2" fill="#3b82f6" />
      <circle cx="37" cy="21.5" r="1.2" fill="#10b981" />
      {/* Sparkles */}
      <g fill="#fbbf24">
        <polygon points="10,12 11,14 13,14 11.5,15.5 12,18 10,16.5 8,18 8.5,15.5 7,14 9,14" />
        <polygon points="54,10 55,12 57,12 55.5,13.5 56,16 54,14.5 52,16 52.5,13.5 51,12 53,12" />
        <polygon points="52,32 53,34 55,34 53.5,35.5 54,38 52,36.5 50,38 50.5,35.5 49,34 51,34" transform="scale(0.7) translate(20 10)" />
      </g>
    </svg>
  );
}

const TIER_COMPONENTS = [Hatchling, Hatchling, Explorer, Bookworm, Scholar, Champion] as const;

export function Mascot({ tier = 1, size = "md", className = "" }: MascotProps) {
  const Component = TIER_COMPONENTS[tier];
  const label = TIER_LABELS[tier];

  return (
    <span
      className={`inline-block ${SIZE_CLASSES[size]} ${className}`}
      role="img"
      aria-label={`Penguin mascot: ${label}`}
      title={label}
    >
      <Component />
    </span>
  );
}

export function getMascotTier(overallMastery: number): 1 | 2 | 3 | 4 | 5 {
  if (overallMastery >= 0.8) return 5;
  if (overallMastery >= 0.6) return 4;
  if (overallMastery >= 0.4) return 3;
  if (overallMastery >= 0.2) return 2;
  return 1;
}
