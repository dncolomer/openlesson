"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowRight,
  Clock,
  FileCode2,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import type { PerformanceReport } from "@/lib/agent-v2/performance-context";
import type { EvidenceEvalSchemaResult } from "@/lib/agent-v2/evidence-schema";
import {
  DEMO_EVAL_DEFINITION,
  DEMO_PRODUCT_NAME,
  SIMULATION_ACTIONS,
  SIMULATION_CATEGORY_META,
  SIMULATION_CATEGORY_ORDER,
  applySimulationAction,
  buildSimulationEvidencePayload,
  countDistinctEvidenceActions,
  createInitialWorldState,
  getActionsByCategory,
  hasCompletedAction,
  isActionRepeatable,
  matchBlockToStep,
  shouldSuggestSkillRegeneration,
  totalActionCount,
  type DemoWorkspaceBlock,
  type SimulationAction,
  type SimulationCategory,
  type SimulationWorldState,
} from "@/lib/evidence-api-demo/flowstack";
import { readJsonResponse } from "@/lib/read-json-response";

type DemoPhase = "intro" | "creating" | "simulating";

type ReportSnapshot = {
  id: string;
  report: PerformanceReport;
  evidenceCount: number;
  actionCount: number;
  simulatedDays: number;
  timestamp: Date;
};

type SkillSnapshot = {
  id: string;
  skill_name: string;
  spec_version?: string;
  evidenceCount: number;
  actionCount: number;
  simulatedDays: number;
  prefetch: boolean;
  preview: string;
  timestamp: Date;
};

type SchemaSnapshot = {
  id: string;
  schema_name: string;
  spec_version?: string;
  evidenceCount: number;
  actionCount: number;
  simulatedDays: number;
  timestamp: Date;
};

type ApiLogEntry = {
  id: string;
  method: string;
  path: string;
  status: "pending" | "success" | "error";
  summary: string;
  detail?: string;
  timestamp: Date;
};

type PlanFileSummary = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

type WorkspaceResponse = {
  workspace: { id: string; title: string };
  blocks: DemoWorkspaceBlock[];
  files?: PlanFileSummary[];
  demo: {
    product: string;
    integration_name: string;
    eval_definition: string;
    model_doc_filename?: string;
    model_doc_preview?: string;
  };
  api_paths: {
    evidence_schema: string;
    evidence_upload: string;
    integration_skill: string;
    performance: string;
  };
};

type EvidenceResponse = {
  evidence: { id: string; tool_action: string | null; created_at: string };
};

type PerformanceResponse = {
  report: PerformanceReport;
  evidence_summary: { evidence_artifacts: number; blocks: number };
};

const STORAGE_KEY = "openlesson-evidence-api-demo";

type PersistedDemoState = {
  planId: string;
  sessionId: string;
  worldState: SimulationWorldState;
  workspaceTitle?: string;
  blocks?: DemoWorkspaceBlock[];
};

function loadPersistedState(): PersistedDemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDemoState & { completedSteps?: string[] };
    if (!parsed.planId || !parsed.sessionId) return null;
    const legacySteps = Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [];
    return {
      planId: parsed.planId,
      sessionId: parsed.sessionId,
      worldState: parsed.worldState ?? {
        ...createInitialWorldState(),
        completedActions: legacySteps,
        actionCounts: Object.fromEntries(legacySteps.map((id: string) => [id, 1])),
      },
      workspaceTitle: parsed.workspaceTitle,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    };
  } catch {
    return null;
  }
}

function persistState(state: PersistedDemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}

function createSessionId() {
  return crypto.randomUUID();
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      credentials: "same-origin",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function hasTeamsAccess(profile: {
  is_admin?: boolean | null;
  plan?: string | null;
  subscription_status?: string | null;
} | null): boolean {
  if (!profile) return false;
  return (
    profile.is_admin === true ||
    (profile.plan === "pro_teams" && profile.subscription_status === "active")
  );
}

function severityColor(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return "text-red-300 border-red-400/30 bg-red-950/30";
    case "medium":
      return "text-amber-200 border-amber-400/30 bg-amber-950/30";
    default:
      return "text-zinc-300 border-zinc-600/40 bg-zinc-900/50";
  }
}

function confidenceLabel(confidence: PerformanceReport["confidence"]) {
  switch (confidence) {
    case "well-connected":
      return "Well connected";
    case "clear":
      return "Clear signal";
    case "developing":
      return "Developing";
    default:
      return "Emerging";
  }
}

export function EvidenceApiDemo() {
  const [authState, setAuthState] = useState<"loading" | "guest" | "no-teams" | "ready">("loading");
  const [phase, setPhase] = useState<DemoPhase>("intro");
  const [planId, setPlanId] = useState<string | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<DemoWorkspaceBlock[]>([]);
  const [apiPaths, setApiPaths] = useState<WorkspaceResponse["api_paths"] | null>(null);
  const [planFiles, setPlanFiles] = useState<PlanFileSummary[]>([]);
  const [modelDocPreview, setModelDocPreview] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [worldState, setWorldState] = useState<SimulationWorldState>(createInitialWorldState);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  const [error, setError] = useState("");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportSnapshot[]>([]);
  const [skillHistory, setSkillHistory] = useState<SkillSnapshot[]>([]);
  const [schemaHistory, setSchemaHistory] = useState<SchemaSnapshot[]>([]);
  const [latestSkillPreview, setLatestSkillPreview] = useState<string | null>(null);
  const [latestSchema, setLatestSchema] = useState<EvidenceEvalSchemaResult | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [isRegeneratingSkill, setIsRegeneratingSkill] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [lastSkillEvidenceCount, setLastSkillEvidenceCount] = useState<number | null>(null);
  const [skillRegenHint, setSkillRegenHint] = useState(false);

  const actionCount = totalActionCount(worldState);
  const distinctEvidenceActions = countDistinctEvidenceActions(worldState);

  const addLog = useCallback(
    (entry: Omit<ApiLogEntry, "id" | "timestamp">) => {
      setApiLog((prev) => [
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        ...prev,
      ].slice(0, 12));
    },
    []
  );

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let cancelled = false;

    const resolveAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setAuthState("guest");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_status, is_admin")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (hasTeamsAccess(profile)) {
          setAuthState("ready");
          return;
        }

        try {
          const res = await fetchWithTimeout("/api/evidence-api-demo/status");
          if (res.ok) {
            const data = (await res.json()) as {
              authenticated?: boolean;
              hasTeams?: boolean;
              isAdmin?: boolean;
            };
            if (data.authenticated && (data.hasTeams || data.isAdmin)) {
              setAuthState("ready");
              return;
            }
          }
        } catch {
          // Server status is a fallback only.
        }

        setAuthState("no-teams");
      } catch {
        if (!cancelled) setAuthState("guest");
      }
    };

    void resolveAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void resolveAuth();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authState !== "ready") return;
    const persisted = loadPersistedState();
    if (!persisted) return;
    setPlanId(persisted.planId);
    setSessionId(persisted.sessionId);
    setWorldState(persisted.worldState);
    setWorkspaceTitle(persisted.workspaceTitle ?? null);
    setBlocks(persisted.blocks ?? []);
    setEvidenceCount(totalActionCount(persisted.worldState));
    setPhase("simulating");
  }, [authState]);

  const handleStartDemo = async () => {
    setError("");
    setPhase("creating");
    clearPersistedState();
    const newSessionId = createSessionId();
    setSessionId(newSessionId);
    setWorldState(createInitialWorldState());
    setReport(null);
    setReportHistory([]);
    setSkillHistory([]);
    setSchemaHistory([]);
    setLatestSkillPreview(null);
    setLatestSchema(null);
    setEvidenceCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setApiLog([]);

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/workspace",
      status: "pending",
      summary: "Creating verification workspace from FlowStack onboarding prompt…",
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/workspace",
        { method: "POST" },
        120000
      );
      const data = await readJsonResponse<
        WorkspaceResponse & { error?: string; code?: string; hint?: string }
      >(res);

      if (!res.ok) {
        if (data.code === "auth_required") {
          setAuthState("guest");
          throw new Error("Session expired. Refresh the page and sign in again.");
        }
        if (data.code === "teams_required") {
          setAuthState("no-teams");
          throw new Error("Teams tier required for this demo.");
        }
        throw new Error(
          [data.error || "Failed to create workspace", data.hint].filter(Boolean).join(" ")
        );
      }

      setPlanId(data.workspace.id);
      setWorkspaceTitle(data.workspace.title);
      setBlocks(data.blocks);
      setApiPaths(data.api_paths);
      setPlanFiles(data.files ?? []);
      setModelDocPreview(data.demo.model_doc_preview ?? null);
      const initialWorld = createInitialWorldState();
      persistState({
        planId: data.workspace.id,
        sessionId: newSessionId,
        worldState: initialWorld,
        workspaceTitle: data.workspace.title,
        blocks: data.blocks,
      });

      const fileDetail = data.files?.length
        ? `${data.blocks.length} blocks · ${data.files.map((f) => f.file_name).join(", ")}`
        : `${data.blocks.length} assessable blocks generated`;

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/workspace",
        status: "success",
        summary: `Workspace created: ${data.workspace.title}`,
        detail: fileDetail,
      });

      setPhase("simulating");
      setWorldState(initialWorld);
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/workspace",
        status: "error",
        summary: err instanceof Error ? err.message : "Workspace creation failed",
      });
      setError(err instanceof Error ? err.message : "Failed to start demo");
      setPhase("intro");
    }
  };

  const handleRunAction = async (action: SimulationAction) => {
    if (!planId || runningActionId) return;
    if (!isActionRepeatable(action) && hasCompletedAction(worldState, action.id)) return;

    setRunningActionId(action.id);
    setError("");

    const nextWorld = applySimulationAction(worldState, action);
    const blockId = matchBlockToStep(blocks, action);
    const payload = buildSimulationEvidencePayload(action, {
      sessionId,
      blockId,
      worldState,
      reflection:
        action.kind === "time_simulation"
          ? `Operator simulated ${action.timeDeltaDays ?? 0} day(s) of idle time before the next learner activity.`
          : `User triggered "${action.label}" on the non-linear FlowStack surface.`,
      outcome: action.outcome,
    });

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/evidence",
      status: "pending",
      summary:
        action.kind === "time_simulation"
          ? `Simulating +${action.timeDeltaDays ?? 0} day(s) idle gap`
          : `Uploading evidence: ${action.label}`,
      detail: blockId ? `block_id: ${blockId.slice(0, 8)}…` : action.category,
    });

    try {
      const res = await fetchWithTimeout("/api/evidence-api-demo/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          type: "tool",
          mime_type: "application/json",
          payload,
          block_id: blockId,
          session_id: sessionId,
          tool_name: action.kind === "time_simulation" ? "flowstack_simulator" : "flowstack",
          tool_action: action.id,
          file_name: `${action.id}-${(worldState.actionCounts[action.id] ?? 0) + 1}.json`,
          metadata: {
            demo: true,
            source: "evidence-api-demo",
            category: action.category,
            dimension: action.dimension,
            simulated_days: nextWorld.simulatedDays,
          },
        }),
      });

      const data = await readJsonResponse<EvidenceResponse & { error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Evidence upload failed");
      }

      const nextEvidenceCount = evidenceCount + 1;
      setWorldState(nextWorld);
      setEvidenceCount(nextEvidenceCount);
      persistState({
        planId,
        sessionId,
        worldState: nextWorld,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks,
      });

      if (shouldSuggestSkillRegeneration(nextEvidenceCount, lastSkillEvidenceCount)) {
        setSkillRegenHint(true);
      }

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence",
        status: "success",
        summary:
          action.kind === "time_simulation"
            ? `Time advanced to day ${nextWorld.simulatedDays}`
            : `Evidence stored: ${action.label}`,
        detail: `artifact ${data.evidence.id.slice(0, 8)}…`,
      });
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence",
        status: "error",
        summary: err instanceof Error ? err.message : "Upload failed",
      });
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setRunningActionId(null);
    }
  };

  const handleFetchEvidenceSchema = async () => {
    if (!planId || isFetchingSchema) return;

    setIsFetchingSchema(true);
    setError("");

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/evidence-schema",
      status: "pending",
      summary: "Re-fetching evidence spec from workspace context…",
      detail: `${evidenceCount} artifact(s), day ${worldState.simulatedDays}`,
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/evidence-schema",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, definition: DEMO_EVAL_DEFINITION }),
        },
        120000
      );

      const data = await readJsonResponse<{
        spec: EvidenceEvalSchemaResult;
        context_counts?: { evidence_artifacts?: number };
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Evidence schema fetch failed");
      }

      setLatestSchema(data.spec);
      setSchemaHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          schema_name: data.spec.schema_name,
          spec_version: data.spec.spec_version,
          evidenceCount,
          actionCount,
          simulatedDays: worldState.simulatedDays,
          timestamp: new Date(),
        },
      ]);

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence-schema",
        status: "success",
        summary: `Evidence spec updated: ${data.spec.schema_name}`,
        detail: `v${data.spec.spec_version || "?"} · ${data.spec.tool_submissions?.length ?? 0} tool spec(s)`,
      });
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence-schema",
        status: "error",
        summary: err instanceof Error ? err.message : "Schema fetch failed",
      });
      setError(err instanceof Error ? err.message : "Failed to fetch evidence schema");
    } finally {
      setIsFetchingSchema(false);
    }
  };

  const handleRegenerateSkill = async () => {
    if (!planId || isRegeneratingSkill) return;

    setIsRegeneratingSkill(true);
    setError("");
    setSkillRegenHint(false);

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/integration-skill",
      status: "pending",
      summary: "Regenerating integration skill.md from latest evidence…",
      detail: `${evidenceCount} artifact(s), ${distinctEvidenceActions} distinct actions`,
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/integration-skill",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, prefetch_evidence_spec: true }),
        },
        180000
      );

      const data = await readJsonResponse<{
        skill_md: string;
        skill_name: string;
        evidence_spec?: EvidenceEvalSchemaResult;
        evidence_spec_prefetched?: boolean;
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Skill regeneration failed");
      }

      const preview = data.skill_md.slice(0, 600);
      setLatestSkillPreview(preview);
      if (data.evidence_spec) {
        setLatestSchema(data.evidence_spec);
      }
      setLastSkillEvidenceCount(evidenceCount);

      setSkillHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          skill_name: data.skill_name,
          spec_version: data.evidence_spec?.spec_version,
          evidenceCount,
          actionCount,
          simulatedDays: worldState.simulatedDays,
          prefetch: data.evidence_spec_prefetched === true,
          preview,
          timestamp: new Date(),
        },
      ]);

      if (data.evidence_spec) {
        setSchemaHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            schema_name: data.evidence_spec!.schema_name,
            spec_version: data.evidence_spec!.spec_version,
            evidenceCount,
            actionCount,
            simulatedDays: worldState.simulatedDays,
            timestamp: new Date(),
          },
        ]);
      }

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/integration-skill",
        status: "success",
        summary: `Skill regenerated: ${data.skill_name}`,
        detail: data.evidence_spec_prefetched
          ? `Prefetched spec ${data.evidence_spec?.schema_name || ""}`
          : "Skill only",
      });
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/integration-skill",
        status: "error",
        summary: err instanceof Error ? err.message : "Skill regeneration failed",
      });
      setError(err instanceof Error ? err.message : "Failed to regenerate skill");
    } finally {
      setIsRegeneratingSkill(false);
    }
  };

  const handleRequestPerformance = async () => {
    if (!planId || isReporting) return;
    if (evidenceCount < 1) {
      setError("Run at least one simulation action to upload evidence before requesting a score.");
      return;
    }

    setIsReporting(true);
    setError("");

    const snapshotEvidenceCount = evidenceCount;
    const snapshotActionCount = actionCount;
    const snapshotSimulatedDays = worldState.simulatedDays;

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/performance",
      status: "pending",
      summary: `Requesting score (${snapshotEvidenceCount} evidence artifact${snapshotEvidenceCount === 1 ? "" : "s"})…`,
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/performance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        },
        120000
      );

      const data = await readJsonResponse<PerformanceResponse & { error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Performance report failed");
      }

      setReport(data.report);
      setEvidenceCount(data.evidence_summary.evidence_artifacts);
      setReportHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          report: data.report,
          evidenceCount: snapshotEvidenceCount,
          actionCount: snapshotActionCount,
          simulatedDays: snapshotSimulatedDays,
          timestamp: new Date(),
        },
      ]);

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/performance",
        status: "success",
        summary: "Score updated",
        detail: `${confidenceLabel(data.report.confidence)} · ${snapshotActionCount} actions · day ${snapshotSimulatedDays}`,
      });
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/performance",
        status: "error",
        summary: err instanceof Error ? err.message : "Report failed",
      });
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleArchiveWorkspace = async () => {
    if (!planId || isArchiving) return;
    if (
      !confirm(
        "Archive this demo workspace? It will be hidden from your dashboard and admin lists, but evidence and scores are preserved."
      )
    ) {
      return;
    }

    setIsArchiving(true);
    setError("");

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/archive",
      status: "pending",
      summary: "Archiving demo workspace…",
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/archive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        },
        30000
      );
      const data = await readJsonResponse<{ success?: boolean; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive workspace");
      }

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/archive",
        status: "success",
        summary: "Demo workspace archived",
        detail: "Hidden from dashboard; data preserved",
      });

      handleReset();
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/archive",
        status: "error",
        summary: err instanceof Error ? err.message : "Archive failed",
      });
      setError(err instanceof Error ? err.message : "Failed to archive workspace");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleReset = () => {
    clearPersistedState();
    setPhase("intro");
    setPlanId(null);
    setWorkspaceTitle(null);
    setBlocks([]);
    setApiPaths(null);
    setPlanFiles([]);
    setModelDocPreview(null);
    setSessionId(createSessionId());
    setWorldState(createInitialWorldState());
    setReport(null);
    setReportHistory([]);
    setSkillHistory([]);
    setSchemaHistory([]);
    setLatestSkillPreview(null);
    setLatestSchema(null);
    setIsReporting(false);
    setIsFetchingSchema(false);
    setIsRegeneratingSkill(false);
    setEvidenceCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setApiLog([]);
    setError("");
  };

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0a] text-zinc-400">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm text-zinc-500">Checking your account…</p>
      </div>
    );
  }

  if (authState === "guest") {
    return (
      <AuthGate
        title="Sign in to run the demo"
        body="The Evidence API demo creates a real verification workspace and uploads live evidence. Sign in with a Teams account to continue."
        primaryHref="/login?redirect=/evidence-api-demo"
        primaryLabel="Sign in"
        secondaryHref="/register"
        secondaryLabel="Create account"
      />
    );
  }

  if (authState === "no-teams") {
    return (
      <AuthGate
        title="Teams tier required"
        body="This demo uses the Agentic API to create workspaces, upload evidence, and generate performance reports. Upgrade to Teams to run it."
        primaryHref="/pricing"
        primaryLabel="View pricing"
        secondaryHref="/docs/agentic-v2"
        secondaryLabel="API docs"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <Navbar
        breadcrumbs={[
          { label: "Evidence API Demo", href: "/evidence-api-demo" },
        ]}
        showNav={false}
      />

      <header className="border-b border-zinc-800/80 bg-zinc-950/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-cyan-300/70">
              Interactive demo
            </div>
            <h1 className="mt-2 text-3xl font-medium tracking-[-1px] text-white sm:text-4xl">
              Evidence API in action
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Simulate a non-linear SaaS trial on {DEMO_PRODUCT_NAME} — branch across integrations,
              projects, and team actions, compress idle time, then watch OpenLesson regenerate evidence
              specs and integration skills as the workspace learns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/docs/agentic-v2"
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              API reference
            </Link>
            {planId ? (
              <Link
                href={`/workspace/${planId}`}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open workspace
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-8">
        <SimulatorPanel
          phase={phase}
          worldState={worldState}
          runningActionId={runningActionId}
          onStart={handleStartDemo}
          onRunAction={handleRunAction}
        />

        <OpenLessonPanel
          phase={phase}
          planId={planId}
          workspaceTitle={workspaceTitle}
          apiPaths={apiPaths}
          planFiles={planFiles}
          modelDocPreview={modelDocPreview}
          sessionId={sessionId}
          worldState={worldState}
          evidenceCount={evidenceCount}
          actionCount={actionCount}
          distinctEvidenceActions={distinctEvidenceActions}
          isReporting={isReporting}
          isFetchingSchema={isFetchingSchema}
          isRegeneratingSkill={isRegeneratingSkill}
          skillRegenHint={skillRegenHint}
          apiLog={apiLog}
          error={error}
          report={report}
          reportHistory={reportHistory}
          skillHistory={skillHistory}
          schemaHistory={schemaHistory}
          latestSkillPreview={latestSkillPreview}
          latestSchema={latestSchema}
          evalDefinition={DEMO_EVAL_DEFINITION}
          onRequestPerformance={handleRequestPerformance}
          onFetchEvidenceSchema={handleFetchEvidenceSchema}
          onRegenerateSkill={handleRegenerateSkill}
          onArchiveWorkspace={handleArchiveWorkspace}
          isArchiving={isArchiving}
          onReset={handleReset}
        />
      </main>

      <Footer />
    </div>
  );
}

function AuthGate({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <Navbar showNav={false} />
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-sm border border-cyan-400/20 bg-cyan-950/30">
          <Zap className="size-5 text-cyan-200" />
        </div>
        <h1 className="mt-6 text-2xl font-medium text-white">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={primaryHref}
            className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function SimulatorPanel({
  phase,
  worldState,
  runningActionId,
  onStart,
  onRunAction,
}: {
  phase: DemoPhase;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onStart: () => void;
  onRunAction: (action: SimulationAction) => void;
}) {
  const totalActions = SIMULATION_ACTIONS.filter((action) => action.kind === "evidence").length;
  const explored = countDistinctEvidenceActions(worldState);
  const coveragePercent = Math.round((explored / totalActions) * 100);

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-indigo-500/20 bg-gradient-to-b from-indigo-950/40 to-[#0f1117]">
      <div className="border-b border-indigo-500/15 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
              FS
            </div>
            <div>
              <div className="text-sm font-medium text-white">{DEMO_PRODUCT_NAME}</div>
              <div className="text-xs text-indigo-200/70">Multidimensional trial simulator</div>
            </div>
          </div>
          <span className="rounded-full border border-indigo-400/25 bg-indigo-950/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-indigo-200">
            Simulation toolkit
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {phase === "intro" || phase === "creating" ? (
          <div className="flex flex-1 flex-col justify-center py-8">
            <Sparkles className="size-8 text-indigo-300" />
            <h2 className="mt-4 text-xl font-medium text-white">Non-linear trial surface</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-indigo-100/70">
              Branch across onboarding paths, integrations, projects, and team workflows. Use simulation
              tools to compress days between sessions — then regenerate OpenLesson specs as evidence grows.
            </p>
            <button
              type="button"
              onClick={onStart}
              disabled={phase === "creating"}
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "creating" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating workspace…
                </>
              ) : (
                <>
                  Start demo
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-indigo-500/20 bg-black/25 px-2 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wide text-indigo-300/60">Day</div>
                <div className="mt-1 font-mono text-lg text-white">{worldState.simulatedDays}</div>
              </div>
              <div className="rounded-md border border-indigo-500/20 bg-black/25 px-2 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wide text-indigo-300/60">Actions</div>
                <div className="mt-1 font-mono text-lg text-white">{totalActionCount(worldState)}</div>
              </div>
              <div className="rounded-md border border-indigo-500/20 bg-black/25 px-2 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wide text-indigo-300/60">Coverage</div>
                <div className="mt-1 font-mono text-lg text-white">{coveragePercent}%</div>
              </div>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-indigo-100/55">
              Click any action in any order — no fixed path. Repeatable actions and time tools model
              real-world complexity (idle gaps, mistakes, parallel workstreams).
            </p>

            <div className="max-h-[32rem] space-y-5 overflow-y-auto pr-1">
              {SIMULATION_CATEGORY_ORDER.map((category) => (
                <SimulationCategorySection
                  key={category}
                  category={category}
                  worldState={worldState}
                  runningActionId={runningActionId}
                  onRunAction={onRunAction}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SimulationCategorySection({
  category,
  worldState,
  runningActionId,
  onRunAction,
}: {
  category: SimulationCategory;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onRunAction: (action: SimulationAction) => void;
}) {
  const meta = SIMULATION_CATEGORY_META[category];
  const actions = getActionsByCategory(category);
  const isTimeTools = category === "simulation_tools";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {isTimeTools ? <Clock className="size-3.5 text-amber-300/80" /> : null}
        <div>
          <div className="text-xs font-medium text-white">{meta.label}</div>
          <div className="text-[10px] text-indigo-200/50">{meta.description}</div>
        </div>
      </div>
      <div
        className={`grid gap-2 ${isTimeTools ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {actions.map((action) => {
          const count = worldState.actionCounts[action.id] ?? 0;
          const done = hasCompletedAction(worldState, action.id);
          const disabled =
            !!runningActionId || (!isActionRepeatable(action) && done);
          const isRunning = runningActionId === action.id;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onRunAction(action)}
              disabled={disabled}
              className={`rounded-md border px-3 py-2.5 text-left transition ${
                isTimeTools
                  ? "border-amber-500/25 bg-amber-950/15 hover:border-amber-400/40"
                  : done
                    ? "border-emerald-500/20 bg-emerald-950/15"
                    : "border-indigo-500/15 bg-black/20 hover:border-indigo-400/35"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-white">{action.label}</span>
                {count > 0 ? (
                  <span className="shrink-0 rounded bg-indigo-950/80 px-1.5 py-0.5 font-mono text-[9px] text-indigo-200">
                    ×{count}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-indigo-100/55">{action.description}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-indigo-200">
                {isRunning ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Running…
                  </>
                ) : (
                  action.cta
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OpenLessonPanel({
  phase,
  planId,
  workspaceTitle,
  apiPaths,
  planFiles,
  modelDocPreview,
  sessionId,
  worldState,
  evidenceCount,
  actionCount,
  distinctEvidenceActions,
  isReporting,
  isFetchingSchema,
  isRegeneratingSkill,
  skillRegenHint,
  apiLog,
  error,
  report,
  reportHistory,
  skillHistory,
  schemaHistory,
  latestSkillPreview,
  latestSchema,
  evalDefinition,
  onRequestPerformance,
  onFetchEvidenceSchema,
  onRegenerateSkill,
  onArchiveWorkspace,
  isArchiving,
  onReset,
}: {
  phase: DemoPhase;
  planId: string | null;
  workspaceTitle: string | null;
  apiPaths: WorkspaceResponse["api_paths"] | null;
  planFiles: PlanFileSummary[];
  modelDocPreview: string | null;
  sessionId: string;
  worldState: SimulationWorldState;
  evidenceCount: number;
  actionCount: number;
  distinctEvidenceActions: number;
  isReporting: boolean;
  isFetchingSchema: boolean;
  isRegeneratingSkill: boolean;
  skillRegenHint: boolean;
  apiLog: ApiLogEntry[];
  error: string;
  report: PerformanceReport | null;
  reportHistory: ReportSnapshot[];
  skillHistory: SkillSnapshot[];
  schemaHistory: SchemaSnapshot[];
  latestSkillPreview: string | null;
  latestSchema: EvidenceEvalSchemaResult | null;
  evalDefinition: string;
  onRequestPerformance: () => void;
  onFetchEvidenceSchema: () => void;
  onRegenerateSkill: () => void;
  onArchiveWorkspace: () => void;
  isArchiving: boolean;
  onReset: () => void;
}) {
  const canOperate = !!planId && phase === "simulating";
  const canRequestScore = canOperate && evidenceCount > 0;
  const canRegenerate = canOperate && evidenceCount > 0;
  return (
    <section className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950/70">
      <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-cyan-300" />
          <div>
            <div className="text-sm font-medium text-white">OpenLesson verification layer</div>
            <div className="text-xs text-zinc-500">Live API activity from this session</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="Workspace" value={planId ? "Active" : "—"} />
          <Stat label="Evidence" value={evidenceCount > 0 ? String(evidenceCount) : "—"} />
          <Stat label="Sim day" value={worldState.simulatedDays > 0 ? String(worldState.simulatedDays) : "—"} />
          <Stat
            label="Status"
            value={
              isRegeneratingSkill
                ? "Skill regen"
                : isFetchingSchema
                  ? "Spec fetch"
                  : isReporting
                    ? "Scoring"
                    : phase === "simulating"
                      ? "Live"
                      : "Idle"
            }
          />
        </div>

        {workspaceTitle ? (
          <div className="rounded-md border border-zinc-800 bg-black/30 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              Verification workspace
            </div>
            <div className="mt-1 text-sm text-white">{workspaceTitle}</div>
            {planId ? (
              <code className="mt-1 block truncate font-mono text-[11px] text-zinc-500">{planId}</code>
            ) : null}
          </div>
        ) : null}

        {planFiles.length > 0 ? (
          <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              Workspace files (plan_files)
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Attached at creation like <span className="font-mono text-zinc-400">POST .../workspaces</span>{" "}
              with <span className="font-mono text-zinc-400">files[]</span> — included in performance and spec context.
            </p>
            <ul className="mt-2 space-y-1.5">
              {planFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800/80 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono text-zinc-300">{file.file_name}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {file.mime_type} · {Math.round(file.file_size / 1024)} KB
                  </span>
                </li>
              ))}
            </ul>
            {modelDocPreview ? (
              <pre className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-zinc-800/80 bg-zinc-950/60 p-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                {modelDocPreview}…
              </pre>
            ) : null}
          </div>
        ) : null}

        {apiPaths ? (
          <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              Production API paths
            </div>
            <ul className="mt-2 space-y-1.5 font-mono text-[10px] text-zinc-400">
              <li>POST …/evidence</li>
              <li>POST …/performance</li>
              <li>POST …/evidence-schema</li>
              <li>POST …/integration-skill</li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              This demo proxies through session-authenticated routes. In production, use Bearer API keys
              against the paths returned when the workspace was created.
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            API activity
          </div>
          {apiLog.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
              Start the demo to create a workspace and stream evidence uploads here.
            </p>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto">
              {apiLog.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-zinc-800/80 bg-black/40 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                      {entry.method}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">{entry.path}</span>
                    <span
                      className={`ml-auto font-mono text-[10px] uppercase ${
                        entry.status === "success"
                          ? "text-emerald-400"
                          : entry.status === "error"
                            ? "text-red-400"
                            : "text-amber-300"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-300">{entry.summary}</p>
                  {entry.detail ? (
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{entry.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {canRegenerate ? (
          <div className="space-y-3 rounded-md border border-violet-500/20 bg-violet-950/10 p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-violet-300" />
              <div>
                <div className="text-sm font-medium text-white">Continuous evaluation</div>
                <div className="text-xs text-zinc-500">
                  Specs and skills are living documents — regenerate as evidence grows.
                </div>
              </div>
            </div>

            {skillRegenHint ? (
              <p className="rounded-md border border-violet-400/25 bg-violet-950/30 px-3 py-2 text-xs text-violet-100/90">
                Evidence crossed a threshold ({evidenceCount} artifacts). Regenerate the integration
                skill to showcase how partner agents stay aligned.
              </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onFetchEvidenceSchema}
                disabled={isFetchingSchema || isRegeneratingSkill}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingSchema ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileCode2 className="size-3.5" />
                )}
                Re-fetch evidence spec
              </button>
              <button
                type="button"
                onClick={onRegenerateSkill}
                disabled={isRegeneratingSkill || isFetchingSchema}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRegeneratingSkill ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Regenerate skill.md
                {skillHistory.length > 0 ? ` (v${skillHistory.length + 1})` : ""}
              </button>
            </div>

            {schemaHistory.length > 0 ? (
              <SpecEvolution history={schemaHistory} />
            ) : null}

            {skillHistory.length > 0 ? (
              <SkillEvolution history={skillHistory} />
            ) : null}

            {latestSchema ? (
              <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                  Latest evidence spec
                </div>
                <div className="mt-2 text-xs text-zinc-300">
                  <span className="font-mono text-violet-200">{latestSchema.schema_name}</span>
                  {latestSchema.spec_version ? (
                    <span className="ml-2 text-zinc-500">v{latestSchema.spec_version}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  {latestSchema.continuous_evaluation_summary ||
                    latestSchema.collection_guidance?.slice(0, 180)}
                </p>
              </div>
            ) : null}

            {latestSkillPreview ? (
              <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                  Latest skill.md preview
                </div>
                <pre className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-400">
                  {latestSkillPreview}
                  {latestSkillPreview.length >= 600 ? "\n…" : ""}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {canRequestScore ? (
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs leading-relaxed text-zinc-500">
              Request a score at any point — branch freely, simulate idle days, then score again.
              {distinctEvidenceActions} distinct actions · {actionCount} total events · day{" "}
              {worldState.simulatedDays}.
            </p>
            <button
              type="button"
              onClick={onRequestPerformance}
              disabled={isReporting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {isReporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating score…
                </>
              ) : (
                <>
                  Request score now
                  {reportHistory.length > 0 ? ` (check ${reportHistory.length + 1})` : ""}
                </>
              )}
            </button>
          </div>
        ) : null}

        {reportHistory.length > 1 ? <ScoreEvolution history={reportHistory} /> : null}

        {report ? (
          <PerformanceReportCard
            report={report}
            label={
              reportHistory.length > 0
                ? `Latest score · day ${reportHistory[reportHistory.length - 1].simulatedDays} · ${reportHistory[reportHistory.length - 1].actionCount} actions`
                : "Performance report"
            }
          />
        ) : null}

        {planId ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onArchiveWorkspace}
              disabled={isArchiving}
              className="rounded-md border border-amber-500/30 px-3 py-1.5 text-xs text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-950/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isArchiving ? "Archiving…" : "Archive demo workspace"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Reset demo session
            </button>
          </div>
        ) : null}

        <p className="font-mono text-[10px] text-zinc-600">session: {sessionId.slice(0, 8)}…</p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/30 px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function SkillEvolution({ history }: { history: SkillSnapshot[] }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
        Skill regeneration timeline
      </div>
      <ol className="mt-3 space-y-2">
        {history.map((snapshot, index) => (
          <li
            key={snapshot.id}
            className={`rounded-md border px-3 py-2 text-xs ${
              index === history.length - 1
                ? "border-violet-500/30 bg-violet-950/20 text-zinc-200"
                : "border-zinc-800/80 text-zinc-400"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">
                v{index + 1} · {snapshot.skill_name}
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                {snapshot.evidenceCount} artifacts · day {snapshot.simulatedDays}
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-zinc-500">
              {snapshot.prefetch ? "Prefetched evidence spec" : "Skill only"}
              {snapshot.spec_version ? ` · spec ${snapshot.spec_version}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SpecEvolution({ history }: { history: SchemaSnapshot[] }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
        Evidence spec evolution
      </div>
      <ol className="mt-3 space-y-2">
        {history.map((snapshot, index) => (
          <li
            key={snapshot.id}
            className={`rounded-md border px-3 py-2 text-xs ${
              index === history.length - 1
                ? "border-cyan-500/25 bg-cyan-950/15 text-zinc-200"
                : "border-zinc-800/80 text-zinc-400"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-zinc-300">{snapshot.schema_name}</span>
              <span className="text-[10px] text-zinc-500">
                fetch {index + 1} · {snapshot.evidenceCount} artifacts
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScoreEvolution({ history }: { history: ReportSnapshot[] }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
        Score evolution
      </div>
      <ol className="mt-3 space-y-2">
        {history.map((snapshot, index) => (
          <li
            key={snapshot.id}
            className={`rounded-md border px-3 py-2 text-xs ${
              index === history.length - 1
                ? "border-cyan-500/30 bg-cyan-950/20 text-zinc-200"
                : "border-zinc-800/80 text-zinc-400"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">
                Check {index + 1} · day {snapshot.simulatedDays} · {snapshot.actionCount} action
                {snapshot.actionCount === 1 ? "" : "s"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {typeof snapshot.report.overall_score === "number" ? (
                  <span className="rounded-full border border-cyan-500/30 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                    {Math.round(snapshot.report.overall_score)}/100
                  </span>
                ) : null}
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-400">
                  {confidenceLabel(snapshot.report.confidence)}
                </span>
              </div>
            </div>
            <p className="mt-1 leading-relaxed opacity-90">{snapshot.report.summary}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PerformanceReportCard({ report, label = "Performance report" }: { report: PerformanceReport; label?: string }) {
  const overallScore =
    typeof report.overall_score === "number" ? Math.max(0, Math.min(100, Math.round(report.overall_score))) : null;
  const markerScores = report.marker_scores ?? [];

  return (
    <div className="space-y-4 rounded-md border border-cyan-500/20 bg-cyan-950/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {overallScore != null ? (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-950/50 px-3 py-0.5 font-mono text-sm text-cyan-100">
              {overallScore}
              <span className="ml-1 text-[10px] text-cyan-300/80">/100</span>
            </span>
          ) : null}
          <span className="rounded-full border border-cyan-400/25 bg-cyan-950/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200">
            {confidenceLabel(report.confidence)}
          </span>
        </div>
      </div>

      {markerScores.length > 0 ? (
        <div className="rounded-md border border-cyan-500/15 bg-black/20 px-3 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Competency profile</div>
          <MarkerRadarChart markers={markerScores} ariaLabel="Performance competency scores" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {markerScores.map((marker) => (
              <div key={marker.id} className="rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-300">{marker.label}</span>
                  <span className="font-mono text-sm text-cyan-200">{marker.score}</span>
                </div>
                <p className="mt-1 text-zinc-500">{marker.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-zinc-300">{report.summary}</p>

      {report.strengths.length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Strengths</div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {report.strengths.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-400">+</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.gap_analysis.gaps.length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            Gap analysis
          </div>
          <p className="mt-2 text-xs text-zinc-500">{report.gap_analysis.summary}</p>
          <ul className="mt-3 space-y-2">
            {report.gap_analysis.gaps.map((gap) => (
              <li
                key={gap.title}
                className={`rounded-md border px-3 py-2 text-xs ${severityColor(gap.severity)}`}
              >
                <div className="font-medium">{gap.title}</div>
                <p className="mt-1 opacity-80">{gap.evidence}</p>
                <p className="mt-1 opacity-70">Repair: {gap.suggested_repair}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.gap_analysis.next_practice.length > 0 ? (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            Next practice
          </div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {report.gap_analysis.next_practice.map((item) => (
              <li key={item}>→ {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}