"use client";

import { SessionView } from "@/components/SessionView";

export function IleGuestSessionClient({
  sessionId,
  ileToken,
  showEndSession = true,
  entryQueryParams = {},
}: {
  sessionId: string;
  ileToken: string;
  blockTitle?: string;
  /** When false, hide End Session / stop-end chrome. Default true. */
  showEndSession?: boolean;
  /** Share URL query params → param-scoped guest identity for PoW. */
  entryQueryParams?: Record<string, string | string[]>;
}) {
  return (
    <SessionView
      sessionId={sessionId}
      ileToken={ileToken}
      showEndSession={showEndSession}
      entryQueryParams={entryQueryParams}
    />
  );
}
