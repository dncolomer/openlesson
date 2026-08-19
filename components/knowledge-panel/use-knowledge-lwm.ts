"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveModelsTabScope } from "@/lib/pow-api/models-tab-scope";
import { selectLwmHistoryRun } from "@/lib/pow-api/lwm-snapshot-history-ui";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import { explainLwmSnapshotReport } from "@/lib/pow-api/lwm-snapshot-interpretability";
import {
  consumeSnapshotAllNdjson,
  formatSnapshotAllProgress,
  initialSnapshotAllProgress,
  reduceSnapshotAllProgress,
  type SnapshotAllProgressState,
} from "@/lib/pow-api/snapshot-all-progress";
import {
  type AvailableSubject,
  type KnowledgeConfigResponse,
  type LwmSnapshotHistoryRun,
} from "@/components/knowledge-panel/widgets";
import {
  fetchKnowledgeConfig,
  mergeAvailableSubjects,
} from "@/components/knowledge-panel/knowledge-config-client";
import type {
  GoalCatalogItem,
  KnowledgeGoalMode,
  LwmDetailTab,
  SnapshotEligibility,
} from "@/components/knowledge-panel/types";

export function useKnowledgeLwm(input: {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
  canInspectOthers: boolean;
  lockSubjectToSelf: boolean;
  isOwner: boolean;
}) {
  const {
    workspaceId,
    currentUserId = null,
    ayclToken,
    canInspectOthers,
    lockSubjectToSelf,
    isOwner,
  } = input;

  const [lwmUserId, setLwmUserId] = useState("");
  const [lwmGuestUserId, setLwmGuestUserId] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotEligibility, setSnapshotEligibility] = useState<SnapshotEligibility | null>(null);
  const [goalMode, setGoalMode] = useState<KnowledgeGoalMode>("default");
  const [adhocGoal, setAdhocGoal] = useState("");
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [goalCatalog, setGoalCatalog] = useState<GoalCatalogItem[]>([]);
  const [snapshotModalMode, setSnapshotModalMode] = useState<"single" | "all" | null>(null);
  const [snapshotAllProgress, setSnapshotAllProgress] = useState<SnapshotAllProgressState>(
    () => initialSnapshotAllProgress(),
  );
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [lwmData, setLwmData] = useState<KnowledgeConfigResponse | null>(null);
  const [lwmLoading, setLwmLoading] = useState(false);
  const [lwmError, setLwmError] = useState<string | null>(null);
  const [lwmHistoryRuns, setLwmHistoryRuns] = useState<LwmSnapshotHistoryRun[]>([]);
  const [lwmHistoryLoading, setLwmHistoryLoading] = useState(false);
  const [selectedLwmRunId, setSelectedLwmRunId] = useState<string | null>(null);
  const [lwmDetailTab, setLwmDetailTab] = useState<LwmDetailTab>("profile");
  const [showScoreExplainModal, setShowScoreExplainModal] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;
    if (!lwmUserId && !lwmGuestUserId) setLwmUserId(currentUserId);
  }, [currentUserId, lwmGuestUserId, lwmUserId]);

  useEffect(() => {
    if (canInspectOthers || !currentUserId) return;
    setLwmUserId(currentUserId);
    setLwmGuestUserId("");
  }, [canInspectOthers, currentUserId]);

  const lwmScope = useMemo(
    () =>
      resolveModelsTabScope({
        mode: "user",
        currentUserId,
        targetUserId: lwmUserId || null,
        targetGuestUserId: lwmGuestUserId || null,
        canInspectOthers,
        lockSubjectToSelf,
      }),
    [
      canInspectOthers,
      currentUserId,
      lockSubjectToSelf,
      lwmGuestUserId,
      lwmUserId,
    ],
  );

  const loadSnapshotHistory = useCallback(async () => {
    setLwmHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceId,
        limit: "100",
        vertical: "verification",
      });
      if (ayclToken) params.set("ayclToken", ayclToken);
      if (lwmGuestUserId) params.set("guest_user_id", lwmGuestUserId);
      else if (lwmUserId) params.set("user_id", lwmUserId);
      else if (currentUserId) params.set("user_id", currentUserId);

      const response = await fetch(`/api/workspace/snapshot-history?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLwmHistoryRuns([]);
        return;
      }
      const runs = (Array.isArray(data.runs) ? data.runs : []).map(
        (r: Record<string, unknown>) =>
          ({
            id: String(r.id || ""),
            ran_at: String(r.ran_at || r.created_at || ""),
            score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
            ghc_score:
              r.ghc_score == null
                ? null
                : typeof r.ghc_score === "number"
                  ? r.ghc_score
                  : Number(r.ghc_score),
            report:
              r.report && typeof r.report === "object"
                ? (r.report as PerformanceReport)
                : null,
            source: typeof r.source === "string" ? r.source : undefined,
            vertical: typeof r.vertical === "string" ? r.vertical : undefined,
          }) satisfies LwmSnapshotHistoryRun,
      ).filter((r: LwmSnapshotHistoryRun) => r.id && r.ran_at);
      setLwmHistoryRuns(runs);
    } catch {
      setLwmHistoryRuns([]);
    } finally {
      setLwmHistoryLoading(false);
    }
  }, [ayclToken, currentUserId, lwmGuestUserId, lwmUserId, workspaceId]);

  const loadLwm = useCallback(async () => {
    setLwmLoading(true);
    setLwmError(null);
    try {
      const payload = await fetchKnowledgeConfig(workspaceId, ayclToken, lwmScope.query);
      setLwmData(payload);
      setAvailableSubjects((prev) => mergeAvailableSubjects(prev, payload));
      await loadSnapshotHistory();
    } catch (err) {
      setLwmError(err instanceof Error ? err.message : "Failed to load learning world model");
    } finally {
      setLwmLoading(false);
    }
  }, [ayclToken, loadSnapshotHistory, lwmScope.query, workspaceId]);

  const loadSnapshotEligibility = useCallback(async () => {
    if (!currentUserId && !lwmUserId && !lwmGuestUserId) {
      setSnapshotEligibility(null);
      return;
    }
    if (goalMode === "adhoc" && !adhocGoal.trim()) {
      setSnapshotEligibility({ allowed: true });
      return;
    }
    if (goalMode === "selected" && selectedGoalIds.length === 0) {
      setSnapshotEligibility({ allowed: true });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("workspaceId", workspaceId);
      params.set("limit", "1");
      params.set("goal_mode", goalMode);
      if (goalMode === "adhoc" && adhocGoal.trim()) {
        params.set("adhoc_goal", adhocGoal.trim());
      }
      if (goalMode === "selected" && selectedGoalIds.length > 0) {
        params.set("goal_ids", selectedGoalIds.join(","));
      }
      if (ayclToken) params.set("ayclToken", ayclToken);
      const subjectUser = lwmUserId || currentUserId;
      if (lwmGuestUserId) params.set("guest_user_id", lwmGuestUserId);
      else if (subjectUser) params.set("user_id", subjectUser);

      const response = await fetch(`/api/workspace/snapshot-history?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSnapshotEligibility({ allowed: true });
        return;
      }
      const eligibility = (data.eligibility || {}) as Record<
        string,
        { allowed?: boolean; message?: string; last_eval_at?: string | null; new_pow_count?: number | null }
      >;
      const status = eligibility.verification ?? Object.values(eligibility)[0];
      if (!status) {
        setSnapshotEligibility({ allowed: true });
        return;
      }
      setSnapshotEligibility({
        allowed: status.allowed !== false,
        message: status.message,
        last_eval_at: status.last_eval_at,
        new_pow_count: status.new_pow_count,
      });
    } catch {
      setSnapshotEligibility({ allowed: true });
    }
  }, [
    adhocGoal,
    ayclToken,
    currentUserId,
    goalMode,
    lwmGuestUserId,
    lwmUserId,
    selectedGoalIds,
    workspaceId,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ workspaceId });
        if (ayclToken) params.set("ayclToken", ayclToken);
        const res = await fetch(`/api/workspace/goals?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        const ws = Array.isArray(data.workspace_goals) ? data.workspace_goals : [];
        const bl = Array.isArray(data.block_goals) ? data.block_goals : [];
        if (cancelled) return;
        setGoalCatalog([
          ...ws.map((g: { id: string; text: string }) => ({
            id: g.id,
            text: g.text,
            scope: "workspace" as const,
            block_id: null,
          })),
          ...bl.map((g: { id: string; text: string; block_id?: string }) => ({
            id: g.id,
            text: g.text,
            scope: "block" as const,
            block_id: g.block_id ?? null,
          })),
        ]);
      } catch {
        /* non-fatal for snapshot UI */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ayclToken, workspaceId]);

  const openSnapshotModal = useCallback((mode: "single" | "all") => {
    setSnapshotError(null);
    if (mode === "all") {
      setSnapshotAllProgress(initialSnapshotAllProgress());
    }
    setSnapshotModalMode(mode);
  }, []);

  const closeSnapshotModal = useCallback(() => {
    setSnapshotModalMode(null);
  }, []);

  const generateSnapshot = useCallback(async () => {
    if (snapshotEligibility && !snapshotEligibility.allowed) {
      setSnapshotError(
        snapshotEligibility.message ||
          "No new proof of work since the last LWM Snapshot for this goal selection.",
      );
      return;
    }
    if (goalMode === "adhoc" && !adhocGoal.trim()) {
      setSnapshotError("Enter an adhoc goal, or switch to default / custom selection.");
      return;
    }
    if (goalMode === "selected" && selectedGoalIds.length === 0) {
      setSnapshotError("Select at least one workspace or block goal.");
      return;
    }
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const body: Record<string, unknown> = {
        workspaceId,
        goal_mode: goalMode,
      };
      if (ayclToken) body.ayclToken = ayclToken;
      if (lwmGuestUserId) body.guest_user_id = lwmGuestUserId;
      else if (lwmUserId) body.user_id = lwmUserId;
      if (goalMode === "adhoc") body.adhoc_goal = adhocGoal.trim();
      if (goalMode === "selected") body.goal_ids = selectedGoalIds;

      const response = await fetch("/api/workspace/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to generate LWM Snapshot",
        );
      }
      await loadLwm();
      await loadSnapshotEligibility();
      setSnapshotModalMode(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to generate LWM Snapshot");
    } finally {
      setSnapshotLoading(false);
    }
  }, [
    adhocGoal,
    ayclToken,
    goalMode,
    loadLwm,
    loadSnapshotEligibility,
    lwmGuestUserId,
    lwmUserId,
    selectedGoalIds,
    snapshotEligibility,
    workspaceId,
  ]);

  const snapshotAllRunning = snapshotAllProgress.phase === "running";
  const snapshotAllProgressText = useMemo(
    () => formatSnapshotAllProgress(snapshotAllProgress),
    [snapshotAllProgress],
  );

  const generateSnapshotAll = useCallback(async () => {
    if (!isOwner || snapshotAllRunning || snapshotLoading) return;
    if (goalMode === "adhoc" && !adhocGoal.trim()) {
      setSnapshotError("Enter an adhoc goal, or switch to default / custom selection.");
      return;
    }
    if (goalMode === "selected" && selectedGoalIds.length === 0) {
      setSnapshotError("Select at least one workspace or block goal.");
      return;
    }
    setSnapshotError(null);
    setSnapshotAllProgress(
      reduceSnapshotAllProgress(initialSnapshotAllProgress(), {
        type: "start",
        workspace_id: workspaceId,
        total: 0,
      }),
    );

    try {
      const body: Record<string, unknown> = {
        stream: true,
        goal_mode: goalMode,
      };
      if (goalMode === "adhoc") body.adhoc_goal = adhocGoal.trim();
      if (goalMode === "selected") body.goal_ids = selectedGoalIds;

      const response = await fetch(`/api/workspaces/${workspaceId}/snapshot-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to snapshot all users",
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("ndjson") && !contentType.includes("stream")) {
        const data = await response.json().catch(() => ({}));
        setSnapshotAllProgress(
          reduceSnapshotAllProgress(initialSnapshotAllProgress(), {
            type: "complete",
            workspace_id: workspaceId,
            total: Number(data.total) || 0,
            succeeded: Number(data.succeeded) || 0,
            skipped: Number(data.skipped) || 0,
            failed: Number(data.failed) || 0,
          }),
        );
        await loadLwm();
        await loadSnapshotEligibility();
        return;
      }

      if (!response.body) {
        throw new Error("No progress stream from snapshot-all");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let state = reduceSnapshotAllProgress(initialSnapshotAllProgress(), {
        type: "start",
        workspace_id: workspaceId,
        total: 0,
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const { events, rest } = consumeSnapshotAllNdjson(buffer, chunk);
        buffer = rest;
        for (const event of events) {
          state = reduceSnapshotAllProgress(state, event);
          setSnapshotAllProgress({ ...state });
        }
      }
      if (buffer.trim()) {
        const { events } = consumeSnapshotAllNdjson(buffer, "\n");
        for (const event of events) {
          state = reduceSnapshotAllProgress(state, event);
          setSnapshotAllProgress({ ...state });
        }
      }

      if (state.phase === "running") {
        state = reduceSnapshotAllProgress(state, {
          type: "complete",
          workspace_id: workspaceId,
          total: state.total,
          succeeded: state.succeeded,
          skipped: state.skipped,
          failed: state.failed,
        });
        setSnapshotAllProgress(state);
      }

      await loadLwm();
      await loadSnapshotEligibility();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to snapshot all users";
      setSnapshotAllProgress((prev) =>
        reduceSnapshotAllProgress(prev, { type: "error", error: message }),
      );
      setSnapshotError(message);
    }
  }, [
    adhocGoal,
    goalMode,
    isOwner,
    loadLwm,
    loadSnapshotEligibility,
    selectedGoalIds,
    snapshotAllRunning,
    snapshotLoading,
    workspaceId,
  ]);

  useEffect(() => {
    void loadLwm();
  }, [loadLwm]);

  useEffect(() => {
    void loadSnapshotEligibility();
  }, [loadSnapshotEligibility]);

  const wm = lwmData?.learning_world_model;
  const scores = wm?.scores_snapshot;
  const kc = lwmData?.knowledge_config;

  const selectedLwmRun = useMemo(
    () => selectLwmHistoryRun(lwmHistoryRuns, selectedLwmRunId),
    [selectedLwmRunId, lwmHistoryRuns],
  );

  useEffect(() => {
    if (!selectedLwmRun) {
      if (selectedLwmRunId) setSelectedLwmRunId(null);
      return;
    }
    if (selectedLwmRun.id !== selectedLwmRunId) {
      setSelectedLwmRunId(selectedLwmRun.id);
    }
  }, [selectedLwmRun, selectedLwmRunId]);

  useEffect(() => {
    setLwmDetailTab("profile");
  }, [selectedLwmRun?.id]);

  const selectedRunReport = useMemo(() => {
    const report = selectedLwmRun?.report;
    return report && typeof report === "object" ? (report as PerformanceReport) : null;
  }, [selectedLwmRun]);

  const displaySnapScore =
    selectedLwmRun != null
      ? Math.round(selectedLwmRun.score)
      : scores?.verification_score != null
        ? Math.round(scores.verification_score)
        : null;
  const displayGhcScore =
    selectedLwmRun != null
      ? selectedLwmRun.ghc_score != null
        ? Math.round(selectedLwmRun.ghc_score)
        : null
      : scores?.ghc_score != null
        ? Math.round(scores.ghc_score)
        : null;

  const lwmExplanation = useMemo(() => {
    if (selectedRunReport) {
      return explainLwmSnapshotReport({
        ...selectedRunReport,
        score: displaySnapScore ?? selectedRunReport.score,
        ghc_score: displayGhcScore ?? selectedRunReport.ghc_score,
      });
    }
    if (displaySnapScore != null || displayGhcScore != null) {
      return explainLwmSnapshotReport({
        score: displaySnapScore ?? undefined,
        ghc_score: displayGhcScore ?? undefined,
        summary:
          typeof wm?.inferred_goal?.text === "string" ? wm.inferred_goal.text : undefined,
      });
    }
    return null;
  }, [selectedRunReport, displaySnapScore, displayGhcScore, wm?.inferred_goal?.text]);

  const lwmUpdatedLabel = useMemo(() => {
    const iso = selectedLwmRun?.ran_at || wm?.updated_at || kc?.as_of || null;
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return iso;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ms));
    } catch {
      return iso;
    }
  }, [kc?.as_of, selectedLwmRun?.ran_at, wm?.updated_at]);

  return {
    adhocGoal,
    availableSubjects,
    closeSnapshotModal,
    displayGhcScore,
    displaySnapScore,
    generateSnapshot,
    generateSnapshotAll,
    goalCatalog,
    goalMode,
    isOwner,
    kc,
    lwmDetailTab,
    lwmError,
    lwmExplanation,
    lwmGuestUserId,
    lwmHistoryLoading,
    lwmHistoryRuns,
    lwmLoading,
    lwmScope,
    lwmUpdatedLabel,
    lwmUserId,
    openSnapshotModal,
    selectedGoalIds,
    selectedLwmRun,
    selectedRunReport,
    setAdhocGoal,
    setGoalMode,
    setLwmDetailTab,
    setLwmGuestUserId,
    setLwmUserId,
    setSelectedGoalIds,
    setSelectedLwmRunId,
    setShowScoreExplainModal,
    setSnapshotModalMode,
    showScoreExplainModal,
    snapshotAllProgress,
    snapshotAllProgressText,
    snapshotAllRunning,
    snapshotEligibility,
    snapshotError,
    snapshotLoading,
    snapshotModalMode,
    wm,
  };
}
