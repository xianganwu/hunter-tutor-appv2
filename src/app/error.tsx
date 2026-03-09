"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center animate-fade-in">
      <div className="mb-6 text-5xl">&#128533;</div>
      <h2 className="mb-2 text-2xl font-bold text-surface-900 dark:text-surface-100">
        Something went wrong
      </h2>
      <p className="mb-6 max-w-md text-surface-500 dark:text-surface-400">
        {error.message.includes("API") || error.message.includes("fetch")
          ? "The tutor is having trouble connecting right now. This usually fixes itself in a moment."
          : "An unexpected error occurred. Don\u2019t worry \u2014 your progress is saved."}
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
