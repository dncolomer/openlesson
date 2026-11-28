"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

export default function SessionError({
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
      title="Session error"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
