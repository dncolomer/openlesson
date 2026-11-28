"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md border border-white/30 bg-black p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Application error
            </p>
            <h1 className="mt-2 text-lg font-medium text-white">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              The application encountered an unexpected error. Try reloading this page.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-[11px] text-neutral-500">
                Reference: {error.digest}
              </p>
            ) : null}
            <div className="mt-6">
              <button
                type="button"
                onClick={reset}
                className="border border-white bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-black hover:bg-neutral-200"
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
