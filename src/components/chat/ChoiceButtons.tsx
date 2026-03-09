"use client";

import { useState } from "react";

interface ChoiceButtonsProps {
  readonly choices: readonly string[];
  readonly onSelect: (choice: string) => void;
  readonly disabled: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (choice: string, letter: string) => {
    setSelected(choice);
    onSelect(letter);
  };

  return (
    <div className="space-y-2 my-3" role="group" aria-label="Answer choices">
      {choices.map((choice, index) => {
        const letter = choice.charAt(0);
        const displayLetter = LETTERS[index] ?? letter;
        const isSelected = selected === choice;

        return (
          <button
            key={choice}
            onClick={() => handleSelect(choice, letter)}
            disabled={disabled}
            className={`w-full text-left rounded-xl border-2 min-h-[56px] px-4 py-3 text-body text-surface-900 dark:text-surface-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 flex items-center gap-3 ${
              isSelected
                ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-600/20"
                : "border-surface-200 bg-surface-0 dark:border-surface-700 dark:bg-surface-900 hover:border-brand-300 hover:bg-brand-50 dark:hover:border-brand-500/30 dark:hover:bg-brand-600/10"
            }`}
            aria-label={`Select answer ${choice}`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                isSelected
                  ? "bg-brand-600 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300"
              }`}
            >
              {displayLetter}
            </span>
            <span>{choice.slice(choice.indexOf(")") + 1).trim() || choice.slice(2).trim() || choice}</span>
          </button>
        );
      })}
    </div>
  );
}
