"use client";

interface ChoiceButtonsProps {
  readonly choices: readonly string[];
  readonly onSelect: (choice: string) => void;
  readonly disabled: boolean;
}

export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  return (
    <div className="space-y-2 my-3" role="group" aria-label="Answer choices">
      {choices.map((choice) => {
        const letter = choice.charAt(0);
        return (
          <button
            key={choice}
            onClick={() => onSelect(letter)}
            disabled={disabled}
            className="w-full text-left rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-400 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Select answer ${choice}`}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
