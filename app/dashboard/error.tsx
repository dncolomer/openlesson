"use client";

import { RouteErrorFallback } from "@/components/ui/RouteErrorFallback";

export default function DashboardError({
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
      title="Dashboard error"
      backHref="/dashboard"
      backLabel="Reload dashboard"
    />
  );
}
