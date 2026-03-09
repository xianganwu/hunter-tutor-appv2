"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        Something went wrong
      </h2>
      <p className="mb-6 max-w-md text-gray-600">
        {error.message.includes("API") || error.message.includes("fetch")
          ? "The tutor is having trouble connecting right now. This usually fixes itself in a moment."
          : "An unexpected error occurred. Don\u2019t worry \u2014 your progress is saved."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
