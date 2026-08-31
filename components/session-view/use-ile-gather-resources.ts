"use client";

import { useCallback, useState } from "react";
import {
  applyIleGatherSpend,
  availableIlePowCounts,
  buildIleGatherPowArtifact,
  completeIleGatherJob,
  createIleGatherJob,
  createIleGatherJobId,
  decideIleGatherResources,
  formatIleGatherInsufficientWarning,
  patchIleGatherJob,
  refundIleGatherSpend,
  upsertIleGatherJob,
  type IleGatherJob,
} from "@/lib/ile-gather-resources";
import {
  countIlePowByType,
  emptyIlePowTypeCounts,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";
import { textToBase64, uploadIleProofOfWork } from "@/lib/ile-proof-of-work-client";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";

export function useIleGatherResources(input: {
  sessionId?: string;
  workspaceId?: string;
  blockId?: string;
  chapterId?: string | null;
  chapterDescription?: string;
  artifacts: readonly IlePowCounterArtifact[];
  recordSessionPowArtifact: (artifact: IlePowCounterArtifact) => void;
  onOpenResources: () => void;
  ileToken?: string;
  ayclToken?: string;
}) {
  const [spent, setSpent] = useState<IlePowTypeCounts>(emptyIlePowTypeCounts);
  const [gatherCount, setGatherCount] = useState(0);
  const [lastGatherAt, setLastGatherAt] = useState<number | null>(null);
  const [gatherJobs, setGatherJobs] = useState<IleGatherJob[]>([]);
  const [gatherWarning, setGatherWarning] = useState<string | null>(null);
  const [gatherBusy, setGatherBusy] = useState(false);
  const [gatheredResources, setGatheredResources] = useState<WorkspaceExternalResource[]>(
    [],
  );

  const total = countIlePowByType(input.artifacts);
  const availableCounts = availableIlePowCounts(total, spent);

  const dismissGatherWarning = useCallback(() => setGatherWarning(null), []);

  const openGatheredResources = useCallback(() => {
    input.onOpenResources();
  }, [input.onOpenResources]);

  const onGatherResources = useCallback(
    async () => {
      if (gatherBusy) return;
      const now = Date.now();
      const decision = decideIleGatherResources({
        artifacts: input.artifacts,
        spent,
        lastGatherAt,
        gatherCount,
        now,
      });
      if (!decision.allowed) {
        setGatherWarning(
          decision.warning ||
            formatIleGatherInsufficientWarning({
              reason: decision.reason === "rate_limited" ? "rate_limited" : "insufficient_pow",
            }),
        );
        return;
      }

      const jobId = createIleGatherJobId(now);
      const blockId = String(input.blockId || "").trim();
      const chapterId = input.chapterId || null;
      setGatherBusy(true);
      setGatherWarning(null);
      setSpent((prev) => applyIleGatherSpend(prev, decision.consume));
      setGatherCount((n) => n + 1);
      setLastGatherAt(now);
      setGatherJobs((jobs) =>
        upsertIleGatherJob(
          jobs,
          createIleGatherJob({
            id: jobId,
            blockId,
            label: "Gathering resources…",
          }),
        ),
      );

      const pow = buildIleGatherPowArtifact({
        jobId,
        blockId,
        chapterId,
        consume: decision.consume,
      });
      input.recordSessionPowArtifact(pow);
      if (input.workspaceId && input.sessionId) {
        void uploadIleProofOfWork({
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          type: "tool",
          mime_type: "application/json",
          data: textToBase64(JSON.stringify(pow.metadata || {})),
          file_name: "ile-gather-resources.json",
          tool_name: "gather-resources",
          tool_action: "epistemic-forage",
          metadata: (pow.metadata as Record<string, unknown>) || {},
          ileToken: input.ileToken,
        });
      }

      setGatherJobs((jobs) => patchIleGatherJob(jobs, jobId, { completed: 1 }));

      try {
        const response = await fetch("/api/ile/gather-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: input.sessionId,
            workspaceId: input.workspaceId,
            blockId,
            chapterId,
            chapterDescription: input.chapterDescription || "",
            artifacts: input.artifacts,
            spent,
            lastGatherAt,
            gatherCount,
            now,
            jobId,
            ...(input.ayclToken ? { ayclToken: input.ayclToken } : {}),
            ...(input.ileToken ? { ileToken: input.ileToken } : {}),
          }),
        });
        setGatherJobs((jobs) => patchIleGatherJob(jobs, jobId, { completed: 3 }));
        const data = (await response.json().catch(() => ({}))) as {
          warning?: string;
          error?: string;
          resources?: WorkspaceExternalResource[];
        };
        if (!response.ok) {
          setSpent((prev) => refundIleGatherSpend(prev, decision.consume));
          setGatherCount((n) => Math.max(0, n - 1));
          setGatherWarning(
            data.warning ||
              formatIleGatherInsufficientWarning({ reason: "insufficient_pow" }),
          );
          setGatherJobs((jobs) =>
            patchIleGatherJob(jobs, jobId, {
              status: "error",
              error: data.error || data.warning || "Gather failed",
            }),
          );
          return;
        }
        if (Array.isArray(data.resources) && data.resources.length > 0) {
          setGatheredResources((prev) => {
            const byId = new Map(prev.map((row) => [row.id, row]));
            for (const row of data.resources || []) {
              if (row?.id) byId.set(row.id, row);
            }
            return [...byId.values()];
          });
        }
        setGatherJobs((jobs) => completeIleGatherJob(jobs, jobId));
      } catch (err) {
        setSpent((prev) => refundIleGatherSpend(prev, decision.consume));
        setGatherCount((n) => Math.max(0, n - 1));
        setGatherJobs((jobs) =>
          patchIleGatherJob(jobs, jobId, {
            status: "error",
            error: err instanceof Error ? err.message : "Gather failed",
          }),
        );
      } finally {
        setGatherBusy(false);
      }
    },
    [
      gatherBusy,
      gatherCount,
      input,
      lastGatherAt,
      spent,
    ],
  );

  return {
    spent,
    availableCounts,
    gatherJobs,
    gatherWarning,
    gatherBusy,
    gatheredResources,
    onGatherResources,
    dismissGatherWarning,
    openGatheredResources,
  };
}
