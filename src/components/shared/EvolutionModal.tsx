"use client";

import { useState, useCallback, useEffect } from "react";
import { Mascot, getMascotLabel, type MascotAnimal } from "./Mascot";
import { MascotWithAccessory } from "./MascotWithAccessory";
import { MascotNameInput } from "./MascotNameInput";
import { MascotPicker } from "./MascotPicker";
import { AccessoryOverlay } from "./MascotAccessories";
import {
  loadMascotCustomization,
  saveMascotCustomization,
  type MascotAccessory,
} from "@/lib/achievements";

// ─── Accessory metadata ─────────────────────────────────────────────

const ACCESSORY_NAMES: Record<Exclude<MascotAccessory, "none">, string> = {
  party_hat: "Party Hat",
  star_badge: "Star Badge",
  graduation_cap: "Graduation Cap",
  cape: "Hero Cape",
  backpack: "Explorer Backpack",
  book: "Book of Knowledge",
  telescope: "Spyglass",
  quill: "Writer's Quill",
  medal: "Practice Medal",
  wand: "Scholar's Wand",
};

/** Maps each accessory to its unlock description and triggering badge ID. */
const ACCESSORY_UNLOCK_INFO: Record<
  Exclude<MascotAccessory, "none">,
  { badgeId: string; description: string }
> = {
  party_hat: {
    badgeId: "streak_3",
    description: "Earn a 3-day practice streak",
  },
  star_badge: {
    badgeId: "century_club",
    description: "Answer 100 questions total",
  },
  graduation_cap: {
    badgeId: "scholar",
    description: "Reach tier 4 with your mascot",
  },
  cape: {
    badgeId: "champion",
    description: "Reach tier 5 — the highest level!",
  },
  backpack: {
    badgeId: "first_assessment",
    description: "Complete your first assessment",
  },
  book: {
    badgeId: "vocab_collector",
    description: "Master 10 vocabulary words",
  },
  telescope: {
    badgeId: "reading_explorer",
    description: "Practice all reading skill categories",
  },
  quill: {
    badgeId: "first_essay",
    description: "Write your first essay",
  },
  medal: {
    badgeId: "first_simulation",
    description: "Complete a full practice exam",
  },
  wand: {
    badgeId: "math_builder",
    description: "Reach tier 3+ in all math skills",
  },
};

const ALL_ACCESSORIES: Exclude<MascotAccessory, "none">[] = [
  "party_hat",
  "star_badge",
  "graduation_cap",
  "cape",
  "backpack",
  "book",
  "telescope",
  "quill",
  "medal",
  "wand",
];

const TIER_THRESHOLDS: readonly string[] = [
  "",
  "0–20%",
  "20–40%",
  "40–60%",
  "60–80%",
  "80–100%",
];

// ─── Props ──────────────────────────────────────────────────────────

interface EvolutionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly mascotType: MascotAnimal;
  readonly currentTier: 1 | 2 | 3 | 4 | 5;
  readonly overallMastery: number;
  readonly onMascotChange: (newType: MascotAnimal) => void;
  /** Current mascot name, null if not yet named. */
  readonly mascotName?: string | null;
  /** Called when the student saves a new name. */
  readonly onNameSave?: (name: string) => void;
  /** Whether the student is allowed to name their mascot (has earned a badge). */
  readonly canName?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function EvolutionModal({
  isOpen,
  onClose,
  mascotType,
  currentTier,
  overallMastery,
  onMascotChange,
  mascotName = null,
  onNameSave,
  canName = false,
}: EvolutionModalProps) {
  const [customization, setCustomization] = useState(() =>
    loadMascotCustomization(),
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [showMascotPicker, setShowMascotPicker] = useState(false);

  // Reload customization when modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomization(loadMascotCustomization());
      setIsEditingName(false);
      setShowMascotPicker(false);
    }
  }, [isOpen]);

  const handleEquip = useCallback(
    (accessory: MascotAccessory) => {
      if (accessory === "none") return;
      if (!customization.unlocked.includes(accessory)) return;

      const next = {
        ...customization,
        equipped:
          customization.equipped === accessory ? ("none" as const) : accessory,
      };
      saveMascotCustomization(next);
      setCustomization(next);
    },
    [customization],
  );

  const handleNameSave = useCallback(
    (name: string) => {
      setIsEditingName(false);
      onNameSave?.(name);
    },
    [onNameSave],
  );

  const handleMascotSelect = useCallback(
    (newType: MascotAnimal) => {
      onMascotChange(newType);
      setShowMascotPicker(false);
    },
    [onMascotChange],
  );

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tierLabel = getMascotLabel(currentTier, mascotType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Mascot evolution preview"
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface-0 shadow-xl animate-scale-in dark:bg-surface-900 max-h-[85vh] overflow-y-auto">
        {/* ── Close button ── */}
        <div className="sticky top-0 z-10 flex justify-end bg-surface-0 p-3 pb-0 dark:bg-surface-900">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:text-surface-500 dark:hover:bg-surface-800 dark:hover:text-surface-300"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {/* ── A. Header: Current mascot with name ── */}
          <section className="flex flex-col items-center gap-3">
            <MascotWithAccessory
              tier={currentTier}
              size="xl"
              mascotType={mascotType}
              accessory={customization.equipped}
            />

            {/* Name display / edit */}
            {isEditingName ? (
              <div className="w-full max-w-xs">
                <MascotNameInput
                  currentName={mascotName}
                  onSave={handleNameSave}
                  onCancel={() => setIsEditingName(false)}
                />
              </div>
            ) : mascotName ? (
              <button
                onClick={() => setIsEditingName(true)}
                className="group flex items-center gap-1.5 text-lg font-bold text-surface-800 transition-colors hover:text-brand-600 dark:text-surface-100 dark:hover:text-brand-400"
                title="Edit name"
              >
                <span>
                  {mascotName} the {tierLabel}
                </span>
                {/* Pencil icon */}
                <svg
                  className="h-4 w-4 text-surface-400 transition-colors group-hover:text-brand-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
              </button>
            ) : canName ? (
              <button
                onClick={() => setIsEditingName(true)}
                className="rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/40"
              >
                Name your mascot!
              </button>
            ) : (
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
                {tierLabel}
              </p>
            )}

            {/* Change mascot link */}
            {showMascotPicker ? (
              <div className="w-full max-w-sm">
                <MascotPicker
                  currentMascot={mascotType}
                  onSelect={handleMascotSelect}
                  onClose={() => setShowMascotPicker(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowMascotPicker(true)}
                className="text-xs text-surface-400 underline transition-colors hover:text-brand-500 dark:text-surface-500 dark:hover:text-brand-400"
              >
                Change mascot
              </button>
            )}
          </section>

          {/* ── B. Tier Roadmap ── */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                Evolution Path
              </h3>
              <span className="text-xs text-surface-400 dark:text-surface-500">
                Mastery: {Math.round(overallMastery * 100)}%
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {([1, 2, 3, 4, 5] as const).map((tier) => {
                const isCurrent = tier === currentTier;
                const isPast = tier < currentTier;
                const isFuture = tier > currentTier;
                const label = getMascotLabel(tier, mascotType);

                return (
                  <div
                    key={tier}
                    className={`flex min-w-[5.5rem] flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all ${
                      isCurrent
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500 dark:border-brand-400 dark:bg-brand-900/20 dark:ring-brand-400"
                        : isPast
                          ? "border-success-200 bg-success-50 dark:border-success-700 dark:bg-success-900/20"
                          : "border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800"
                    } ${isFuture ? "opacity-50" : ""}`}
                  >
                    <div className="relative">
                      <Mascot tier={tier} size="md" mascotType={mascotType} />
                      {isPast && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success-500 text-white">
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? "text-brand-700 dark:text-brand-300"
                          : isPast
                            ? "text-success-700 dark:text-success-300"
                            : "text-surface-500 dark:text-surface-400"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] text-surface-400 dark:text-surface-500">
                      {TIER_THRESHOLDS[tier]}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-brand-500">
                        You are here
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── C. Accessory Wardrobe ── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-surface-700 dark:text-surface-200">
              Accessories
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_ACCESSORIES.map((accessoryId) => {
                const isUnlocked =
                  customization.unlocked.includes(accessoryId);
                const isEquipped = customization.equipped === accessoryId;
                const unlockInfo = ACCESSORY_UNLOCK_INFO[accessoryId];
                const name = ACCESSORY_NAMES[accessoryId];

                return (
                  <button
                    key={accessoryId}
                    onClick={() => isUnlocked && handleEquip(accessoryId)}
                    disabled={!isUnlocked}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                      isEquipped
                        ? "border-brand-500 bg-brand-50 shadow-sm dark:border-brand-400 dark:bg-brand-900/20"
                        : isUnlocked
                          ? "border-surface-200 bg-surface-0 hover:border-brand-300 hover:bg-brand-50/50 dark:border-surface-600 dark:bg-surface-800 dark:hover:border-brand-500 dark:hover:bg-brand-900/10"
                          : "cursor-default border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-850"
                    } focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 dark:focus:ring-offset-surface-900`}
                    aria-label={
                      isEquipped
                        ? `${name} (equipped) — click to unequip`
                        : isUnlocked
                          ? `Equip ${name}`
                          : `${name} (locked) — ${unlockInfo.description}`
                    }
                  >
                    {/* Accessory preview circle */}
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full ${
                        isUnlocked
                          ? "bg-surface-100 dark:bg-surface-700"
                          : "bg-surface-100 grayscale opacity-40 dark:bg-surface-700"
                      }`}
                    >
                      <div className="h-10 w-10">
                        <AccessoryOverlay
                          accessory={accessoryId}
                          mascotType={mascotType}
                        />
                      </div>
                    </div>

                    {/* Name */}
                    <span
                      className={`text-xs font-medium ${
                        isEquipped
                          ? "text-brand-700 dark:text-brand-300"
                          : isUnlocked
                            ? "text-surface-700 dark:text-surface-200"
                            : "text-surface-400 dark:text-surface-500"
                      }`}
                    >
                      {name}
                    </span>

                    {/* Equipped indicator or lock info */}
                    {isEquipped ? (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-brand-500">
                        Equipped
                      </span>
                    ) : !isUnlocked ? (
                      <span className="flex items-center gap-1 text-[10px] text-surface-400 dark:text-surface-500">
                        {/* Lock icon */}
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-center leading-tight">
                          {unlockInfo.description}
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── D. Footer ── */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
