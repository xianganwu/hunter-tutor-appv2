"use client";

import { useState } from "react";
import { Mascot, type MascotAnimal } from "./Mascot";

const MASCOT_OPTIONS: { type: MascotAnimal; label: string }[] = [
  { type: "penguin", label: "Penguin" },
  { type: "monkey", label: "Monkey" },
  { type: "phoenix", label: "Phoenix" },
  { type: "dragon", label: "Dragon" },
];

interface MascotPickerProps {
  readonly currentMascot: MascotAnimal;
  readonly onSelect: (mascot: MascotAnimal) => void;
  readonly onClose: () => void;
}

export function MascotPicker({ currentMascot, onSelect, onClose }: MascotPickerProps) {
  const [selected, setSelected] = useState<MascotAnimal>(currentMascot);
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-lg dark:border-surface-700 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
          Choose Your Mascot
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MASCOT_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setSelected(type)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition-all ${
              selected === type
                ? "border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20"
                : "border-surface-200 bg-surface-50 hover:border-brand-300 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-brand-500"
            }`}
          >
            <Mascot tier={1} size="md" mascotType={type} />
            <span className={`text-xs font-medium ${
              selected === type
                ? "text-brand-700 dark:text-brand-300"
                : "text-surface-500 dark:text-surface-400"
            }`}>
              {label}
            </span>
          </button>
        ))}
      </div>
      {selected !== currentMascot && (
        <button
          onClick={() => {
            setSaving(true);
            onSelect(selected);
          }}
          disabled={saving}
          className="mt-3 w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      )}
    </div>
  );
}
