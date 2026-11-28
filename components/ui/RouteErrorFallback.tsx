"use client";

import { useEffect } from "react";
import Link from "next/link";

export type RouteErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  backHref?: string;
  backLabel?: string;
};

export function RouteErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  backHref = "/",
  backLabel = "Go home",
}: RouteErrorFallbackProps) {
  useEffect(() => {
    console.error("[RouteErrorFallback]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-md border border-white/30 bg-black p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
          Unexpected error
        </p>
        <h1 className="mt-2 text-lg font-medium text-white">{title}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          An unexpected error occurred while rendering this view. You can retry without losing your session.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-neutral-500">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-white bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-black hover:bg-neutral-200"
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="border border-white/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white hover:border-white"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
