"use client";

export type MascotAnimal = "penguin" | "monkey";

interface MascotProps {
  /** 1=Hatchling, 2=Explorer, 3=Bookworm, 4=Scholar, 5=Champion */
  readonly tier?: 1 | 2 | 3 | 4 | 5;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
  readonly mascotType?: MascotAnimal;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

const PENGUIN_TIER_LABELS = [
  "",
  "Hatchling",
  "Explorer",
  "Bookworm",
  "Scholar",
  "Champion",
] as const;

const MONKEY_TIER_LABELS = [
  "",
  "Baby Monkey",
  "Adventurer",
  "Clever Monkey",
  "Wise Monkey",
  "Monkey King",
] as const;

// ─── Penguin SVGs ──────────────────────────────────────────────────────

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
function PenguinHatchling() {
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
function PenguinExplorer() {
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
function PenguinBookworm() {
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
function PenguinScholar() {
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
function PenguinChampion() {
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

// ─── Monkey SVGs ───────────────────────────────────────────────────────

/** Base monkey body — shared by all monkey tiers */
function MonkeyBase() {
  return (
    <>
      {/* Body */}
      <ellipse cx="32" cy="40" rx="16" ry="20" fill="#8B4513" />
      {/* Belly / face area lighter patch */}
      <ellipse cx="32" cy="43" rx="11" ry="14" fill="#D2A679" />
      {/* Head */}
      <circle cx="32" cy="26" r="14" fill="#8B4513" />
      {/* Face */}
      <ellipse cx="32" cy="28" rx="10" ry="9" fill="#D2A679" />
      {/* Left ear */}
      <circle cx="17" cy="22" r="5" fill="#8B4513" />
      <circle cx="17" cy="22" r="3" fill="#D2A679" />
      {/* Right ear */}
      <circle cx="47" cy="22" r="5" fill="#8B4513" />
      <circle cx="47" cy="22" r="3" fill="#D2A679" />
      {/* Left eye */}
      <circle cx="27" cy="26" r="3" fill="white" />
      <circle cx="28" cy="26" r="1.8" fill="#2d1600" />
      <circle cx="28.5" cy="25.5" r="0.6" fill="white" />
      {/* Right eye */}
      <circle cx="37" cy="26" r="3" fill="white" />
      <circle cx="36" cy="26" r="1.8" fill="#2d1600" />
      <circle cx="36.5" cy="25.5" r="0.6" fill="white" />
      {/* Nose */}
      <ellipse cx="30" cy="30" rx="1.2" ry="1" fill="#5c3010" />
      <ellipse cx="34" cy="30" rx="1.2" ry="1" fill="#5c3010" />
      {/* Mouth — smile */}
      <path d="M28 33 Q32 37 36 33" fill="none" stroke="#5c3010" strokeWidth="1" strokeLinecap="round" />
      {/* Left arm */}
      <ellipse cx="16" cy="42" rx="5" ry="9" fill="#8B4513" transform="rotate(-15 16 42)" />
      {/* Right arm */}
      <ellipse cx="48" cy="42" rx="5" ry="9" fill="#8B4513" transform="rotate(15 48 42)" />
      {/* Feet */}
      <ellipse cx="25" cy="59" rx="6" ry="3" fill="#6b3410" />
      <ellipse cx="39" cy="59" rx="6" ry="3" fill="#6b3410" />
      {/* Tail — curly */}
      <path d="M48 50 Q56 48 54 40 Q52 34 56 30" fill="none" stroke="#8B4513" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/** Tier 1: Baby monkey with banana */
function MonkeyBaby() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MonkeyBase />
      {/* Banana held in left hand */}
      <path d="M10 38 Q8 34 10 30 Q12 28 14 30" fill="#FFD700" stroke="#DAA520" strokeWidth="0.8" />
      <path d="M10 30 Q9 28 10 27" fill="none" stroke="#8B6914" strokeWidth="0.8" />
    </svg>
  );
}

/** Tier 2: Adventurer monkey with explorer hat */
function MonkeyAdventurer() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MonkeyBase />
      {/* Safari / explorer hat */}
      <ellipse cx="32" cy="16" rx="16" ry="4" fill="#C4A35A" />
      <path d="M22 16 Q22 8 32 6 Q42 8 42 16" fill="#C4A35A" />
      <rect x="22" y="14" width="20" height="3" rx="1" fill="#A0884A" />
    </svg>
  );
}

/** Tier 3: Clever monkey with glasses and book */
function MonkeyClever() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MonkeyBase />
      {/* Round glasses */}
      <circle cx="27" cy="26" r="5" fill="none" stroke="#1e40af" strokeWidth="1.5" />
      <circle cx="37" cy="26" r="5" fill="none" stroke="#1e40af" strokeWidth="1.5" />
      <line x1="32" y1="25" x2="32" y2="25.5" stroke="#1e40af" strokeWidth="1.5" />
      {/* Book held */}
      <rect x="6" y="44" width="10" height="8" rx="1" fill="#16a34a" />
      <rect x="6" y="44" width="10" height="1.5" rx="0.5" fill="#15803d" />
      <line x1="11" y1="46" x2="11" y2="52" stroke="#bbf7d0" strokeWidth="0.5" />
    </svg>
  );
}

/** Tier 4: Wise monkey with graduation cap */
function MonkeyWise() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MonkeyBase />
      {/* Graduation cap */}
      <polygon points="16,16 32,10 48,16 32,22" fill="#1e293b" />
      <rect x="24" y="16" width="16" height="4" rx="1" fill="#334155" />
      {/* Tassel */}
      <line x1="42" y1="14" x2="48" y2="22" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="48" cy="23" r="2" fill="#f59e0b" />
    </svg>
  );
}

/** Tier 5: Monkey King with golden crown, cape, and sparkles */
function MonkeyKing() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MonkeyBase />
      {/* Crown */}
      <path
        d="M20 18 L23 8 L27 14 L32 6 L37 14 L41 8 L44 18 Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.8"
      />
      <rect x="20" y="16" width="24" height="3" rx="1" fill="#f59e0b" />
      {/* Crown jewels */}
      <circle cx="27" cy="17.5" r="1.2" fill="#ef4444" />
      <circle cx="32" cy="17.5" r="1.2" fill="#3b82f6" />
      <circle cx="37" cy="17.5" r="1.2" fill="#10b981" />
      {/* Sparkles */}
      <g fill="#fbbf24">
        <polygon points="8,10 9,12 11,12 9.5,13.5 10,16 8,14.5 6,16 6.5,13.5 5,12 7,12" />
        <polygon points="56,8 57,10 59,10 57.5,11.5 58,14 56,12.5 54,14 54.5,11.5 53,10 55,10" />
        <polygon points="52,32 53,34 55,34 53.5,35.5 54,38 52,36.5 50,38 50.5,35.5 49,34 51,34" transform="scale(0.7) translate(20 10)" />
      </g>
    </svg>
  );
}

// ─── Component Arrays & Export ─────────────────────────────────────────

const PENGUIN_TIERS = [PenguinHatchling, PenguinHatchling, PenguinExplorer, PenguinBookworm, PenguinScholar, PenguinChampion] as const;
const MONKEY_TIERS = [MonkeyBaby, MonkeyBaby, MonkeyAdventurer, MonkeyClever, MonkeyWise, MonkeyKing] as const;

export function Mascot({ tier = 1, size = "md", className = "", mascotType = "penguin" }: MascotProps) {
  const tiers = mascotType === "monkey" ? MONKEY_TIERS : PENGUIN_TIERS;
  const labels = mascotType === "monkey" ? MONKEY_TIER_LABELS : PENGUIN_TIER_LABELS;
  const Component = tiers[tier];
  const label = labels[tier];
  const animalName = mascotType === "monkey" ? "Monkey" : "Penguin";

  return (
    <span
      className={`inline-block ${SIZE_CLASSES[size]} ${className}`}
      role="img"
      aria-label={`${animalName} mascot: ${label}`}
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

export function getMascotLabel(tier: 1 | 2 | 3 | 4 | 5, mascotType: MascotAnimal = "penguin"): string {
  const labels = mascotType === "monkey" ? MONKEY_TIER_LABELS : PENGUIN_TIER_LABELS;
  return labels[tier];
}
