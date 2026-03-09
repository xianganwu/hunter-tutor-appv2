"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-4 text-center">
        <div className="mb-6 text-5xl">&#128533;</div>
        <h2 className="mb-2 text-2xl font-bold text-surface-900">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-md text-surface-500">
          The app ran into an unexpected error. Please try refreshing the page.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
