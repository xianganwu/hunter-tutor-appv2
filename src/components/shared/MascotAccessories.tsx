"use client";

import type { MascotAnimal } from "./Mascot";
import type { MascotAccessory } from "@/lib/achievements";

// ═══════════════════════════════════════════════════════════════════════
// PARTY HAT — Animal-specific (Release 2)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: head top ~16y. Cone sits above the round head.
function PenguinPartyHat() {
  return (
    <g>
      <polygon points="32,2 24,17 40,17" fill="#f472b6" />
      <rect x="24" y="15" width="16" height="3" rx="1" fill="#ec4899" />
      <circle cx="32" cy="3" r="2.5" fill="#fbbf24" />
      {/* Dots */}
      <circle cx="30" cy="10" r="1" fill="#fbbf24" />
      <circle cx="34" cy="13" r="1" fill="#a78bfa" />
      <circle cx="28" cy="14" r="0.8" fill="#34d399" />
    </g>
  );
}

// Monkey: head center ~26y (r=14), top ~12y. Hat sits between ears.
function MonkeyPartyHat() {
  return (
    <g>
      <polygon points="32,0 24,13 40,13" fill="#a78bfa" />
      <rect x="24" y="11" width="16" height="3" rx="1" fill="#8b5cf6" />
      <circle cx="32" cy="1" r="2.5" fill="#f472b6" />
      <circle cx="30" cy="6" r="1" fill="#fbbf24" />
      <circle cx="34" cy="9" r="1" fill="#34d399" />
      <circle cx="28" cy="10" r="0.8" fill="#f472b6" />
    </g>
  );
}

// Phoenix: head center ~24y (r=11), top ~13y. Cone between head crest.
function PhoenixPartyHat() {
  return (
    <g>
      <polygon points="32,0 25,14 39,14" fill="#fbbf24" />
      <rect x="25" y="12" width="14" height="3" rx="1" fill="#f59e0b" />
      <circle cx="32" cy="1" r="2.5" fill="#ef4444" />
      <circle cx="30" cy="6" r="1" fill="#ef4444" />
      <circle cx="34" cy="10" r="1" fill="#dc2626" />
      <circle cx="29" cy="11" r="0.8" fill="#f97316" />
    </g>
  );
}

// Dragon: head center ~24y, horns reach up to ~4y. Hat between horns.
function DragonPartyHat() {
  return (
    <g>
      <polygon points="32,2 26,15 38,15" fill="#34d399" />
      <rect x="26" y="13" width="12" height="3" rx="1" fill="#10b981" />
      <circle cx="32" cy="3" r="2.5" fill="#fbbf24" />
      <circle cx="30" cy="8" r="1" fill="#fbbf24" />
      <circle cx="34" cy="11" r="1" fill="#a78bfa" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STAR BADGE — Animal-specific (Release 2)
// ═══════════════════════════════════════════════════════════════════════

const STAR_PATH = "M0,-5 L1.5,-1.5 L5.5,-1.5 L2.5,1 L3.5,5 L0,2.5 L-3.5,5 L-2.5,1 L-5.5,-1.5 L-1.5,-1.5 Z";

// Penguin: belly at ~41y center. Pin on left chest.
function PenguinStarBadge() {
  return (
    <g transform="translate(24, 36)">
      <path d={STAR_PATH} fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" transform="scale(0.9)" />
      <circle cx="0" cy="0" r="1" fill="#fef3c7" />
    </g>
  );
}

// Monkey: belly ~43y. Pin slightly higher on left chest near arm.
function MonkeyStarBadge() {
  return (
    <g transform="translate(24, 38)">
      <path d={STAR_PATH} fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
      <circle cx="0" cy="0" r="1" fill="#fef3c7" />
    </g>
  );
}

// Phoenix: belly ~43y, narrower body. Center-left of chest.
function PhoenixStarBadge() {
  return (
    <g transform="translate(26, 37)">
      <path d={STAR_PATH} fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" transform="scale(0.85)" />
      <circle cx="0" cy="0" r="1" fill="#fef3c7" />
    </g>
  );
}

// Dragon: belly ~43y with scale ridges. Pin on smooth chest area.
function DragonStarBadge() {
  return (
    <g transform="translate(24, 37)">
      <path d={STAR_PATH} fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
      <circle cx="0" cy="0" r="1" fill="#fef3c7" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GRADUATION CAP — Animal-specific (Release 2)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: head top ~16y, head center ~30y.
function PenguinGraduationCap() {
  return (
    <g>
      <polygon points="15,13 32,7 49,13 32,19" fill="#1e293b" />
      <rect x="24" y="13" width="16" height="4" rx="1" fill="#334155" />
      <line x1="44" y1="12" x2="50" y2="19" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="50" cy="20" r="2" fill="#f59e0b" />
    </g>
  );
}

// Monkey: head top ~12y, wider head. Cap tilted slightly.
function MonkeyGraduationCap() {
  return (
    <g>
      <polygon points="13,10 32,4 51,10 32,16" fill="#1e293b" />
      <rect x="22" y="10" width="20" height="4" rx="1" fill="#334155" />
      <line x1="46" y1="9" x2="52" y2="16" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="52" cy="17" r="2" fill="#f59e0b" />
    </g>
  );
}

// Phoenix: head top ~13y, round head. Cap with fiery tassel.
function PhoenixGraduationCap() {
  return (
    <g>
      <polygon points="16,10 32,4 48,10 32,16" fill="#1e293b" />
      <rect x="24" y="10" width="16" height="4" rx="1" fill="#334155" />
      <line x1="43" y1="9" x2="49" y2="16" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="49" cy="17" r="2" fill="#ef4444" />
      <circle cx="49" cy="15" r="1" fill="#f97316" opacity="0.7" />
    </g>
  );
}

// Dragon: head center ~24y, horns go up. Cap between horns, slightly higher.
function DragonGraduationCap() {
  return (
    <g>
      <polygon points="15,12 32,6 49,12 32,18" fill="#1e293b" />
      <rect x="24" y="12" width="16" height="4" rx="1" fill="#334155" />
      <line x1="44" y1="11" x2="50" y2="18" stroke="#4ade80" strokeWidth="1.5" />
      <circle cx="50" cy="19" r="2" fill="#4ade80" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CAPE — Animal-specific (Release 2)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: body ellipse rx=18 ry=22, centered at 32,38. Cape wraps behind.
function PenguinCape() {
  return (
    <g>
      <path
        d="M18,24 Q14,36 10,52 Q22,58 32,58 Q42,58 54,52 Q50,36 46,24 Q40,28 32,28 Q24,28 18,24 Z"
        fill="#7c3aed" opacity="0.85"
      />
      <path
        d="M20,28 Q17,38 14,50 Q24,55 32,55 Q40,55 50,50 Q47,38 44,28 Q39,31 32,31 Q25,31 20,28 Z"
        fill="#6d28d9" opacity="0.5"
      />
      {/* Clasp */}
      <circle cx="32" cy="24" r="2" fill="#fbbf24" />
    </g>
  );
}

// Monkey: body centered at 32,40. Cape wraps behind torso and tail.
function MonkeyCape() {
  return (
    <g>
      <path
        d="M16,28 Q12,40 8,54 Q22,60 32,60 Q42,60 56,54 Q52,40 48,28 Q42,32 32,32 Q22,32 16,28 Z"
        fill="#dc2626" opacity="0.85"
      />
      <path
        d="M18,32 Q15,42 12,52 Q24,57 32,57 Q40,57 52,52 Q49,42 46,32 Q41,35 32,35 Q23,35 18,32 Z"
        fill="#b91c1c" opacity="0.5"
      />
      <circle cx="32" cy="28" r="2" fill="#fbbf24" />
    </g>
  );
}

// Phoenix: body narrower, wings extend. Cape flows beneath wings.
function PhoenixCape() {
  return (
    <g>
      <path
        d="M20,26 Q16,38 12,54 Q24,60 32,60 Q40,60 52,54 Q48,38 44,26 Q40,30 32,30 Q24,30 20,26 Z"
        fill="#7c3aed" opacity="0.85"
      />
      <path
        d="M22,30 Q19,40 16,52 Q26,57 32,57 Q38,57 48,52 Q45,40 42,30 Q38,33 32,33 Q26,33 22,30 Z"
        fill="#6d28d9" opacity="0.5"
      />
      {/* Gold flame clasp */}
      <path d="M32,26 L30,23 L32,20 L34,23 Z" fill="#fbbf24" />
    </g>
  );
}

// Dragon: broader body, wings at sides. Cape has scales pattern.
function DragonCape() {
  return (
    <g>
      <path
        d="M17,26 Q12,40 8,56 Q22,62 32,62 Q42,62 56,56 Q52,40 47,26 Q42,30 32,30 Q22,30 17,26 Z"
        fill="#1e293b" opacity="0.85"
      />
      <path
        d="M19,30 Q15,42 12,54 Q24,59 32,59 Q40,59 52,54 Q49,42 45,30 Q41,33 32,33 Q23,33 19,30 Z"
        fill="#0f172a" opacity="0.5"
      />
      {/* Scale pattern on cape */}
      <path d="M26,40 L32,38 L38,40" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.6" />
      <path d="M24,46 L32,44 L40,46" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.6" />
      <path d="M22,52 L32,50 L42,52" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.6" />
      {/* Green gem clasp */}
      <circle cx="32" cy="26" r="2.5" fill="#22c55e" stroke="#15803d" strokeWidth="0.5" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REMAINING 6 — Universal placeholders (Release 3 will add variants)
// ═══════════════════════════════════════════════════════════════════════

function Backpack() {
  return (
    <g>
      <rect x="42" y="28" width="12" height="16" rx="3" fill="#22c55e" />
      <rect x="42" y="28" width="12" height="5" rx="2" fill="#16a34a" />
      <rect x="46" y="32" width="4" height="3" rx="1" fill="#fbbf24" />
      <line x1="42" y1="30" x2="38" y2="34" stroke="#16a34a" strokeWidth="1.5" />
    </g>
  );
}

function Book() {
  return (
    <g>
      <rect x="36" y="32" width="14" height="12" rx="1.5" fill="#3b82f6" />
      <rect x="36" y="32" width="3" height="12" rx="1" fill="#2563eb" />
      <rect x="39" y="33" width="10" height="10" rx="0.5" fill="#f8fafc" />
      <line x1="41" y1="36" x2="47" y2="36" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="41" y1="38" x2="47" y2="38" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="41" y1="40" x2="46" y2="40" stroke="#cbd5e1" strokeWidth="0.5" />
    </g>
  );
}

function Telescope() {
  return (
    <g>
      <rect x="10" y="24" width="30" height="4" rx="2" fill="#64748b" transform="rotate(-30 25 26)" />
      <rect x="6" y="22" width="6" height="6" rx="3" fill="#475569" transform="rotate(-30 9 25)" />
      <rect x="38" y="25" width="4" height="3" rx="1" fill="#94a3b8" transform="rotate(-30 40 26.5)" />
      <circle cx="9" cy="23" r="1.5" fill="#93c5fd" opacity="0.6" />
    </g>
  );
}

function Quill() {
  return (
    <g>
      <line x1="44" y1="8" x2="50" y2="24" stroke="#92400e" strokeWidth="1" />
      <path d="M44,8 Q40,12 42,18 Q44,14 44,8 Z" fill="#f59e0b" />
      <path d="M44,8 Q48,12 46,18 Q44,14 44,8 Z" fill="#fbbf24" />
      <path d="M44,6 Q43,4 44,2 Q45,4 44,6 Z" fill="#d97706" />
      <path d="M49,22 L50,24 L51,22" fill="#1e293b" />
    </g>
  );
}

function Medal() {
  return (
    <g>
      <path d="M28,26 L24,34 L28,32" fill="#ef4444" />
      <path d="M36,26 L40,34 L36,32" fill="#ef4444" />
      <path d="M28,26 L32,28 L36,26 L36,32 L32,34 L28,32 Z" fill="#dc2626" />
      <circle cx="32" cy="38" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" />
      <polygon
        points="32,34 33,36.5 35.5,36.5 33.5,38 34.5,40.5 32,39 29.5,40.5 30.5,38 28.5,36.5 31,36.5"
        fill="#f59e0b"
      />
    </g>
  );
}

function Wand() {
  return (
    <g>
      <rect x="48" y="16" width="3" height="28" rx="1.5" fill="#92400e" transform="rotate(15 49.5 30)" />
      <rect x="47" y="38" width="5" height="6" rx="2" fill="#78350f" transform="rotate(15 49.5 41)" />
      <circle cx="48" cy="14" r="2" fill="#fbbf24" />
      <circle cx="45" cy="12" r="1" fill="#fde68a" />
      <circle cx="51" cy="11" r="1" fill="#fde68a" />
      <circle cx="48" cy="10" r="0.8" fill="#fef3c7" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Lookup: animal-specific for first 4, universal for remaining 6
// ═══════════════════════════════════════════════════════════════════════

const ANIMAL_SPECIFIC: Record<string, Record<MascotAnimal, () => React.JSX.Element>> = {
  party_hat: {
    penguin: PenguinPartyHat,
    monkey: MonkeyPartyHat,
    phoenix: PhoenixPartyHat,
    dragon: DragonPartyHat,
  },
  star_badge: {
    penguin: PenguinStarBadge,
    monkey: MonkeyStarBadge,
    phoenix: PhoenixStarBadge,
    dragon: DragonStarBadge,
  },
  graduation_cap: {
    penguin: PenguinGraduationCap,
    monkey: MonkeyGraduationCap,
    phoenix: PhoenixGraduationCap,
    dragon: DragonGraduationCap,
  },
  cape: {
    penguin: PenguinCape,
    monkey: MonkeyCape,
    phoenix: PhoenixCape,
    dragon: DragonCape,
  },
};

const UNIVERSAL: Record<string, () => React.JSX.Element> = {
  backpack: Backpack,
  book: Book,
  telescope: Telescope,
  quill: Quill,
  medal: Medal,
  wand: Wand,
};

function getAccessoryComponent(
  accessory: Exclude<MascotAccessory, "none">,
  mascotType: MascotAnimal
): (() => React.JSX.Element) | null {
  // Check animal-specific first
  const animalMap = ANIMAL_SPECIFIC[accessory];
  if (animalMap) {
    return animalMap[mascotType] ?? null;
  }
  // Fall back to universal
  return UNIVERSAL[accessory] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════
// Public Component
// ═══════════════════════════════════════════════════════════════════════

interface AccessoryOverlayProps {
  readonly accessory: MascotAccessory;
  readonly mascotType: MascotAnimal;
}

/**
 * Renders an accessory SVG overlay on top of the mascot.
 * Party hat, star badge, graduation cap, and cape have animal-specific
 * variants. Remaining accessories use universal placeholders.
 */
export function AccessoryOverlay({ accessory, mascotType }: AccessoryOverlayProps) {
  if (accessory === "none") return null;

  const Component = getAccessoryComponent(accessory, mascotType);
  if (!Component) return null;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden="true"
    >
      <Component />
    </svg>
  );
}
