"use client";

import { useState, useCallback } from "react";

interface MascotNameInputProps {
  readonly currentName: string | null;
  readonly onSave: (name: string) => void;
  readonly onCancel?: () => void;
}

const NAME_PATTERN = /^[a-zA-Z0-9 ]+$/;
const MAX_NAME_LENGTH = 20;

export function MascotNameInput({ currentName, onSave, onCancel }: MascotNameInputProps) {
  const [name, setName] = useState(currentName ?? "");
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return "Name cannot be empty";
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (!NAME_PATTERN.test(trimmed)) {
      return "Only letters, numbers, and spaces allowed";
    }
    return null;
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSave(trimmed);
  }, [name, validate, onSave]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_NAME_LENGTH) {
      setName(value);
      if (error) setError(null);
    }
  }, [error]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  }, [handleSave, onCancel]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Name your mascot..."
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          className="flex-1 rounded-xl border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-surface-800 placeholder-surface-400 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100 dark:placeholder-surface-500 dark:focus:border-brand-500 dark:focus:ring-brand-800"
          aria-label="Mascot name"
          aria-describedby={error ? "mascot-name-error" : undefined}
          aria-invalid={error ? "true" : undefined}
        />
        <button
          onClick={handleSave}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
        >
          Save
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 focus:outline-none focus:ring-2 focus:ring-surface-300 focus:ring-offset-2 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:focus:ring-offset-surface-900"
          >
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p
          id="mascot-name-error"
          className="text-xs text-red-500 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-surface-400 dark:text-surface-500">
        {name.trim().length}/{MAX_NAME_LENGTH} characters
      </p>
    </div>
  );
}
