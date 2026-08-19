"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadMapSelfProgressIds,
  MAP_SELF_PROGRESS_EVENT,
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
  mapSelfProgressStorageKey,
} from "@/lib/map-self-progress";

export function useMapSelfProgress(input: {
  resolvedLearnerScope: string;
  suggestMode: "block" | "chapter";
  sessionId?: string;
  workspaceId?: string;
  focusedNodeId?: string | null;
}) {
  const { resolvedLearnerScope, suggestMode, sessionId, workspaceId, focusedNodeId } =
    input;

  const selfProgressScope = useMemo(
    () =>
      resolveMapSelfProgressScope({
        userId: resolvedLearnerScope,
        kind: suggestMode === "chapter" ? "chapter" : "workspace",
        scopeId: suggestMode === "chapter" ? sessionId : workspaceId,
      }),
    [resolvedLearnerScope, suggestMode, sessionId, workspaceId],
  );
  const [workedOnIds, setWorkedOnIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selfProgressScope) {
      setWorkedOnIds(new Set());
      return;
    }
    setWorkedOnIds(new Set(loadMapSelfProgressIds(selfProgressScope)));
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; ids?: string[] }>).detail;
      if (!detail || detail.key !== mapSelfProgressStorageKey(selfProgressScope)) {
        return;
      }
      setWorkedOnIds(new Set(Array.isArray(detail.ids) ? detail.ids : []));
    };
    window.addEventListener(MAP_SELF_PROGRESS_EVENT, onChange);
    return () => window.removeEventListener(MAP_SELF_PROGRESS_EVENT, onChange);
  }, [selfProgressScope]);

  useEffect(() => {
    if (suggestMode !== "chapter" || !selfProgressScope) return;
    const chapterId = String(focusedNodeId || "").trim();
    if (!chapterId) return;
    setWorkedOnIds(new Set(recordMapItemWorkedOn(selfProgressScope, chapterId)));
  }, [suggestMode, focusedNodeId, selfProgressScope]);

  return { selfProgressScope, workedOnIds };
}
