"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadMapSelfProgressIds,
  MAP_SELF_PROGRESS_EVENT,
  resolveMapSelfProgressScope,
  mapSelfProgressStorageKey,
} from "@/lib/map-self-progress";

export function useMapSelfProgress(input: {
  resolvedLearnerScope: string;
  workspaceId?: string;
}) {
  const { resolvedLearnerScope, workspaceId } = input;

  const selfProgressScope = useMemo(
    () =>
      resolveMapSelfProgressScope({
        userId: resolvedLearnerScope,
        kind: "workspace",
        scopeId: workspaceId,
      }),
    [resolvedLearnerScope, workspaceId],
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

  return { selfProgressScope, workedOnIds };
}
