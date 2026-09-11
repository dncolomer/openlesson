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
  dismissIleGatherJob,
  dismissIleGatherReadyJobsForTile,
  formatIleGatherInsufficientWarning,
  ileGatherRateLimitKey,
  patchIleGatherJob,
  refundIleGatherSpend,
  resolveIleGatherPersistIds,
  upsertIleGatherJob,
  type IleGatherJob,
} from "@/lib/ile-gather-resources";
import {
  countIlePowByType,
  countIleSpokenThoughts,
  emptyIlePowTypeCounts,
  ilePowCounterTotal,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";
import {
  applyIlePowSpend,
  decideIleWorkStart,
  ILE_POW_EXPENSE_DEFAULT,
  type IleWorkStartDecision,
} from "@/lib/ile-pow-spend";
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
  expense?: unknown;
  maxPerSession?: unknown;
  allowGatherResources?: boolean;
  allowParallelWork?: boolean;
}) {
  const [spent, setSpent] = useState<IlePowTypeCounts>(emptyIlePowTypeCounts);
  const [spentUnits, setSpentUnits] = useState(0);
  const [gatherCount, setGatherCount] = useState(0);
  const [lastGatherAt, setLastGatherAt] = useState<number | null>(null);
  const [gatherJobs, setGatherJobs] = useState<IleGatherJob[]>([]);
  const [gatherWarning, setGatherWarning] = useState<string | null>(null);
  const [lastGatherKey, setLastGatherKey] = useState<string | null>(null);
  const [gatheredResources, setGatheredResources] = useState<WorkspaceExternalResource[]>(
    [],
  );

  const total = countIlePowByType(input.artifacts);
  const availableCounts = availableIlePowCounts(total, spent);

  const dismissGatherWarning = useCallback(() => setGatherWarning(null), []);

  const openGatheredResources = useCallback(
    (opts?: { jobId?: string | null; tileId?: string | null }) => {
      setGatherJobs((jobs) => {
        if (opts?.jobId) return dismissIleGatherJob(jobs, opts.jobId);
        if (opts?.tileId) return dismissIleGatherReadyJobsForTile(jobs, opts.tileId);
        return jobs;
      });
      input.onOpenResources();
    },
    [input],
  );

  const onGatherResources = useCallback(
    async (opts?: {
      blockId?: string | null;
      chapterId?: string | null;
      chapterDescription?: string | null;
    }) => {
      const persistIds = resolveIleGatherPersistIds({
        workspaceBlockId: opts?.blockId ?? input.blockId,
        chapterId: opts?.chapterId ?? input.chapterId,
      });
      const rateLimitKey = ileGatherRateLimitKey({
        chapterId: persistIds.chapterId,
        blockId: persistIds.blockId,
      });
      const now = Date.now();
      const decision = decideIleGatherResources({
        artifacts: input.artifacts,
        spent,
        lastGatherAt,
        gatherCount,
        now,
        rateLimitKey,
        lastGatherKey,
        expense: input.expense ?? ILE_POW_EXPENSE_DEFAULT,
        maxPerSession: input.maxPerSession,
        allowGatherResources: input.allowGatherResources,
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
      const blockId = persistIds.blockId;
      const chapterId = persistIds.chapterId || null;
      const chapterDescription =
        opts?.chapterDescription ?? input.chapterDescription ?? "";
      setGatherWarning(null);
      setSpent((prev) => applyIleGatherSpend(prev, decision.consume));
      setSpentUnits((n) => n + ilePowCounterTotal(decision.consume));
      setGatherCount((n) => n + 1);
      setLastGatherAt(now);
      setLastGatherKey(rateLimitKey || null);
      setGatherJobs((jobs) =>
        upsertIleGatherJob(
          jobs,
          createIleGatherJob({
            id: jobId,
            blockId,
            chapterId,
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
            chapterDescription,
            artifacts: input.artifacts,
            spent,
            lastGatherAt,
            gatherCount,
            now,
            jobId,
            rateLimitKey,
            lastGatherKey,
            expense: input.expense ?? ILE_POW_EXPENSE_DEFAULT,
            maxPerSession: input.maxPerSession,
            allowGatherResources: input.allowGatherResources,
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
          setSpentUnits((n) => Math.max(0, n - ilePowCounterTotal(decision.consume)));
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
        setSpentUnits((n) => Math.max(0, n - ilePowCounterTotal(decision.consume)));
        setGatherCount((n) => Math.max(0, n - 1));
        setGatherJobs((jobs) =>
          patchIleGatherJob(jobs, jobId, {
            status: "error",
            error: err instanceof Error ? err.message : "Gather failed",
          }),
        );
      }
    },
    [
      gatherCount,
      input,
      lastGatherAt,
      lastGatherKey,
      spent,
    ],
  );

  const gatherBusy = gatherJobs.some((job) => job.status === "running");

  const tryStartWork = useCallback(
    (chapterId: string, openWorkIds: readonly string[]): IleWorkStartDecision => {
      const decision = decideIleWorkStart({
        chapterId,
        openWorkIds,
        available: availableCounts,
        thoughts: countIleSpokenThoughts(input.artifacts),
        spentUnits,
        spentTyped: spent,
        expense: input.expense ?? ILE_POW_EXPENSE_DEFAULT,
        allowParallelWork: input.allowParallelWork,
      });
      if (!decision.allowed) {
        setGatherWarning(decision.warning);
        return decision;
      }
      if (decision.consumeUnits > 0) {
        setSpent((prev) => applyIlePowSpend(prev, decision.consume));
        setSpentUnits((n) => n + decision.consumeUnits);
        setGatherWarning(null);
      }
      return decision;
    },
    [availableCounts, input.allowParallelWork, input.artifacts, input.expense, spent, spentUnits],
  );

  return {
    spent,
    spentUnits,
    availableCounts,
    gatherJobs,
    gatherWarning,
    gatherBusy,
    gatheredResources,
    onGatherResources,
    dismissGatherWarning,
    openGatheredResources,
    tryStartWork,
  };
}
