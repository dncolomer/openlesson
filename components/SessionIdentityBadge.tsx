"use client";

import type { PowParticipantIdentity } from "@/lib/session-participant-identity";

/**
 * Small chrome badge showing which subject this TAP/ILE session attributes PoW to.
 */
export function SessionIdentityBadge({
  identity,
  className = "",
}: {
  identity: PowParticipantIdentity | null | undefined;
  className?: string;
}) {
  if (!identity) return null;

  const isGuest = identity.kind === "guest";
  const idPart = identity.shortId ? ` · ${identity.shortId}` : "";

  return (
    <div
      data-session-identity-badge
      data-identity-kind={identity.kind}
      title={
        isGuest
          ? `Proof of work is attributed to guest ${identity.guestUserId || "unknown"}`
          : `Proof of work is attributed to signed-in user ${identity.userId || "unknown"}`
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
        isGuest
          ? "border-cyan-400/35 bg-cyan-950/50 text-cyan-100/90"
          : "border-neutral-600 bg-neutral-900/80 text-neutral-300"
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isGuest ? "bg-cyan-300" : "bg-emerald-400"}`}
        aria-hidden
      />
      <span>
        {identity.badgeLabel}
        {idPart}
      </span>
    </div>
  );
}
