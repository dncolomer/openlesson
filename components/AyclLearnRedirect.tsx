"use client";

import { useEffect } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

/**
 * Full navigation replace so /learn/[token] never throws next/navigation
 * redirect() or notFound() — those abort the RSC tree and crash Next 16
 * Turbopack with Performance.measure negative timestamps.
 */
export function AyclLearnRedirect({ href }: { href: string }) {
  useEffect(() => {
    if (!href) return;
    window.location.replace(href);
  }, [href]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#0a0a0a]"
      data-aycl-learn-redirect={href}
    >
      <LoadingStatusMessage message="Opening course…" />
    </div>
  );
}

export function AyclLearnInvalidLink() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6"
      data-aycl-learn-invalid
    >
      <p className="max-w-md text-center text-sm text-neutral-400">
        Invalid or expired access link.
      </p>
    </div>
  );
}
