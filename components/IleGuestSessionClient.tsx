"use client";

import { SessionView } from "@/components/SessionView";

export function IleGuestSessionClient({
  sessionId,
  ileToken,
  showEndSession = true,
}: {
  sessionId: string;
  ileToken: string;
  blockTitle?: string;
  /** When false, hide End Session / stop-end chrome. Default true. */
  showEndSession?: boolean;
}) {
  return (
    <SessionView
      sessionId={sessionId}
      ileToken={ileToken}
      showEndSession={showEndSession}
    />
  );
}
