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
// BACKPACK — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: backpack on right side behind flipper, icy blue.
function PenguinBackpack() {
  return (
    <g>
      <rect x="44" y="30" width="11" height="15" rx="3" fill="#38bdf8" />
      <rect x="44" y="30" width="11" height="5" rx="2" fill="#0ea5e9" />
      <rect x="48" y="34" width="4" height="3" rx="1" fill="#e2e8f0" />
      <line x1="44" y1="32" x2="40" y2="36" stroke="#0ea5e9" strokeWidth="1.5" />
    </g>
  );
}
// Monkey: backpack on back, leafy green with banana buckle.
function MonkeyBackpack() {
  return (
    <g>
      <rect x="44" y="32" width="12" height="16" rx="3" fill="#22c55e" />
      <rect x="44" y="32" width="12" height="5" rx="2" fill="#16a34a" />
      <path d="M48,36 Q50,34.5 52,36" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
      <line x1="44" y1="34" x2="40" y2="38" stroke="#16a34a" strokeWidth="1.5" />
    </g>
  );
}
// Phoenix: satchel behind wing, warm red-orange.
function PhoenixBackpack() {
  return (
    <g>
      <rect x="44" y="30" width="10" height="14" rx="3" fill="#f97316" />
      <rect x="44" y="30" width="10" height="5" rx="2" fill="#ea580c" />
      <rect x="47" y="34" width="4" height="3" rx="1" fill="#fbbf24" />
      <line x1="44" y1="32" x2="41" y2="36" stroke="#ea580c" strokeWidth="1.5" />
    </g>
  );
}
// Dragon: rugged pack behind wing, dark with green trim.
function DragonBackpack() {
  return (
    <g>
      <rect x="46" y="30" width="12" height="16" rx="3" fill="#334155" />
      <rect x="46" y="30" width="12" height="5" rx="2" fill="#1e293b" />
      <rect x="50" y="34" width="4" height="3" rx="1" fill="#4ade80" />
      <line x1="46" y1="32" x2="42" y2="36" stroke="#1e293b" strokeWidth="1.5" />
      {/* Scale stitch detail */}
      <path d="M49,40 L52,39 L55,40" fill="none" stroke="#475569" strokeWidth="0.5" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BOOK — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: blue book held in flipper on right side.
function PenguinBook() {
  return (
    <g>
      <rect x="46" y="34" width="12" height="10" rx="1.5" fill="#3b82f6" />
      <rect x="46" y="34" width="2.5" height="10" rx="1" fill="#2563eb" />
      <rect x="49" y="35" width="8" height="8" rx="0.5" fill="#f8fafc" />
      <line x1="51" y1="37.5" x2="55" y2="37.5" stroke="#cbd5e1" strokeWidth="0.5" />
      <line x1="51" y1="39.5" x2="55" y2="39.5" stroke="#cbd5e1" strokeWidth="0.5" />
    </g>
  );
}
// Monkey: open book held in hands, brown cover.
function MonkeyBook() {
  return (
    <g>
      <rect x="10" y="36" width="13" height="10" rx="1.5" fill="#92400e" />
      <rect x="10" y="36" width="2.5" height="10" rx="1" fill="#78350f" />
      <rect x="13" y="37" width="9" height="8" rx="0.5" fill="#fef3c7" />
      <line x1="15" y1="39.5" x2="20" y2="39.5" stroke="#d6d3d1" strokeWidth="0.5" />
      <line x1="15" y1="41.5" x2="20" y2="41.5" stroke="#d6d3d1" strokeWidth="0.5" />
    </g>
  );
}
// Phoenix: fiery tome, red/orange cover with flame emblem.
function PhoenixBook() {
  return (
    <g>
      <rect x="46" y="34" width="12" height="10" rx="1.5" fill="#dc2626" />
      <rect x="46" y="34" width="2.5" height="10" rx="1" fill="#b91c1c" />
      <rect x="49" y="35" width="8" height="8" rx="0.5" fill="#fef3c7" />
      <path d="M53,36 Q52,34 53,32 Q54,34 53,36" fill="#f97316" opacity="0.6" />
      <line x1="50" y1="38" x2="56" y2="38" stroke="#fecaca" strokeWidth="0.5" />
      <line x1="50" y1="40" x2="55" y2="40" stroke="#fecaca" strokeWidth="0.5" />
    </g>
  );
}
// Dragon: ancient tome, dark green with runes.
function DragonBook() {
  return (
    <g>
      <rect x="8" y="36" width="13" height="11" rx="1.5" fill="#15803d" />
      <rect x="8" y="36" width="2.5" height="11" rx="1" fill="#14532d" />
      <rect x="11" y="37" width="9" height="9" rx="0.5" fill="#ecfdf5" />
      {/* Rune symbols */}
      <path d="M13,39 L15,41 L17,39" fill="none" stroke="#16a34a" strokeWidth="0.6" />
      <path d="M13,43 L16,43" fill="none" stroke="#16a34a" strokeWidth="0.6" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TELESCOPE — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: silver telescope held in flipper, angled up-left.
function PenguinTelescope() {
  return (
    <g>
      <rect x="6" y="22" width="28" height="3.5" rx="1.8" fill="#94a3b8" transform="rotate(-25 20 24)" />
      <rect x="3" y="20" width="5" height="5" rx="2.5" fill="#64748b" transform="rotate(-25 5.5 22.5)" />
      <circle cx="6" cy="20" r="1.5" fill="#bfdbfe" opacity="0.6" />
    </g>
  );
}
// Monkey: brass spyglass held to eye, pirate-style.
function MonkeyTelescope() {
  return (
    <g>
      <rect x="4" y="20" width="26" height="4" rx="2" fill="#b45309" transform="rotate(-20 17 22)" />
      <rect x="1" y="18" width="5" height="5.5" rx="2.5" fill="#92400e" transform="rotate(-20 3.5 21)" />
      <circle cx="4" cy="18.5" r="1.5" fill="#fde68a" opacity="0.5" />
      {/* Brass rings */}
      <rect x="14" y="20.5" width="2" height="3.5" rx="1" fill="#d97706" transform="rotate(-20 15 22)" />
    </g>
  );
}
// Phoenix: golden scope with flame-lens.
function PhoenixTelescope() {
  return (
    <g>
      <rect x="6" y="20" width="28" height="3.5" rx="1.8" fill="#d97706" transform="rotate(-28 20 22)" />
      <rect x="3" y="18" width="5" height="5" rx="2.5" fill="#b45309" transform="rotate(-28 5.5 20.5)" />
      <circle cx="5.5" cy="18.5" r="1.8" fill="#ef4444" opacity="0.5" />
      <circle cx="5.5" cy="18.5" r="1" fill="#fbbf24" opacity="0.6" />
    </g>
  );
}
// Dragon: dark scope with green crystal lens.
function DragonTelescope() {
  return (
    <g>
      <rect x="4" y="20" width="28" height="4" rx="2" fill="#475569" transform="rotate(-22 18 22)" />
      <rect x="1" y="18" width="5.5" height="5.5" rx="2.8" fill="#334155" transform="rotate(-22 3.7 20.8)" />
      <circle cx="4" cy="19" r="1.8" fill="#4ade80" opacity="0.6" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// QUILL — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: blue-tipped quill tucked behind head on right.
function PenguinQuill() {
  return (
    <g>
      <line x1="44" y1="10" x2="49" y2="24" stroke="#64748b" strokeWidth="1" />
      <path d="M44,10 Q41,14 42.5,19 Q44,15 44,10 Z" fill="#3b82f6" />
      <path d="M44,10 Q47,14 45.5,19 Q44,15 44,10 Z" fill="#60a5fa" />
      <path d="M44,8 Q43,6 44,4 Q45,6 44,8 Z" fill="#2563eb" />
      <path d="M48.5,22 L49,24 L50,22.5" fill="#1e293b" />
    </g>
  );
}
// Monkey: golden quill tucked behind ear.
function MonkeyQuill() {
  return (
    <g>
      <line x1="46" y1="8" x2="51" y2="22" stroke="#92400e" strokeWidth="1" />
      <path d="M46,8 Q43,12 44.5,17 Q46,13 46,8 Z" fill="#f59e0b" />
      <path d="M46,8 Q49,12 47.5,17 Q46,13 46,8 Z" fill="#fbbf24" />
      <path d="M46,6 Q45,4 46,2 Q47,4 46,6 Z" fill="#d97706" />
      <path d="M50.5,20 L51,22 L52,20.5" fill="#1e293b" />
    </g>
  );
}
// Phoenix: flame-feather quill — fiery colors.
function PhoenixQuill() {
  return (
    <g>
      <line x1="44" y1="8" x2="49" y2="22" stroke="#7c2d12" strokeWidth="1" />
      <path d="M44,8 Q41,12 42.5,17 Q44,13 44,8 Z" fill="#ef4444" />
      <path d="M44,8 Q47,12 45.5,17 Q44,13 44,8 Z" fill="#f97316" />
      <path d="M44,6 Q43,4 44,2 Q45,4 44,6 Z" fill="#fbbf24" />
      <path d="M48.5,20 L49,22 L50,20.5" fill="#1e293b" />
    </g>
  );
}
// Dragon: emerald quill with scale-pattern feather.
function DragonQuill() {
  return (
    <g>
      <line x1="46" y1="6" x2="52" y2="22" stroke="#14532d" strokeWidth="1" />
      <path d="M46,6 Q43,10 44.5,16 Q46,12 46,6 Z" fill="#22c55e" />
      <path d="M46,6 Q49,10 47.5,16 Q46,12 46,6 Z" fill="#4ade80" />
      <path d="M46,4 Q45,2 46,0 Q47,2 46,4 Z" fill="#16a34a" />
      <path d="M51.5,20 L52,22 L53,20.5" fill="#1e293b" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MEDAL — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

const MEDAL_STAR = "M0,-4.5 L1.2,-1.5 L4.2,-1.5 L2,0.5 L3,3.5 L0,1.8 L-3,3.5 L-2,0.5 L-4.2,-1.5 L-1.2,-1.5 Z";

// Penguin: medal on chest, blue ribbon.
function PenguinMedal() {
  return (
    <g>
      <path d="M29,28 L26,35 L29,33.5" fill="#3b82f6" />
      <path d="M35,28 L38,35 L35,33.5" fill="#3b82f6" />
      <path d="M29,28 L32,30 L35,28 L35,33.5 L32,35 L29,33.5 Z" fill="#2563eb" />
      <circle cx="32" cy="39" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.7" />
      <g transform="translate(32,39)"><path d={MEDAL_STAR} fill="#f59e0b" /></g>
    </g>
  );
}
// Monkey: medal with red ribbon, slightly lower on belly.
function MonkeyMedal() {
  return (
    <g>
      <path d="M29,30 L26,37 L29,35.5" fill="#ef4444" />
      <path d="M35,30 L38,37 L35,35.5" fill="#ef4444" />
      <path d="M29,30 L32,32 L35,30 L35,35.5 L32,37 L29,35.5 Z" fill="#dc2626" />
      <circle cx="32" cy="41" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.7" />
      <g transform="translate(32,41)"><path d={MEDAL_STAR} fill="#f59e0b" /></g>
    </g>
  );
}
// Phoenix: medal with orange ribbon, fiery gold disc.
function PhoenixMedal() {
  return (
    <g>
      <path d="M29,28 L26,35 L29,33.5" fill="#f97316" />
      <path d="M35,28 L38,35 L35,33.5" fill="#f97316" />
      <path d="M29,28 L32,30 L35,28 L35,33.5 L32,35 L29,33.5 Z" fill="#ea580c" />
      <circle cx="32" cy="39" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.7" />
      <g transform="translate(32,39)"><path d={MEDAL_STAR} fill="#ef4444" /></g>
    </g>
  );
}
// Dragon: medal with green ribbon, emerald disc.
function DragonMedal() {
  return (
    <g>
      <path d="M29,28 L26,35 L29,33.5" fill="#22c55e" />
      <path d="M35,28 L38,35 L35,33.5" fill="#22c55e" />
      <path d="M29,28 L32,30 L35,28 L35,33.5 L32,35 L29,33.5 Z" fill="#16a34a" />
      <circle cx="32" cy="39" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.7" />
      <g transform="translate(32,39)"><path d={MEDAL_STAR} fill="#4ade80" /></g>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WAND — Animal-specific (Release 3)
// ═══════════════════════════════════════════════════════════════════════

// Penguin: icy wand with blue crystal tip, held on right side.
function PenguinWand() {
  return (
    <g>
      <rect x="50" y="18" width="2.5" height="24" rx="1.2" fill="#94a3b8" transform="rotate(12 51.2 30)" />
      <rect x="49" y="38" width="4.5" height="5" rx="2" fill="#64748b" transform="rotate(12 51.2 40.5)" />
      <circle cx="50" cy="16" r="2.5" fill="#38bdf8" />
      <circle cx="47.5" cy="14" r="1" fill="#bae6fd" />
      <circle cx="52.5" cy="13.5" r="1" fill="#bae6fd" />
    </g>
  );
}
// Monkey: wooden staff with golden orb, playful.
function MonkeyWand() {
  return (
    <g>
      <rect x="50" y="16" width="3" height="26" rx="1.5" fill="#92400e" transform="rotate(12 51.5 29)" />
      <rect x="49" y="36" width="5" height="6" rx="2" fill="#78350f" transform="rotate(12 51.5 39)" />
      <circle cx="50" cy="14" r="2.5" fill="#fbbf24" />
      <circle cx="47.5" cy="12" r="1" fill="#fde68a" />
      <circle cx="52.5" cy="11.5" r="1" fill="#fde68a" />
    </g>
  );
}
// Phoenix: flame staff with fire orb.
function PhoenixWand() {
  return (
    <g>
      <rect x="50" y="16" width="2.5" height="26" rx="1.2" fill="#b45309" transform="rotate(14 51.2 29)" />
      <rect x="49" y="36" width="4.5" height="6" rx="2" fill="#92400e" transform="rotate(14 51.2 39)" />
      {/* Flame orb */}
      <circle cx="50" cy="14" r="2.5" fill="#ef4444" />
      <path d="M50,11 Q48.5,9 50,7 Q51.5,9 50,11" fill="#fbbf24" opacity="0.8" />
      <circle cx="50" cy="14" r="1.2" fill="#f97316" />
    </g>
  );
}
// Dragon: dark staff with green crystal.
function DragonWand() {
  return (
    <g>
      <rect x="50" y="16" width="3" height="26" rx="1.5" fill="#334155" transform="rotate(10 51.5 29)" />
      <rect x="49" y="36" width="5" height="6" rx="2" fill="#1e293b" transform="rotate(10 51.5 39)" />
      {/* Green crystal */}
      <path d="M51.5,10 L49,14.5 L51.5,16 L54,14.5 Z" fill="#22c55e" stroke="#15803d" strokeWidth="0.5" />
      <circle cx="49" cy="11" r="0.8" fill="#4ade80" opacity="0.7" />
      <circle cx="54" cy="11.5" r="0.8" fill="#4ade80" opacity="0.7" />
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
  backpack: {
    penguin: PenguinBackpack,
    monkey: MonkeyBackpack,
    phoenix: PhoenixBackpack,
    dragon: DragonBackpack,
  },
  book: {
    penguin: PenguinBook,
    monkey: MonkeyBook,
    phoenix: PhoenixBook,
    dragon: DragonBook,
  },
  telescope: {
    penguin: PenguinTelescope,
    monkey: MonkeyTelescope,
    phoenix: PhoenixTelescope,
    dragon: DragonTelescope,
  },
  quill: {
    penguin: PenguinQuill,
    monkey: MonkeyQuill,
    phoenix: PhoenixQuill,
    dragon: DragonQuill,
  },
  medal: {
    penguin: PenguinMedal,
    monkey: MonkeyMedal,
    phoenix: PhoenixMedal,
    dragon: DragonMedal,
  },
  wand: {
    penguin: PenguinWand,
    monkey: MonkeyWand,
    phoenix: PhoenixWand,
    dragon: DragonWand,
  },
};

function getAccessoryComponent(
  accessory: Exclude<MascotAccessory, "none">,
  mascotType: MascotAnimal
): (() => React.JSX.Element) | null {
  const animalMap = ANIMAL_SPECIFIC[accessory];
  if (animalMap) {
    return animalMap[mascotType] ?? null;
  }
  return null;
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
 * All 10 accessories have animal-specific variants for each of the 4 animals.
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
