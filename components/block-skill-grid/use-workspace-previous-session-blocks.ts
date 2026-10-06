"use client";

import { useEffect, useState } from "react";
import { fetchWorkspaceBlocksWithPreviousSessions } from "@/lib/block-previous-sessions";

/** Workspace map only: block ids with at least one saved previous session. */
export function useWorkspacePreviousSessionBlockIds(input: {
  workspaceId?: string;
  ayclToken?: string;
  ileToken?: string;
}): Set<string> {
  const { workspaceId, ayclToken, ileToken } = input;
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const id = String(workspaceId || "").trim();
    if (!id) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchWorkspaceBlocksWithPreviousSessions(id, {
      ...(ayclToken ? { ayclToken } : {}),
      ...(ileToken ? { ileToken } : {}),
    })
      .then((blockIds) => {
        if (!cancelled) setIds(new Set(blockIds));
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, ayclToken, ileToken]);

  return ids;
}
