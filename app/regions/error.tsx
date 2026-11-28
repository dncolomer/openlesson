"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

export default function RegionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      title="Knowledge Region error"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
