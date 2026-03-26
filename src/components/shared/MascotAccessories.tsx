"use client";

import type { MascotAnimal } from "./Mascot";
import type { MascotAccessory } from "@/lib/achievements";

// ─── Placeholder Accessory SVGs (Release 1) ─────────────────────────
// Each accessory is a simple colored shape in a 64x64 viewBox.
// Animal-specific variants come in Release 2-3.

function PartyHat() {
  return (
    <g>
      {/* Cone */}
      <polygon points="32,2 22,16 42,16" fill="#f472b6" />
      {/* Band */}
      <rect x="22" y="14" width="20" height="3" rx="1" fill="#ec4899" />
      {/* Pom-pom */}
      <circle cx="32" cy="3" r="2.5" fill="#fbbf24" />
    </g>
  );
}

function StarBadge() {
  return (
    <g>
      {/* 5-point star on chest */}
      <polygon
        points="26,30 28,35 24,38 29,38 26,42 26,37 23,34"
        fill="none"
      />
      <polygon
        points="26,31 27.5,35 24,37.5 28,37.5 26,41"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.5"
      />
      {/* Simplified star shape */}
      <path
        d="M26,30 L27.5,34.5 L32,34.5 L28.5,37 L30,42 L26,39 L22,42 L23.5,37 L20,34.5 L24.5,34.5 Z"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="0.5"
      />
    </g>
  );
}

function GraduationCap() {
  return (
    <g>
      {/* Cap board */}
      <polygon points="16,8 32,3 48,8 32,13" fill="#1e293b" />
      {/* Cap base */}
      <rect x="24" y="8" width="16" height="4" rx="1" fill="#334155" />
      {/* Tassel string */}
      <line x1="42" y1="7" x2="48" y2="14" stroke="#f59e0b" strokeWidth="1.5" />
      {/* Tassel end */}
      <circle cx="48" cy="15" r="2" fill="#f59e0b" />
    </g>
  );
}

function Cape() {
  return (
    <g>
      {/* Flowing cape behind body */}
      <path
        d="M20,22 Q18,35 14,50 Q24,55 32,55 Q40,55 50,50 Q46,35 44,22 Q38,25 32,25 Q26,25 20,22 Z"
        fill="#7c3aed"
        opacity="0.85"
      />
      {/* Cape inner shading */}
      <path
        d="M22,25 Q20,36 17,48 Q26,52 32,52 Q38,52 47,48 Q44,36 42,25 Q38,27 32,27 Q26,27 22,25 Z"
        fill="#6d28d9"
        opacity="0.5"
      />
    </g>
  );
}

function Backpack() {
  return (
    <g>
      {/* Backpack body */}
      <rect x="42" y="28" width="12" height="16" rx="3" fill="#22c55e" />
      {/* Flap */}
      <rect x="42" y="28" width="12" height="5" rx="2" fill="#16a34a" />
      {/* Buckle */}
      <rect x="46" y="32" width="4" height="3" rx="1" fill="#fbbf24" />
      {/* Strap */}
      <line x1="42" y1="30" x2="38" y2="34" stroke="#16a34a" strokeWidth="1.5" />
    </g>
  );
}

function Book() {
  return (
    <g>
      {/* Book cover */}
      <rect x="36" y="32" width="14" height="12" rx="1.5" fill="#3b82f6" />
      {/* Book spine */}
      <rect x="36" y="32" width="3" height="12" rx="1" fill="#2563eb" />
      {/* Pages */}
      <rect x="39" y="33" width="10" height="10" rx="0.5" fill="#f8fafc" />
      {/* Page lines */}
      <line x1="41" y1="36" x2="47" y2="36" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="41" y1="38" x2="47" y2="38" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="41" y1="40" x2="46" y2="40" stroke="#cbd5e1" strokeWidth="0.5" />
    </g>
  );
}

function Telescope() {
  return (
    <g>
      {/* Telescope body — diagonal across */}
      <rect
        x="10"
        y="24"
        width="30"
        height="4"
        rx="2"
        fill="#64748b"
        transform="rotate(-30 25 26)"
      />
      {/* Lens end (wider) */}
      <rect
        x="6"
        y="22"
        width="6"
        height="6"
        rx="3"
        fill="#475569"
        transform="rotate(-30 9 25)"
      />
      {/* Eyepiece (narrow) */}
      <rect
        x="38"
        y="25"
        width="4"
        height="3"
        rx="1"
        fill="#94a3b8"
        transform="rotate(-30 40 26.5)"
      />
      {/* Lens glint */}
      <circle cx="9" cy="23" r="1.5" fill="#93c5fd" opacity="0.6" />
    </g>
  );
}

function Quill() {
  return (
    <g>
      {/* Feather shaft */}
      <line x1="44" y1="8" x2="50" y2="24" stroke="#92400e" strokeWidth="1" />
      {/* Feather vane */}
      <path
        d="M44,8 Q40,12 42,18 Q44,14 44,8 Z"
        fill="#f59e0b"
      />
      <path
        d="M44,8 Q48,12 46,18 Q44,14 44,8 Z"
        fill="#fbbf24"
      />
      {/* Feather tip barbs */}
      <path d="M44,6 Q43,4 44,2 Q45,4 44,6 Z" fill="#d97706" />
      {/* Nib */}
      <path d="M49,22 L50,24 L51,22" fill="#1e293b" />
    </g>
  );
}

function Medal() {
  return (
    <g>
      {/* Ribbon left */}
      <path d="M28,26 L24,34 L28,32" fill="#ef4444" />
      {/* Ribbon right */}
      <path d="M36,26 L40,34 L36,32" fill="#ef4444" />
      {/* Ribbon center */}
      <path d="M28,26 L32,28 L36,26 L36,32 L32,34 L28,32 Z" fill="#dc2626" />
      {/* Medal disc */}
      <circle cx="32" cy="38" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" />
      {/* Medal star */}
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
      {/* Wand stick */}
      <rect
        x="48"
        y="16"
        width="3"
        height="28"
        rx="1.5"
        fill="#92400e"
        transform="rotate(15 49.5 30)"
      />
      {/* Wand grip */}
      <rect
        x="47"
        y="38"
        width="5"
        height="6"
        rx="2"
        fill="#78350f"
        transform="rotate(15 49.5 41)"
      />
      {/* Magic sparkle */}
      <circle cx="48" cy="14" r="2" fill="#fbbf24" />
      <circle cx="45" cy="12" r="1" fill="#fde68a" />
      <circle cx="51" cy="11" r="1" fill="#fde68a" />
      <circle cx="48" cy="10" r="0.8" fill="#fef3c7" />
    </g>
  );
}

// ─── Accessory Lookup ───────────────────────────────────────────────

const ACCESSORY_COMPONENTS: Record<
  Exclude<MascotAccessory, "none">,
  () => React.JSX.Element
> = {
  party_hat: PartyHat,
  star_badge: StarBadge,
  graduation_cap: GraduationCap,
  cape: Cape,
  backpack: Backpack,
  book: Book,
  telescope: Telescope,
  quill: Quill,
  medal: Medal,
  wand: Wand,
};

// ─── Public Component ───────────────────────────────────────────────

interface AccessoryOverlayProps {
  readonly accessory: MascotAccessory;
  readonly mascotType: MascotAnimal;
}

/**
 * Renders a placeholder accessory SVG overlay.
 * For Release 1, all animals share the same universal placeholder shapes.
 * Animal-specific variants will be added in Release 2-3.
 */
export function AccessoryOverlay({ accessory }: AccessoryOverlayProps) {
  if (accessory === "none") return null;

  const Component = ACCESSORY_COMPONENTS[accessory];
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
