"use client";

import { useEffect, useMemo } from "react";
import {
  useSessionBranchSlot,
  useSessionPolicyInferences,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import type { Session } from "@/lib/domain/types";
import { persistIleSessionRow } from "@/lib/learn-session-persist";
import {
  applySessionPolicyToMetadata,
  rememberSessionPolicy,
  sessionPolicyRecordFromLive,
  sessionPolicyRecordKey,
} from "@/lib/session-policy-store";

/** Writes the evolving policy onto the session row. A name is not required. */
export function SessionPolicyAutosave({
  sessionRef,
  ayclToken,
  ileToken,
}: {
  sessionRef: { current: Session | null };
  ayclToken?: string | null;
  ileToken?: string | null;
}) {
  const slot = useSessionBranchSlot();
  const inferences = useSessionPolicyInferences();
  const suggestion = useSessionPolicySuggestion();
  const record = useMemo(
    () =>
      sessionPolicyRecordFromLive({
        model: slot?.status === "ready" ? slot.model : null,
        birth: slot?.birth,
        inferences,
        suggestion,
      }),
    [inferences, slot, suggestion],
  );
  const key = record ? sessionPolicyRecordKey(record) : "";

  useEffect(() => {
    if (!record) return;
    const current = sessionRef.current;
    if (!current) return;
    const metadata = applySessionPolicyToMetadata(
      (current.metadata || {}) as Record<string, unknown>,
      record,
    );
    rememberSessionPolicy(current.id, record);
    if (metadata === current.metadata) return;
    sessionRef.current = {
      ...current,
      metadata: metadata as Session["metadata"],
    };
    void persistIleSessionRow(() => sessionRef.current, { ayclToken, ileToken }).catch(() => {
      /* The next change, or leaving, writes again. */
    });
  }, [ayclToken, ileToken, key, record, sessionRef]);

  return null;
}
