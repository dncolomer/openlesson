"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

export default function VerifyError({
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
      title="Verification session error"
      backHref="/"
      backLabel="Go home"
    />
  );
}
