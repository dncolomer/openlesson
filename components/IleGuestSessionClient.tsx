"use client";

import { SessionView } from "@/components/SessionView";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import {
  ILE_SESSION_MODE_DEFAULT,
  normalizeIleSessionMode,
  type IleSessionMode,
} from "@/lib/ile-mode";

export function IleGuestSessionClient({
  sessionId,
  ileToken,
  showEndSession = true,
  entryQueryParams,
  participantIdentity = null,
  sessionMode = ILE_SESSION_MODE_DEFAULT,
}: {
  sessionId: string;
  ileToken: string;
  blockTitle?: string;
  /** When false, hide End Session / stop-end chrome. Default true. */
  showEndSession?: boolean;
  /** Share URL query params → param-scoped guest identity for PoW. */
  entryQueryParams?: Record<string, string | string[]>;
  participantIdentity?: PowParticipantIdentity | null;
  /** learning (default) | project — from durable ILE link. */
  sessionMode?: IleSessionMode | string;
}) {
  const mode = normalizeIleSessionMode(sessionMode, ILE_SESSION_MODE_DEFAULT);
  return (
    <SessionView
      sessionId={sessionId}
      ileToken={ileToken}
      showEndSession={showEndSession}
      entryQueryParams={entryQueryParams}
      participantIdentity={participantIdentity}
      sessionMode={mode}
    />
  );
}
