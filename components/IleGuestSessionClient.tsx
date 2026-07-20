"use client";

import { SessionView } from "@/components/SessionView";

export function IleGuestSessionClient({
  sessionId,
  ileToken,
}: {
  sessionId: string;
  ileToken: string;
  blockTitle?: string;
}) {
  return <SessionView sessionId={sessionId} ileToken={ileToken} />;
}
