"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  simulateInsightsClickStartsNewJob,
  simulateInsightsPollBudgetMs,
} from "@/lib/simulate-insights";

type InsightCandidate = { id: string; title: string; body: string };

type KeptInsight = InsightCandidate & { removed?: boolean };

/**
 * Starts a Simulate Insights job, then reads the finished candidates.
 * The start response is only the job id. Insights come from a later read.
 */
export function SimulateInsightsSurface({
  workspaceId,
  ayclToken,
  scope,
  blockId,
  blockIds,
  origin,
  autoDeposit = false,
}: {
  workspaceId?: string | null;
  ayclToken?: string | null;
  scope: "block" | "workspace" | "multi_block";
  blockId?: string;
  blockIds?: string[];
  origin: Record<string, unknown>;
  autoDeposit?: boolean;
}) {
  const [modifierPrompt, setModifierPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "waiting" | "done" | "failed">("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightCandidate[]>([]);
  const [kept, setKept] = useState<KeptInsight[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadKept = useCallback(async () => {
    if (!workspaceId) return;
    const qs = new URLSearchParams({ workspaceId });
    if (ayclToken) qs.set("ayclToken", ayclToken);
    const res = await fetch(`/api/workspace/simulation-collection?${qs}`);
    const data = (await res.json().catch(() => ({}))) as {
      items?: KeptInsight[];
      error?: string;
    };
    if (!res.ok) {
      setError(errorMessageFromBody(data, "Could not load kept insights"));
      return;
    }
    if (Array.isArray(data.items)) setKept(data.items);
  }, [ayclToken, workspaceId]);

  useEffect(() => {
    void loadKept();
  }, [loadKept]);

  const readJob = async (activeJobId: string) => {
    const deadline = Date.now() + simulateInsightsPollBudgetMs();
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const qs = new URLSearchParams({ workspaceId: workspaceId || "", jobId: activeJobId });
      if (ayclToken) qs.set("ayclToken", ayclToken);
      const read = await fetch(`/api/workspace/simulate-insights?${qs}`);
      const job = (await read.json().catch(() => ({}))) as {
        status?: string;
        completedSteps?: number;
        insights?: InsightCandidate[];
        error?: string;
      };
      if (!read.ok) {
        throw new Error(errorMessageFromBody(job, "Could not read Simulate Insights"));
      }
      setCompletedSteps(job.completedSteps || 0);
      if (job.status === "error") {
        throw new Error(job.error || "Simulate Insights failed");
      }
      if (job.status === "completed") {
        setInsights(Array.isArray(job.insights) ? job.insights : []);
        setJobId(null);
        setPhase("done");
        return;
      }
    }
    setJobId(activeJobId);
    setPhase("waiting");
    setError("Still simulating. Check again to read this same run.");
  };

  const start = async () => {
    if (!workspaceId || phase === "running") return;
    setError(null);
    let activeJobId = jobId;
    if (!simulateInsightsClickStartsNewJob({ jobId, phase })) {
      setPhase("running");
      try {
        await readJob(jobId as string);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulate Insights failed");
        setJobId(null);
        setPhase("failed");
      }
      return;
    }
    setPhase("running");
    setInsights([]);
    setCompletedSteps(0);
    try {
      const res = await fetch("/api/workspace/simulate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          scope,
          blockId,
          blockIds,
          modifierPrompt: modifierPrompt.trim() || undefined,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const started = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
      };
      if (!res.ok || !started.jobId) {
        throw new Error(errorMessageFromBody(started, "Could not start Simulate Insights"));
      }
      activeJobId = started.jobId;
      setJobId(started.jobId);
      await readJob(started.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulate Insights failed");
      setJobId(null);
      setPhase("failed");
    }
  };

  const keep = async (insight: InsightCandidate) => {
    if (!workspaceId) return;
    setBusyId(insight.id);
    setError(null);
    try {
      const res = await fetch("/api/workspace/simulation-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "keep",
          title: insight.title,
          body: insight.body,
          origin,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(errorMessageFromBody(data, "Could not keep insight"));
      await loadKept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not keep insight");
    } finally {
      setBusyId(null);
    }
  };

  const removeKept = async (id: string) => {
    if (!workspaceId) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/workspace/simulation-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "delete",
          itemId: id,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(errorMessageFromBody(data, "Could not remove insight"));
      }
      await loadKept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove insight");
    } finally {
      setBusyId(null);
    }
  };

  const keptKey = (title: string, body: string) =>
    `${title.trim().toLowerCase()}\n${body.trim().toLowerCase()}`;
  const keptKeys = new Set(kept.map((item) => keptKey(item.title, item.body)));

  return (
    <div
      className="space-y-3"
      data-simulate-insights
      data-simulation-auto-generate="false"
      data-simulation-auto-deposit={autoDeposit ? "true" : "false"}
    >
      <label className="block space-y-1" data-simulation-modifier>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Modifier
        </span>
        <textarea
          value={modifierPrompt}
          onChange={(e) => setModifierPrompt(e.target.value)}
          rows={2}
          disabled={phase === "running"}
          placeholder="Optional: steer which insights to rehearse…"
          data-simulation-modifier-input
          className="w-full resize-none rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>
      <button
        type="button"
        data-simulate-insights-start
        data-simulation-generate
        disabled={!workspaceId || phase === "running" || (scope === "multi_block" && (blockIds?.length || 0) < 2)}
        onClick={() => void start()}
        className="rounded-none border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {phase === "running"
          ? `Simulating… step ${completedSteps} of 2`
          : phase === "waiting"
            ? "Check again"
            : "Simulate Insights"}
      </button>
      {error ? (
        <p className="text-[11px] text-neutral-300/90" data-simulate-insights-error>
          {error}
        </p>
      ) : null}
      <div data-simulate-insights-results>
        {insights.length === 0 ? (
          <p className="text-[11px] text-neutral-500">
            {phase === "running"
              ? "Rehearsing insights in the background…"
              : "No insight candidates yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight) => {
              const already = keptKeys.has(keptKey(insight.title, insight.body));
              return (
                <li
                  key={insight.id}
                  data-simulate-insight={insight.id}
                  className="rounded-none border border-neutral-800 bg-neutral-950/80 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium text-neutral-100">{insight.title}</p>
                    <button
                      type="button"
                      data-simulate-insights-keep
                      data-simulation-add-to-collection
                      disabled={already || busyId === insight.id}
                      onClick={() => void keep(insight)}
                      className="shrink-0 rounded-none border border-white/15 px-2 py-0.5 text-[10px] text-neutral-200 disabled:opacity-40"
                    >
                      {already ? "Kept" : "Keep"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-neutral-400">{insight.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div data-simulation-collection className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Kept insights
        </p>
        {kept.length === 0 ? (
          <p className="text-[11px] text-neutral-600">Nothing kept yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {kept.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-neutral-200">{item.title}</p>
                  <p className="text-[10px] text-neutral-500">{item.body}</p>
                </div>
                <button
                  type="button"
                  data-simulation-collection-delete
                  disabled={busyId === item.id}
                  onClick={() => void removeKept(item.id)}
                  className="shrink-0 text-[10px] text-neutral-500 hover:text-neutral-200"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
