"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Download,
  FileCode2,
  Gauge,
  LayoutGrid,
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
  CUSTOM_DEMO_ID,
  CUSTOM_DEMO_PICKER,
  isCustomDemoId,
} from "@/lib/evidence-api-demo/custom-demo";
import type { EvidenceApiDemoDefinition } from "@/lib/evidence-api-demo/demo-definition";
import { EVIDENCE_API_DEMOS, resolveDemoId } from "@/lib/evidence-api-demo/demos";
import {
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
} from "@/lib/evidence-api-demo/simulation";
import type {
  DemoWorkspaceBlock,
  SimulationAction,
  SimulationCategory,
  SimulationWorldState,
} from "@/lib/evidence-api-demo/types";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { readJsonResponse } from "@/lib/read-json-response";

type DemoPhase = "picker" | "intro" | "creating" | "simulating";
type DemoView = "simulator" | "evidence" | "evaluation" | "score";
type ScoreCardTab = "overview" | "competency" | "markers" | "strengths" | "gaps" | "history";

const DEMO_TAB_STAGE = "h-[48rem] w-full min-w-0";
const DEMO_TAB_PANEL =
  "box-border flex h-full w-full min-w-full max-w-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/70";
const DEMO_TAB_HEADER = "shrink-0 border-b border-zinc-800 px-5 py-4 sm:px-6";
const DEMO_TAB_BODY =
  "flex h-[38rem] w-full flex-col overflow-hidden p-5 sm:p-6";
const DEMO_TAB_BODY_SCROLL =
  "flex h-[38rem] w-full flex-col gap-6 overflow-y-auto p-5 sm:p-6";
const DEMO_SCORE_TABPANEL = "h-[28rem] w-full overflow-y-auto py-2";

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
  skill_md: string;
  spec_version?: string;
  evidenceCount: number;
  actionCount: number;
  simulatedDays: number;
  prefetch: boolean;
  timestamp: Date;
};

type SchemaSnapshot = {
  id: string;
  schema_name: string;
  spec_version?: string;
  spec: EvidenceEvalSchemaResult;
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
    id?: string;
    product: string;
    integration_name: string;
    eval_definition: string;
    model_doc_filename?: string;
    model_doc_preview?: string;
  };
  custom_definition?: EvidenceApiDemoDefinition;
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

type ConversionGoalSource = "workspace" | "inferred";

type PerformanceResponse = {
  mode: "report";
  workspace_conversion_goal: string;
  conversion_goal_source: ConversionGoalSource;
  report: PerformanceReport;
  evidence_summary: { evidence_artifacts: number; blocks: number };
  file_ids?: string[];
};

const STORAGE_KEY = "openlesson-evidence-api-demo";

type PersistedDemoState = {
  planId: string;
  sessionId: string;
  demoId: string;
  worldState: SimulationWorldState;
  workspaceTitle?: string;
  blocks?: DemoWorkspaceBlock[];
  customDemo?: EvidenceApiDemoDefinition;
  customPrompt?: string;
};

const CUSTOM_PROMPT_MIN_LENGTH = 40;

function buildDemoApiBody(demo: EvidenceApiDemoDefinition, payload: Record<string, unknown>) {
  return {
    ...payload,
    demoId: demo.id,
    ...(isCustomDemoId(demo.id) ? { customDefinition: demo } : {}),
  };
}

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
      demoId: parsed.demoId ?? "flowstack",
      worldState: parsed.worldState ?? {
        ...createInitialWorldState(),
        completedActions: legacySteps,
        actionCounts: Object.fromEntries(legacySteps.map((id: string) => [id, 1])),
      },
      workspaceTitle: parsed.workspaceTitle,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      customDemo: parsed.customDemo,
      customPrompt: parsed.customPrompt,
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
      return "border-zinc-500 bg-zinc-900 text-white";
    case "medium":
      return "border-zinc-700 bg-zinc-950 text-zinc-200";
    default:
      return "border-zinc-800 bg-black/30 text-zinc-300";
  }
}

function severityAccentBorder(severity: "low" | "medium" | "high") {
  switch (severity) {
    case "high":
      return "border-l-zinc-400";
    case "medium":
      return "border-l-zinc-600";
    default:
      return "border-l-zinc-800";
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
  const [phase, setPhase] = useState<DemoPhase>("picker");
  const [demoId, setDemoId] = useState<string | null>(null);
  const [customDemo, setCustomDemo] = useState<EvidenceApiDemoDefinition | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const activeDemo = useMemo(() => {
    if (isCustomDemoId(demoId)) return customDemo ?? CUSTOM_DEMO_PICKER;
    return resolveDemoId(demoId);
  }, [demoId, customDemo]);
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
  const [performanceResponseRaw, setPerformanceResponseRaw] = useState<PerformanceResponse | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportSnapshot[]>([]);
  const [skillHistory, setSkillHistory] = useState<SkillSnapshot[]>([]);
  const [schemaHistory, setSchemaHistory] = useState<SchemaSnapshot[]>([]);
  const [latestSkillMd, setLatestSkillMd] = useState<string | null>(null);
  const [latestSkillName, setLatestSkillName] = useState<string | null>(null);
  const [latestSchema, setLatestSchema] = useState<EvidenceEvalSchemaResult | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [isRegeneratingSkill, setIsRegeneratingSkill] = useState(false);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [lastSkillEvidenceCount, setLastSkillEvidenceCount] = useState<number | null>(null);
  const [skillRegenHint, setSkillRegenHint] = useState(false);
  const [activeView, setActiveView] = useState<DemoView>("simulator");
  const [backgroundImage, setBackgroundImage] = useState(() =>
    aestheticImageForId("evidence-api-demo")
  );

  const backgroundSeed = planId ?? demoId ?? "evidence-api-demo";

  const actionCount = totalActionCount(worldState);
  const distinctEvidenceActions = countDistinctEvidenceActions(activeDemo, worldState);

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
    let cancelled = false;
    setBackgroundImage(aestheticImageForId(backgroundSeed));

    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        const images = packages.flatMap((pkg) => pkg.images);
        if (images.length === 0) return;
        setBackgroundImage(aestheticImageForId(backgroundSeed, images));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [backgroundSeed]);

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
    setDemoId(persisted.demoId);
    setCustomDemo(persisted.customDemo ?? null);
    setCustomPrompt(persisted.customPrompt ?? "");
    setWorldState(persisted.worldState);
    setWorkspaceTitle(persisted.workspaceTitle ?? null);
    setBlocks(persisted.blocks ?? []);
    setEvidenceCount(totalActionCount(persisted.worldState));
    setPhase("simulating");
  }, [authState]);

  const handleSelectDemo = (demo: EvidenceApiDemoDefinition) => {
    setError("");
    setDemoId(demo.id);
    setCustomDemo(null);
    setCustomPrompt("");
    setPhase("intro");
  };

  const handleSelectCustomDemo = () => {
    setError("");
    setDemoId(CUSTOM_DEMO_ID);
    setCustomDemo(null);
    setPhase("intro");
  };

  const handleBackToPicker = () => {
    setError("");
    setPhase("picker");
  };

  const handleStartDemo = async () => {
    if (isCustomDemoId(demoId) && customPrompt.trim().length < CUSTOM_PROMPT_MIN_LENGTH) {
      setError(`Paste a scenario prompt of at least ${CUSTOM_PROMPT_MIN_LENGTH} characters.`);
      return;
    }

    setError("");
    setPhase("creating");
    clearPersistedState();
    const newSessionId = createSessionId();
    setSessionId(newSessionId);
    setWorldState(createInitialWorldState());
    setReport(null);
    setPerformanceResponseRaw(null);
    setReportHistory([]);
    setSkillHistory([]);
    setSchemaHistory([]);
    setLatestSkillMd(null);
    setLatestSkillName(null);
    setLatestSchema(null);
    setEvidenceCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setApiLog([]);
    setActiveView("simulator");

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/workspace",
      status: "pending",
      summary: isCustomDemoId(demoId)
        ? "Generating custom events and creating workspace…"
        : `Creating verification workspace for ${activeDemo.productName}…`,
    });

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/workspace",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demoId: activeDemo.id,
            ...(isCustomDemoId(demoId) ? { customPrompt: customPrompt.trim() } : {}),
          }),
        },
        isCustomDemoId(demoId) ? 180000 : 120000
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

      const generatedCustomDemo = data.custom_definition ?? null;
      if (generatedCustomDemo) {
        setCustomDemo(generatedCustomDemo);
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
        demoId: activeDemo.id,
        worldState: initialWorld,
        workspaceTitle: data.workspace.title,
        blocks: data.blocks,
        customDemo: generatedCustomDemo ?? undefined,
        customPrompt: isCustomDemoId(demoId) ? customPrompt.trim() : undefined,
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
    const payload = buildSimulationEvidencePayload(activeDemo, action, {
      sessionId,
      blockId,
      worldState,
      reflection:
        action.kind === "time_simulation"
          ? `${action.timeDeltaDays ?? 0} day(s) elapsed before the next product activity.`
          : `User completed "${action.label}" in ${activeDemo.productName}.`,
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
          tool_name:
            action.kind === "time_simulation" ? activeDemo.simulatorToolName : activeDemo.toolName,
          tool_action: action.id,
          file_name: `${action.id}-${(worldState.actionCounts[action.id] ?? 0) + 1}.json`,
          metadata: {
            source: "partner_integration",
            product: activeDemo.productName,
            integration: activeDemo.integrationName,
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
        demoId: activeDemo.id,
        worldState: nextWorld,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks,
        customDemo: isCustomDemoId(activeDemo.id) ? activeDemo : undefined,
        customPrompt: isCustomDemoId(activeDemo.id) ? customPrompt.trim() : undefined,
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
          body: JSON.stringify(
            buildDemoApiBody(activeDemo, {
              planId,
              definition: activeDemo.evalDefinition,
            })
          ),
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
          spec: data.spec,
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
          body: JSON.stringify(
            buildDemoApiBody(activeDemo, {
              planId,
              prefetch_evidence_spec: true,
            })
          ),
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

      setLatestSkillMd(data.skill_md);
      setLatestSkillName(data.skill_name);
      if (data.evidence_spec) {
        setLatestSchema(data.evidence_spec);
      }
      setLastSkillEvidenceCount(evidenceCount);

      setSkillHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          skill_name: data.skill_name,
          skill_md: data.skill_md,
          spec_version: data.evidence_spec?.spec_version,
          evidenceCount,
          actionCount,
          simulatedDays: worldState.simulatedDays,
          prefetch: data.evidence_spec_prefetched === true,
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
            spec: data.evidence_spec!,
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
      setPerformanceResponseRaw(data);
      setActiveView("score");
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

  const handleReset = () => {
    clearPersistedState();
    setPhase("picker");
    setDemoId(null);
    setCustomDemo(null);
    setCustomPrompt("");
    setPlanId(null);
    setWorkspaceTitle(null);
    setBlocks([]);
    setApiPaths(null);
    setPlanFiles([]);
    setModelDocPreview(null);
    setSessionId(createSessionId());
    setWorldState(createInitialWorldState());
    setReport(null);
    setPerformanceResponseRaw(null);
    setReportHistory([]);
    setSkillHistory([]);
    setSchemaHistory([]);
    setLatestSkillMd(null);
    setLatestSkillName(null);
    setLatestSchema(null);
    setIsReporting(false);
    setIsFetchingSchema(false);
    setIsRegeneratingSkill(false);
    setEvidenceCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setApiLog([]);
    setError("");
    setActiveView("simulator");
  };

  const showViewSwitcher = phase === "simulating";

  if (authState === "loading") {
    return (
      <DemoFlowShell backgroundImage={backgroundImage}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm text-zinc-500">Checking your account…</p>
        </div>
      </DemoFlowShell>
    );
  }

  if (authState === "guest") {
    return (
      <AuthGate
        backgroundImage={backgroundImage}
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
        backgroundImage={backgroundImage}
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
    <DemoFlowShell backgroundImage={backgroundImage}>
      <Navbar
        breadcrumbs={[
          { label: "Evidence API Demo", href: "/evidence-api-demo" },
        ]}
        showNav={false}
      />

      <header className="border-b border-zinc-800/80 bg-zinc-950/55 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              Interactive demo
            </div>
            <h1 className="mt-2 text-3xl font-medium tracking-[-1px] text-white sm:text-4xl">
              Evidence API in action
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Pick a verification scenario — trial onboarding, month-end close, launch audit, or escalation
              certification — then watch OpenLesson score competency from live evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/docs/agentic-v2"
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              API reference
            </Link>
            {phase !== "picker" ? (
              <button
                type="button"
                onClick={handleBackToPicker}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Demo selection
              </button>
            ) : null}
            {planId ? (
              <>
                <Link
                  href={`/workspace/${planId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Open workspace
                </Link>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Reset demo setup
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {showViewSwitcher ? (
        <DemoStatusBar
          planId={planId}
          worldState={worldState}
          evidenceCount={evidenceCount}
          actionCount={actionCount}
          phase={phase}
          isReporting={isReporting}
          isFetchingSchema={isFetchingSchema}
          isRegeneratingSkill={isRegeneratingSkill}
          report={report}
        />
      ) : null}

      {showViewSwitcher ? (
        <DemoViewSwitcher
          activeView={activeView}
          onChange={setActiveView}
          hasReport={!!report}
          evidenceCount={evidenceCount}
        />
      ) : null}

      <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:py-8">
        {phase === "picker" ? (
          <DemoUseCasePicker
            demos={EVIDENCE_API_DEMOS}
            onSelect={handleSelectDemo}
            onSelectCustom={handleSelectCustomDemo}
          />
        ) : null}

        {error && activeView !== "evidence" && phase !== "picker" ? (
          <p className="mb-4 rounded-md border border-zinc-600 bg-zinc-950 px-4 py-3 text-sm text-zinc-200">
            {error}
          </p>
        ) : null}

        {phase !== "picker" && !showViewSwitcher ? (
          <SimulatorPanel
            demo={activeDemo}
            phase={phase}
            worldState={worldState}
            runningActionId={runningActionId}
            onStart={handleStartDemo}
            onRunAction={handleRunAction}
            onBackToPicker={handleBackToPicker}
            isCustom={isCustomDemoId(demoId)}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            customPromptMinLength={CUSTOM_PROMPT_MIN_LENGTH}
          />
        ) : null}

        {showViewSwitcher ? (
          <div className={DEMO_TAB_STAGE}>
            {activeView === "simulator" ? (
              <SimulatorPanel
                demo={activeDemo}
                phase={phase}
                worldState={worldState}
                runningActionId={runningActionId}
                onStart={handleStartDemo}
                onRunAction={handleRunAction}
                onBackToPicker={handleBackToPicker}
                fullHeight
                isCustom={isCustomDemoId(demoId)}
                customPrompt={customPrompt}
                onCustomPromptChange={setCustomPrompt}
                customPromptMinLength={CUSTOM_PROMPT_MIN_LENGTH}
              />
            ) : null}

            {activeView === "evidence" ? (
              <EvidenceLayerView
                planId={planId}
                workspaceTitle={workspaceTitle}
                apiPaths={apiPaths}
                planFiles={planFiles}
                sessionId={sessionId}
                apiLog={apiLog}
                error={error}
                onReset={handleReset}
              />
            ) : null}

            {activeView === "evaluation" ? (
              <ContinuousEvaluationView
                planId={planId}
                evidenceCount={evidenceCount}
                isFetchingSchema={isFetchingSchema}
                isRegeneratingSkill={isRegeneratingSkill}
                skillRegenHint={skillRegenHint}
                error={error}
                skillHistory={skillHistory}
                schemaHistory={schemaHistory}
                latestSkillMd={latestSkillMd}
                latestSkillName={latestSkillName}
                latestSchema={latestSchema}
                onFetchEvidenceSchema={handleFetchEvidenceSchema}
                onRegenerateSkill={handleRegenerateSkill}
              />
            ) : null}

            {activeView === "score" ? (
              <ScoreView
                worldState={worldState}
                evidenceCount={evidenceCount}
                actionCount={actionCount}
                distinctEvidenceActions={distinctEvidenceActions}
                isReporting={isReporting}
                report={report}
                performanceResponse={performanceResponseRaw}
                reportHistory={reportHistory}
                onRequestPerformance={handleRequestPerformance}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      <Footer />
    </DemoFlowShell>
  );
}

function DemoAestheticBackground({ image }: { image: string }) {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${image})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/84" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(24,24,27,0.45),transparent_34%),radial-gradient(circle_at_12%_82%,rgba(9,9,11,0.55),transparent_38%)]" />
    </>
  );
}

function DemoFlowShell({
  backgroundImage,
  children,
}: {
  backgroundImage: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200">
      <DemoAestheticBackground image={backgroundImage} />
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

function AuthGate({
  backgroundImage,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  backgroundImage: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <DemoFlowShell backgroundImage={backgroundImage}>
      <Navbar showNav={false} />
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-950">
          <Zap className="size-5 text-white" />
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
    </DemoFlowShell>
  );
}

function DemoStatusBar({
  planId,
  worldState,
  evidenceCount,
  actionCount,
  phase,
  isReporting,
  isFetchingSchema,
  isRegeneratingSkill,
  report,
}: {
  planId: string | null;
  worldState: SimulationWorldState;
  evidenceCount: number;
  actionCount: number;
  phase: DemoPhase;
  isReporting: boolean;
  isFetchingSchema: boolean;
  isRegeneratingSkill: boolean;
  report: PerformanceReport | null;
}) {
  const statusLabel = isRegeneratingSkill
    ? "Regenerating skill"
    : isFetchingSchema
      ? "Fetching spec"
      : isReporting
        ? "Scoring"
        : phase === "simulating"
          ? "Live"
          : "Idle";

  const overallScore =
    typeof report?.overall_score === "number"
      ? Math.round(Math.max(0, Math.min(100, report.overall_score)))
      : null;
  const conversionScore =
    typeof report?.conversion_score === "number"
      ? Math.round(Math.max(0, Math.min(100, report.conversion_score)))
      : null;

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-mono text-zinc-500">
            Day <span className="text-white">{worldState.simulatedDays}</span>
          </span>
          <span className="font-mono text-zinc-500">
            Actions <span className="text-white">{actionCount}</span>
          </span>
          <span className="font-mono text-zinc-500">
            Evidence <span className="text-white">{evidenceCount}</span>
          </span>
          {overallScore != null ? (
            <span className="font-mono text-zinc-500">
              Learning <span className="text-white">{overallScore}/100</span>
            </span>
          ) : null}
          {conversionScore != null ? (
            <span className="font-mono text-zinc-500">
              Conversion <span className="text-white">{conversionScore}%</span>
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-zinc-700 bg-black/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
            {statusLabel}
          </span>
          {planId ? (
            <code className="hidden font-mono text-[10px] text-zinc-600 sm:inline">
              {planId.slice(0, 8)}…
            </code>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DemoViewSwitcher({
  activeView,
  onChange,
  hasReport,
  evidenceCount,
}: {
  activeView: DemoView;
  onChange: (view: DemoView) => void;
  hasReport: boolean;
  evidenceCount: number;
}) {
  const tabs: Array<{
    id: DemoView;
    label: string;
    description: string;
    icon: typeof LayoutGrid;
    badge?: string;
  }> = [
    {
      id: "simulator",
      label: "Event simulator",
      description: "Product event simulator",
      icon: LayoutGrid,
    },
    {
      id: "evidence",
      label: "Evidence layer",
      description: "API log & workspace context",
      icon: Radio,
      badge: evidenceCount > 0 ? String(evidenceCount) : undefined,
    },
    {
      id: "evaluation",
      label: "Continuous evaluation",
      description: "Regenerate & download specs",
      icon: RefreshCw,
    },
    {
      id: "score",
      label: "Score card",
      description: "Performance & gaps",
      icon: Gauge,
      badge: hasReport ? "New" : undefined,
    },
  ];

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/55 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="flex gap-1 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Demo views"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(tab.id)}
                className={`flex min-w-[10.5rem] flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition sm:min-w-0 ${
                  isActive
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/50"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${isActive ? "text-white" : "text-zinc-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? "text-white" : "text-zinc-300"}`}>
                      {tab.label}
                    </span>
                    {tab.badge ? (
                      <span
                        className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300"
                      >
                        {tab.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">{tab.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function demoPanelStyles(_accent?: EvidenceApiDemoDefinition["accent"]) {
  return {
    section: "border-zinc-800 bg-zinc-950/70",
    headerBorder: "border-zinc-800",
    badge: "border-zinc-700 bg-black/40 text-zinc-300",
    logo: "bg-white text-black",
    subtitle: "text-zinc-500",
    statBorder: "border-zinc-800",
    statLabel: "text-zinc-500",
    bodyText: "text-zinc-400",
    sparkles: "text-zinc-300",
    button: "bg-white text-black hover:bg-zinc-200",
    actionDefault: "border-zinc-800 bg-black/20 hover:border-zinc-600",
    actionCount: "bg-zinc-800 text-zinc-300",
    actionText: "text-zinc-500",
    actionCta: "text-zinc-300",
  };
}

function DemoUseCasePicker({
  demos,
  onSelect,
  onSelectCustom,
}: {
  demos: EvidenceApiDemoDefinition[];
  onSelect: (demo: EvidenceApiDemoDefinition) => void;
  onSelectCustom: () => void;
}) {
  const customStyles = demoPanelStyles(CUSTOM_DEMO_PICKER.accent);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5 sm:p-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          Step 1 · Choose a use case
        </div>
        <h2 className="mt-2 text-2xl font-medium text-white sm:text-3xl">Which scenario are we verifying?</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Pick a preset verification program or paste your own prompt to generate dynamic event actions — same
          evidence API flow throughout.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {demos.map((demo) => {
          const styles = demoPanelStyles(demo.accent);
          return (
            <button
              key={demo.id}
              type="button"
              onClick={() => onSelect(demo)}
              className={`group rounded-lg border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${styles.section}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-md text-sm font-bold ${styles.logo}`}
                  >
                    {demo.initials}
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">{demo.productName}</div>
                    <div className={`text-xs ${styles.subtitle}`}>{demo.tagline}</div>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${styles.badge}`}
                >
                  {demo.useCase}
                </span>
              </div>
              <p className={`mt-4 text-sm leading-relaxed ${styles.bodyText}`}>{demo.description}</p>
              <div className="mt-5 flex items-center gap-2 text-xs font-medium text-white/90">
                Run this demo
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSelectCustom}
        className={`group mt-4 w-full rounded-lg border border-dashed p-5 text-left transition hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-lg hover:shadow-black/20 ${customStyles.section}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-bold ${customStyles.logo}`}
            >
              {CUSTOM_DEMO_PICKER.initials}
            </div>
            <div>
              <div className="text-base font-medium text-white">Custom simulation</div>
              <div className={`text-xs ${customStyles.subtitle}`}>{CUSTOM_DEMO_PICKER.tagline}</div>
              <p className={`mt-3 max-w-2xl text-sm leading-relaxed ${customStyles.bodyText}`}>
                {CUSTOM_DEMO_PICKER.description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-white/90 sm:pt-2">
            Paste your prompt
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>
    </section>
  );
}

function countCategoryActivity(
  demo: EvidenceApiDemoDefinition,
  category: SimulationCategory,
  worldState: SimulationWorldState
): { completed: number; total: number } {
  const actions = getActionsByCategory(demo, category);
  const completed = actions.filter((action) => hasCompletedAction(worldState, action.id)).length;
  return { completed, total: actions.length };
}

function SimulatorPanel({
  demo,
  phase,
  worldState,
  runningActionId,
  onStart,
  onRunAction,
  onBackToPicker,
  fullHeight = false,
  isCustom = false,
  customPrompt = "",
  onCustomPromptChange,
  customPromptMinLength = 40,
}: {
  demo: EvidenceApiDemoDefinition;
  phase: DemoPhase;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onStart: () => void;
  onRunAction: (action: SimulationAction) => void;
  onBackToPicker?: () => void;
  fullHeight?: boolean;
  isCustom?: boolean;
  customPrompt?: string;
  onCustomPromptChange?: (value: string) => void;
  customPromptMinLength?: number;
}) {
  const styles = demoPanelStyles(demo.accent);
  const totalActions = demo.actions.filter((action) => action.kind === "evidence").length;
  const explored = countDistinctEvidenceActions(demo, worldState);
  const coveragePercent = Math.round((explored / totalActions) * 100);
  const [activeCategory, setActiveCategory] = useState<SimulationCategory>(demo.categoryOrder[0]);

  useEffect(() => {
    setActiveCategory(demo.categoryOrder[0]);
  }, [demo.id]);

  return (
    <section
      className={
        fullHeight
          ? DEMO_TAB_PANEL
          : `flex w-full flex-col overflow-hidden rounded-lg border ${styles.section}`
      }
    >
      <div
        className={
          fullHeight
            ? `${DEMO_TAB_HEADER} ${styles.headerBorder}`
            : `shrink-0 border-b px-5 py-4 sm:px-6 ${styles.headerBorder}`
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-md text-sm font-bold ${styles.logo}`}
            >
              {demo.initials}
            </div>
            <div>
              <div className="text-sm font-medium text-white">{demo.productName}</div>
              <div className={`text-xs ${styles.subtitle}`}>
                {demo.useCase} · {demo.tagline}
              </div>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${styles.badge}`}
          >
            {demo.saasCategory}
          </span>
        </div>
      </div>

      <div className={fullHeight ? DEMO_TAB_BODY : "flex flex-1 flex-col p-5 sm:p-6"}>
        {phase === "intro" || phase === "creating" ? (
          <div className="flex flex-1 flex-col justify-center py-8">
            <Sparkles className={`size-8 ${styles.sparkles}`} />
            <h2 className="mt-4 text-xl font-medium text-white">
              {isCustom ? "Custom verification scenario" : demo.scenarioTitle}
            </h2>
            {isCustom ? (
              <>
                <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${styles.bodyText}`}>
                  Describe the product workflow, learner role, and competency you want to verify. OpenLesson
                  generates event actions and a workspace from your prompt. Calendar gap tools (+1 day, +3
                  days, +1 week) are always included.
                </p>
                <label className="mt-6 block max-w-2xl">
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    Scenario prompt
                  </span>
                  <textarea
                    value={customPrompt}
                    onChange={(event) => onCustomPromptChange?.(event.target.value)}
                    disabled={phase === "creating"}
                    rows={8}
                    placeholder="Example: Verify that sales engineers can configure Acme CRM trial workspaces — connect email, import contacts, build a pipeline, invite a manager, recover from bad field mapping, and return after a week idle…"
                    className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-black/40 px-4 py-3 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
                  />
                  <span className="mt-2 block font-mono text-[10px] text-zinc-600">
                    {customPrompt.trim().length}/{customPromptMinLength} characters minimum
                  </span>
                </label>
              </>
            ) : (
              <p className={`mt-2 max-w-md text-sm leading-relaxed ${styles.bodyText}`}>
                {demo.scenarioIntro.replace(/\*\*/g, "")} Use calendar gap tools to record idle time between
                sessions — then regenerate OpenLesson specs as evidence grows.
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              disabled={
                phase === "creating" ||
                (isCustom && customPrompt.trim().length < customPromptMinLength)
              }
              className={`inline-flex w-fit items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
            >
              {phase === "creating" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isCustom ? "Generating events & workspace…" : "Creating workspace…"}
                </>
              ) : (
                <>
                  {isCustom ? "Generate & start" : "Start demo"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
            {onBackToPicker ? (
              <button
                type="button"
                onClick={onBackToPicker}
                disabled={phase === "creating"}
                className="text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
              >
                Choose a different use case
              </button>
            ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 shrink-0 grid grid-cols-3 gap-2 text-center">
              <div className={`rounded-md border bg-black/25 px-2 py-2 ${styles.statBorder}`}>
                <div className={`font-mono text-[10px] uppercase tracking-wide ${styles.statLabel}`}>Day</div>
                <div className="mt-1 font-mono text-lg text-white">{worldState.simulatedDays}</div>
              </div>
              <div className={`rounded-md border bg-black/25 px-2 py-2 ${styles.statBorder}`}>
                <div className={`font-mono text-[10px] uppercase tracking-wide ${styles.statLabel}`}>Actions</div>
                <div className="mt-1 font-mono text-lg text-white">{totalActionCount(worldState)}</div>
              </div>
              <div className={`rounded-md border bg-black/25 px-2 py-2 ${styles.statBorder}`}>
                <div className={`font-mono text-[10px] uppercase tracking-wide ${styles.statLabel}`}>Coverage</div>
                <div className="mt-1 font-mono text-lg text-white">{coveragePercent}%</div>
              </div>
            </div>

            <div className="mb-4 shrink-0 border-b border-zinc-800">
              <div
                className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Event categories"
              >
                {demo.categoryOrder.map((category) => {
                  const meta = demo.categoryMeta[category];
                  const { completed, total } = countCategoryActivity(demo, category, worldState);
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveCategory(category)}
                      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-left transition ${
                        isActive
                          ? "border-white text-white"
                          : "border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      <span className="whitespace-nowrap text-xs font-medium">{meta.label}</span>
                      {completed > 0 ? (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
                          {completed}/{total}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className={`mb-4 shrink-0 text-xs leading-relaxed ${styles.bodyText}`}>
              {demo.categoryMeta[activeCategory].description}
            </p>

            <div
              className={`pr-1 ${fullHeight ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[32rem] overflow-y-auto"}`}
            >
              <SimulationCategorySection
                demo={demo}
                category={activeCategory}
                worldState={worldState}
                runningActionId={runningActionId}
                onRunAction={onRunAction}
                wideLayout={fullHeight}
                styles={styles}
                hideHeader
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SimulationCategorySection({
  demo,
  category,
  worldState,
  runningActionId,
  onRunAction,
  wideLayout = false,
  styles,
  hideHeader = false,
}: {
  demo: EvidenceApiDemoDefinition;
  category: SimulationCategory;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onRunAction: (action: SimulationAction) => void;
  wideLayout?: boolean;
  styles: ReturnType<typeof demoPanelStyles>;
  hideHeader?: boolean;
}) {
  const meta = demo.categoryMeta[category];
  const actions = getActionsByCategory(demo, category);
  const isTimeTools = category === "simulation_tools";

  return (
    <div>
      {!hideHeader ? (
        <div className="mb-2 flex items-center gap-2">
          {isTimeTools ? <Clock className="size-3.5 text-zinc-400" /> : null}
          <div>
            <div className="text-xs font-medium text-white">{meta.label}</div>
            <div className={`text-[10px] ${styles.actionText}`}>{meta.description}</div>
          </div>
        </div>
      ) : null}
      <div
        className={`grid gap-2 ${
          isTimeTools
            ? wideLayout
              ? "sm:grid-cols-3 lg:grid-cols-4"
              : "sm:grid-cols-3"
            : wideLayout
              ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "sm:grid-cols-2"
        }`}
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
                done
                  ? "border-zinc-600 bg-zinc-900/80"
                  : styles.actionDefault
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-white">{action.label}</span>
                {count > 0 ? (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] ${styles.actionCount}`}
                  >
                    ×{count}
                  </span>
                ) : null}
              </div>
              <p className={`mt-1 text-[10px] leading-relaxed ${styles.actionText}`}>{action.description}</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium ${styles.actionCta}`}>
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

function sanitizeDownloadPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_|_$/g, "") || "file";
}

function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJsonFile(filename: string, data: unknown) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

function EvidenceLayerView({
  planId,
  workspaceTitle,
  apiPaths,
  planFiles,
  sessionId,
  apiLog,
  error,
  onReset,
}: {
  planId: string | null;
  workspaceTitle: string | null;
  apiPaths: WorkspaceResponse["api_paths"] | null;
  planFiles: PlanFileSummary[];
  sessionId: string;
  apiLog: ApiLogEntry[];
  error: string;
  onReset: () => void;
}) {
  return (
    <section className={DEMO_TAB_PANEL}>
      <div className={DEMO_TAB_HEADER}>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-zinc-300" />
          <div>
            <div className="text-sm font-medium text-white">OpenLesson verification layer</div>
            <div className="text-xs text-zinc-500">Workspace context and live API activity</div>
          </div>
        </div>
      </div>

      <div className={DEMO_TAB_BODY_SCROLL}>
        <div className="grid w-full min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          {workspaceTitle ? (
            <div className="rounded-md border border-zinc-800 bg-black/30 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                Verification workspace
              </div>
              <div className="mt-1 text-base text-white">{workspaceTitle}</div>
              {planId ? (
                <code className="mt-1 block truncate font-mono text-[11px] text-zinc-500">{planId}</code>
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              API activity
            </div>
            {apiLog.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                Run simulation actions to stream evidence uploads here.
              </p>
            ) : (
              <ul className="space-y-2 pr-1">
                {apiLog.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md border border-zinc-800/80 bg-black/40 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                        {entry.method}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">{entry.path}</span>
                      <span
                        className={`ml-auto font-mono text-[10px] uppercase ${
                          entry.status === "success"
                            ? "text-white"
                            : entry.status === "error"
                              ? "text-zinc-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-300">{entry.summary}</p>
                    {entry.detail ? (
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">{entry.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? <p className="text-sm text-zinc-300">{error}</p> : null}

          {planId ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Reset demo session
              </button>
              <p className="font-mono text-[10px] text-zinc-600">session: {sessionId.slice(0, 8)}…</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {planFiles.length > 0 ? (
            <div className="rounded-md border border-zinc-800 bg-black/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                Workspace files (plan_files)
              </div>
              <ul className="mt-3 space-y-2">
                {planFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800/80 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-zinc-300">{file.file_name}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {file.mime_type} · {Math.round(file.file_size / 1024)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {apiPaths ? (
            <div className="rounded-md border border-zinc-800 bg-black/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                Production API paths
              </div>
              <ul className="mt-2 space-y-1.5 font-mono text-[10px] text-zinc-400">
                <li>POST …/evidence</li>
                <li>POST …/performance</li>
                <li>POST …/evidence-schema</li>
                <li>POST …/integration-skill</li>
              </ul>
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </section>
  );
}

function DownloadArtifactButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
    >
      <Download className="size-3.5" />
      {label}
    </button>
  );
}

function ContinuousEvaluationView({
  planId,
  evidenceCount,
  isFetchingSchema,
  isRegeneratingSkill,
  skillRegenHint,
  error,
  skillHistory,
  schemaHistory,
  latestSkillMd,
  latestSkillName,
  latestSchema,
  onFetchEvidenceSchema,
  onRegenerateSkill,
}: {
  planId: string | null;
  evidenceCount: number;
  isFetchingSchema: boolean;
  isRegeneratingSkill: boolean;
  skillRegenHint: boolean;
  error: string;
  skillHistory: SkillSnapshot[];
  schemaHistory: SchemaSnapshot[];
  latestSkillMd: string | null;
  latestSkillName: string | null;
  latestSchema: EvidenceEvalSchemaResult | null;
  onFetchEvidenceSchema: () => void;
  onRegenerateSkill: () => void;
}) {
  const canRegenerate = !!planId && evidenceCount > 0;
  const hasArtifacts = schemaHistory.length > 0 || skillHistory.length > 0;

  return (
    <section className={DEMO_TAB_PANEL}>
      <div className={DEMO_TAB_HEADER}>
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-zinc-300" />
          <div>
            <div className="text-sm font-medium text-white">Continuous evaluation</div>
            <div className="text-xs text-zinc-500">
              Regenerate living specs and skills as evidence accumulates — download the full files.
            </div>
          </div>
        </div>
      </div>

      <div className={DEMO_TAB_BODY_SCROLL}>
        {!canRegenerate ? (
          <p className="rounded-md border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
            Run at least one simulation action to unlock spec and skill regeneration.
          </p>
        ) : (
          <>
            {skillRegenHint ? (
              <p className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                Evidence crossed a threshold ({evidenceCount} artifacts). Regenerate the integration
                skill to keep partner agents aligned.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onFetchEvidenceSchema}
                disabled={isFetchingSchema || isRegeneratingSkill}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-black/30 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingSchema ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCode2 className="size-4" />
                )}
                Re-fetch evidence spec
              </button>
              <button
                type="button"
                onClick={onRegenerateSkill}
                disabled={isRegeneratingSkill || isFetchingSchema}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRegeneratingSkill ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Regenerate skill.md
                {skillHistory.length > 0 ? ` (v${skillHistory.length + 1})` : ""}
              </button>
            </div>

            {error ? <p className="text-sm text-zinc-300">{error}</p> : null}

            {hasArtifacts ? (
              <div className="space-y-6">
                {latestSchema || latestSkillMd ? (
                  <div className="rounded-md border border-zinc-800 bg-black/30 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                      Latest artifacts
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {latestSchema ? (
                        <DownloadArtifactButton
                          label={`${latestSchema.schema_name}.json`}
                          onClick={() =>
                            downloadJsonFile(
                              `${sanitizeDownloadPart(latestSchema.schema_name)}.json`,
                              latestSchema
                            )
                          }
                        />
                      ) : null}
                      {latestSkillMd ? (
                        <DownloadArtifactButton
                          label={latestSkillName ? `${latestSkillName}.md` : "skill.md"}
                          onClick={() =>
                            downloadTextFile(
                              `${sanitizeDownloadPart(latestSkillName || "skill")}.md`,
                              latestSkillMd,
                              "text/markdown;charset=utf-8"
                            )
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {schemaHistory.length > 0 ? (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                      Evidence spec versions
                    </div>
                    <ul className="mt-3 space-y-2">
                      {schemaHistory.map((snapshot, index) => (
                        <li
                          key={snapshot.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800/80 bg-black/25 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-sm text-zinc-200">{snapshot.schema_name}</div>
                            <div className="mt-1 font-mono text-[10px] text-zinc-500">
                              v{index + 1}
                              {snapshot.spec_version ? ` · spec ${snapshot.spec_version}` : ""} · day{" "}
                              {snapshot.simulatedDays} · {snapshot.evidenceCount} artifacts
                            </div>
                          </div>
                          <DownloadArtifactButton
                            label="Download JSON"
                            onClick={() =>
                              downloadJsonFile(
                                `${sanitizeDownloadPart(snapshot.schema_name)}-v${index + 1}.json`,
                                snapshot.spec
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {skillHistory.length > 0 ? (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                      skill.md versions
                    </div>
                    <ul className="mt-3 space-y-2">
                      {skillHistory.map((snapshot, index) => (
                        <li
                          key={snapshot.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800/80 bg-black/25 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-200">{snapshot.skill_name}</div>
                            <div className="mt-1 font-mono text-[10px] text-zinc-500">
                              v{index + 1} · day {snapshot.simulatedDays} · {snapshot.evidenceCount} artifacts
                              {snapshot.prefetch ? " · prefetched spec" : ""}
                            </div>
                          </div>
                          <DownloadArtifactButton
                            label="Download .md"
                            onClick={() =>
                              downloadTextFile(
                                `${sanitizeDownloadPart(snapshot.skill_name)}-v${index + 1}.md`,
                                snapshot.skill_md,
                                "text/markdown;charset=utf-8"
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Regenerate a spec or skill to download the generated artifacts.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ScoreView({
  worldState,
  evidenceCount,
  actionCount,
  distinctEvidenceActions,
  isReporting,
  report,
  performanceResponse,
  reportHistory,
  onRequestPerformance,
}: {
  worldState: SimulationWorldState;
  evidenceCount: number;
  actionCount: number;
  distinctEvidenceActions: number;
  isReporting: boolean;
  report: PerformanceReport | null;
  performanceResponse: PerformanceResponse | null;
  reportHistory: ReportSnapshot[];
  onRequestPerformance: () => void;
}) {
  const canRequestScore = evidenceCount > 0;
  const latestSnapshot = reportHistory[reportHistory.length - 1];
  const [showRawResponse, setShowRawResponse] = useState(false);

  useEffect(() => {
    setShowRawResponse(false);
  }, [latestSnapshot?.id]);

  return (
    <section className={DEMO_TAB_PANEL}>
      <div className={DEMO_TAB_HEADER}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md border border-zinc-700 bg-black/40">
              <BarChart3 className="size-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-medium text-white">Performance score card</div>
              <div className="text-sm text-zinc-500">
                Request scores at any point — branch freely, simulate idle days, then score again.
              </div>
            </div>
          </div>
          {canRequestScore ? (
            <button
              type="button"
              onClick={onRequestPerformance}
              disabled={isReporting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
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
          ) : null}
        </div>
        {canRequestScore ? (
          <p className="mt-3 text-xs text-zinc-500">
            {distinctEvidenceActions} distinct actions · {actionCount} total events · day{" "}
            {worldState.simulatedDays} · {evidenceCount} evidence artifact
            {evidenceCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Run scenario actions in the Event simulator tab to upload evidence, then request your first score.
          </p>
        )}
      </div>

      <div className={DEMO_TAB_BODY}>
        {report && performanceResponse ? (
          <div className="flex shrink-0 items-center justify-end">
            <div
              className="inline-flex rounded-md border border-zinc-800 bg-black/30 p-0.5"
              role="group"
              aria-label="Score card display mode"
            >
              <button
                type="button"
                onClick={() => setShowRawResponse(false)}
                aria-pressed={!showRawResponse}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  !showRawResponse
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setShowRawResponse(true)}
                aria-pressed={showRawResponse}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  showRawResponse
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>
        ) : null}

        {report && showRawResponse && performanceResponse ? (
          <div className="flex h-[34rem] w-full flex-col gap-3 overflow-hidden">
            <div className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
              POST /api/evidence-api-demo/performance
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400 sm:text-sm">
              {JSON.stringify(performanceResponse, null, 2)}
            </pre>
          </div>
        ) : null}

        {report && !showRawResponse ? (
          <div className="w-full">
            <PerformanceReportCard
              key={latestSnapshot?.id ?? "report"}
              report={report}
              reportHistory={reportHistory}
              layout="spacious"
              workspaceConversionGoal={performanceResponse?.workspace_conversion_goal}
              conversionGoalSource={performanceResponse?.conversion_goal_source}
              label={
                latestSnapshot
                  ? `Latest score · day ${latestSnapshot.simulatedDays} · ${latestSnapshot.actionCount} actions`
                  : "Performance report"
              }
            />
          </div>
        ) : report ? null : (
          <div className="flex h-[34rem] w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 px-6 py-16 text-center">
            <Gauge className="size-10 text-zinc-600" />
            <h3 className="mt-4 text-lg font-medium text-zinc-300">No score yet</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              Run scenario events, then request a performance report to see the competency spider chart,
              marker breakdown, and gap analysis.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ScoreEvolution({ history, flat = false }: { history: ReportSnapshot[]; flat?: boolean }) {
  return (
    <div className={flat ? "space-y-4" : "rounded-md border border-zinc-800 bg-black/30 p-3"}>
      {!flat ? (
        <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
          Score evolution
        </div>
      ) : null}
      <ol className={flat ? "space-y-4" : "mt-3 space-y-2"}>
        {history.map((snapshot, index) => (
          <li
            key={snapshot.id}
            className={
              flat
                ? `border-b border-zinc-800/60 pb-4 text-sm last:border-b-0 ${
                    index === history.length - 1 ? "text-zinc-200" : "text-zinc-400"
                  }`
                : `rounded-md border px-3 py-2 text-xs ${
                    index === history.length - 1
                      ? "border-zinc-600 bg-zinc-900 text-zinc-200"
                      : "border-zinc-800/80 text-zinc-400"
                  }`
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">
                Check {index + 1} · day {snapshot.simulatedDays} · {snapshot.actionCount} action
                {snapshot.actionCount === 1 ? "" : "s"}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {typeof snapshot.report.overall_score === "number" ? (
                  <span className="rounded-full border border-zinc-600 px-2 py-0.5 font-mono text-[10px] text-white">
                    L {Math.round(snapshot.report.overall_score)}/100
                  </span>
                ) : null}
                {typeof snapshot.report.conversion_score === "number" ? (
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-white">
                    C {Math.round(snapshot.report.conversion_score)}%
                  </span>
                ) : null}
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-400">
                  {confidenceLabel(snapshot.report.confidence)}
                </span>
              </div>
            </div>
            <p className={`mt-2 leading-relaxed opacity-90 ${flat ? "text-sm" : ""}`}>
              {snapshot.report.summary}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAvailableScoreCardTabs(
  report: PerformanceReport,
  reportHistory: ReportSnapshot[] = [],
): ScoreCardTab[] {
  const tabs: ScoreCardTab[] = ["overview"];
  const markerScores = report.marker_scores ?? [];
  if (markerScores.length > 0) {
    tabs.push("competency", "markers");
  }
  if (report.strengths.length > 0) tabs.push("strengths");
  if (report.gap_analysis.gaps.length > 0 || report.gap_analysis.next_practice.length > 0) {
    tabs.push("gaps");
  }
  if (reportHistory.length > 0) tabs.push("history");
  return tabs;
}

function scoreCardTabBadge(
  tab: ScoreCardTab,
  report: PerformanceReport,
  reportHistory: ReportSnapshot[],
): string | undefined {
  const markerScores = report.marker_scores ?? [];
  switch (tab) {
    case "markers":
      return markerScores.length > 0 ? String(markerScores.length) : undefined;
    case "strengths":
      return report.strengths.length > 0 ? String(report.strengths.length) : undefined;
    case "gaps": {
      const count = report.gap_analysis.gaps.length + report.gap_analysis.next_practice.length;
      return count > 0 ? String(count) : undefined;
    }
    case "history":
      return reportHistory.length > 0 ? String(reportHistory.length) : undefined;
    default:
      return undefined;
  }
}

function ScoreCardTabBar({
  tabs,
  activeTab,
  onChange,
  report,
  reportHistory,
}: {
  tabs: ScoreCardTab[];
  activeTab: ScoreCardTab;
  onChange: (tab: ScoreCardTab) => void;
  report: PerformanceReport;
  reportHistory: ReportSnapshot[];
}) {
  const tabLabels: Record<ScoreCardTab, string> = {
    overview: "Overview",
    competency: "Competency",
    markers: "Markers",
    strengths: "Strengths",
    gaps: "Gaps",
    history: "History",
  };

  return (
    <div className="border-b border-zinc-800">
      <div
        className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Score card sections"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const badge = scoreCardTabBadge(tab, report, reportHistory);
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <span className="whitespace-nowrap text-sm font-medium">{tabLabels[tab]}</span>
              {badge ? (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PerformanceReportCard({
  report,
  label = "Performance report",
  layout = "compact",
  reportHistory = [],
  workspaceConversionGoal,
  conversionGoalSource,
}: {
  report: PerformanceReport;
  label?: string;
  layout?: "compact" | "spacious";
  reportHistory?: ReportSnapshot[];
  workspaceConversionGoal?: string;
  conversionGoalSource?: ConversionGoalSource;
}) {
  const overallScore = clampScore(report.overall_score);
  const conversionScore = clampScore(report.conversion_score);
  const conversionGoal =
    workspaceConversionGoal?.trim() || report.conversion_goal?.trim() || null;
  const markerScores = report.marker_scores ?? [];
  const isSpacious = layout === "spacious";
  const availableTabs = useMemo(
    () => getAvailableScoreCardTabs(report, reportHistory),
    [report, reportHistory],
  );
  const [activeTab, setActiveTab] = useState<ScoreCardTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [report, label]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "overview");
    }
  }, [activeTab, availableTabs]);

  if (isSpacious) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm text-zinc-400">{label}</h3>
          <div className="flex flex-wrap items-center gap-3">
            {overallScore != null ? (
              <span className="font-mono text-2xl text-white">
                L {overallScore}
                <span className="ml-1 text-sm text-zinc-500">/100</span>
              </span>
            ) : null}
            {conversionScore != null ? (
              <span className="font-mono text-2xl text-white">
                C {conversionScore}%
              </span>
            ) : null}
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {confidenceLabel(report.confidence)}
            </span>
          </div>
        </div>

        <ScoreCardTabBar
          tabs={availableTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          report={report}
          reportHistory={reportHistory}
        />

        <div role="tabpanel" className={DEMO_SCORE_TABPANEL}>
          {activeTab === "overview" ? (
            <div className="flex w-full flex-col items-center px-2 py-6 text-center sm:py-10">
              <div className="grid w-full grid-cols-2 gap-8 sm:max-w-md sm:gap-12">
                {overallScore != null ? (
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[2px] text-zinc-500">Learning</div>
                    <div className="mt-4 font-mono text-6xl font-medium tracking-tight text-white sm:text-7xl">
                      {overallScore}
                    </div>
                    <div className="mt-2 font-mono text-base text-zinc-500">/ 100</div>
                  </div>
                ) : null}
                {conversionScore != null ? (
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[2px] text-zinc-500">Conversion</div>
                    <div className="mt-4 font-mono text-6xl font-medium tracking-tight text-white sm:text-7xl">
                      {conversionScore}
                    </div>
                    <div className="mt-2 font-mono text-base text-zinc-500">%</div>
                  </div>
                ) : null}
              </div>
              {conversionGoal ? (
                <div className="mt-8 w-full text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
                      Conversion goal
                    </span>
                    {conversionGoalSource ? (
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                        {conversionGoalSource === "workspace" ? "Workspace" : "Inferred"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-center text-base leading-relaxed text-zinc-300 sm:text-lg">
                    {conversionGoal}
                  </p>
                </div>
              ) : null}
              <p className="mt-8 w-full text-left text-base leading-relaxed text-zinc-300 sm:text-lg">
                {report.summary}
              </p>
            </div>
          ) : null}

          {activeTab === "competency" && markerScores.length > 0 ? (
            <div className="flex h-full w-full items-center justify-center px-2 py-4">
              <MarkerRadarChart
                markers={markerScores}
                variant="large"
                ariaLabel="Performance competency scores"
                className="aspect-square h-auto w-full max-w-[min(100%,36rem)]"
              />
            </div>
          ) : null}

          {activeTab === "markers" && markerScores.length > 0 ? (
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {markerScores.map((marker) => (
                <div key={marker.id} className="border-b border-zinc-800/60 pb-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-base font-medium text-zinc-200 sm:text-lg">{marker.label}</span>
                    <span className="font-mono text-2xl text-white">{marker.score}</span>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-zinc-400">{marker.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "strengths" && report.strengths.length > 0 ? (
            <ul className="w-full space-y-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
              {report.strengths.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-zinc-500">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {activeTab === "gaps" ? (
            <div className="w-full space-y-10">
              {report.gap_analysis.gaps.length > 0 ? (
                <div>
                  <p className="text-base leading-relaxed text-zinc-400 sm:text-lg">
                    {report.gap_analysis.summary}
                  </p>
                  <ul className="mt-6 space-y-5">
                    {report.gap_analysis.gaps.map((gap) => (
                      <li
                        key={gap.title}
                        className={`border-l-2 py-1 pl-5 text-base sm:text-lg ${severityAccentBorder(gap.severity)}`}
                      >
                        <div className="font-medium text-zinc-100">{gap.title}</div>
                        <p className="mt-2 leading-relaxed opacity-90">{gap.evidence}</p>
                        <p className="mt-2 text-zinc-400">Repair: {gap.suggested_repair}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.gap_analysis.next_practice.length > 0 ? (
                <div>
                  <div className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">Next practice</div>
                  <ul className="mt-4 space-y-3 text-base text-zinc-300 sm:text-lg">
                    {report.gap_analysis.next_practice.map((item) => (
                      <li key={item}>→ {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "history" && reportHistory.length > 0 ? (
            <ScoreEvolution history={reportHistory} flat />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {overallScore != null ? (
            <span className="rounded-full border border-zinc-600 bg-zinc-950 px-3 py-0.5 font-mono text-sm text-white">
              L {overallScore}
              <span className="ml-1 text-[10px] text-zinc-500">/100</span>
            </span>
          ) : null}
          {conversionScore != null ? (
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-0.5 font-mono text-sm text-white">
              C {conversionScore}%
            </span>
          ) : null}
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
            {confidenceLabel(report.confidence)}
          </span>
        </div>
      </div>

      {markerScores.length > 0 ? (
        <div className="rounded-md border border-zinc-800 bg-black/20 px-3 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Competency profile</div>
          <div className="mt-3 flex justify-center overflow-hidden">
            <MarkerRadarChart
              markers={markerScores}
              ariaLabel="Performance competency scores"
              className="aspect-square h-auto w-full max-w-[15rem]"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {markerScores.map((marker) => (
              <div
                key={marker.id}
                className="rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-300">{marker.label}</span>
                  <span className="font-mono text-sm text-white">{marker.score}</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-zinc-500">{marker.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-zinc-300">{report.summary}</p>

      <div className="space-y-4">
        {report.strengths.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Strengths</div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {report.strengths.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-zinc-500">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.gap_analysis.gaps.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Gap analysis</div>
            <p className="mt-2 text-xs text-zinc-500">{report.gap_analysis.summary}</p>
            <ul className="mt-3 space-y-2">
              {report.gap_analysis.gaps.map((gap) => (
                <li
                  key={gap.title}
                  className={`rounded-md border px-3 py-2 text-xs ${severityColor(gap.severity)}`}
                >
                  <div className="font-medium">{gap.title}</div>
                  <p className="mt-1.5 opacity-80">{gap.evidence}</p>
                  <p className="mt-1.5 opacity-70">Repair: {gap.suggested_repair}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report.gap_analysis.next_practice.length > 0 ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Next practice</div>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {report.gap_analysis.next_practice.map((item) => (
                <li key={item}>→ {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}