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
  Check,
  Loader2,
  Play,
  Plug,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import {
  getScoreCardMetrics,
  PerformanceReportCard,
  type PerformanceReportSnapshot,
} from "@/components/PerformanceReportCard";
import { normalizePerformanceReport, type PerformanceReport } from "@/lib/agent-v2/performance-context";
import type { ConversionGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { EvidenceEvalSchemaResult } from "@/lib/agent-v2/evidence-schema";
import {
  CUSTOM_DEMO_ID,
  CUSTOM_DEMO_PICKER,
  isCustomDemoId,
} from "@/lib/evidence-api-demo/custom-demo";
import type { EvidenceApiDemoDefinition } from "@/lib/evidence-api-demo/demo-definition";
import { DemoVerificationPills } from "@/components/evidence-demo/DemoVerificationPills";
import { EVIDENCE_API_DEMOS, resolveDemoId } from "@/lib/evidence-api-demo/demos";
import { isExternalDemo, isInteractiveDemo } from "@/lib/evidence-api-demo/game-tips";
import {
  buildOrbitLaunchUrl,
  initOrbitBridge,
  ORBIT_BRIDGE_STORAGE_KEY,
  readOrbitBridgeForPlan,
} from "@/lib/evidence-api-demo/orbit-bridge";
import {
  normalizeDemoSessionUrl,
  openDemoSessionUrl,
} from "@/lib/evidence-api-demo/demo-session-url";
import { selectPracticeBlock, selectTapValidationBlock } from "@/lib/evidence-api-demo/tap-validation";
import { getDemoVerificationPills } from "@/lib/evidence-api-demo/verification-pills";
import {
  applyMcpSimulationEvent,
  applySimulationAction,
  buildMcpEventEvidencePayload,
  buildSimulationEvidencePayload,
  countDistinctEvidenceActions,
  createInitialWorldState,
  getActionsByCategory,
  getSimulationAction,
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
import type { McpSimulationEvent, McpToolDescriptor } from "@/lib/evidence-api-demo/mcp-simulation-types";
import {
  pickDefaultMcpTool,
  suggestMcpToolArgs,
  usesWorkspaceArgs,
} from "@/lib/evidence-api-demo/mcp-simulation-utils";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { readJsonResponse } from "@/lib/read-json-response";

type DemoPhase = "picker" | "intro" | "creating" | "simulating";
type CustomInputMode = "prompt" | "import";
type SimulatorSubview = "events" | "mcp";
type DemoView = "simulator" | "evaluation" | "score";

const DEMO_TAB_STAGE = "w-full min-w-0";
const DEMO_TAB_PANEL =
  "box-border flex w-full min-w-full max-w-full flex-col rounded-lg border border-zinc-800 bg-zinc-950/70";
const DEMO_TAB_HEADER = "shrink-0 border-b border-zinc-800 px-5 py-4 sm:px-6";
const DEMO_TAB_BODY = "flex w-full flex-col p-5 sm:p-6";
const DEMO_TAB_BODY_INTERACTIVE = "flex w-full flex-col p-0";
const DEMO_TAB_BODY_CONTENT = "flex w-full flex-col gap-6 p-5 sm:p-6";
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

type WorkspaceResponse = {
  workspace: { id: string; title: string };
  blocks: DemoWorkspaceBlock[];
  demo: {
    id?: string;
    product: string;
    integration_name: string;
    eval_definition: string;
    model_doc_filename?: string;
    model_doc_preview?: string;
  };
  custom_definition?: EvidenceApiDemoDefinition;
};

type EvidenceResponse = {
  evidence: { id: string; tool_action: string | null; created_at: string };
};

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
  customInputMode?: CustomInputMode;
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
      demoId: parsed.demoId ?? "orbit",
      worldState: parsed.worldState ?? {
        ...createInitialWorldState(),
        completedActions: legacySteps,
        actionCounts: Object.fromEntries(legacySteps.map((id: string) => [id, 1])),
      },
      workspaceTitle: parsed.workspaceTitle,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      customDemo: parsed.customDemo,
      customPrompt: parsed.customPrompt,
      customInputMode: parsed.customInputMode,
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

function hasDemoAccess(profile: { is_admin?: boolean | null } | null): boolean {
  return profile?.is_admin === true;
}

export function EvidenceApiDemo() {
  const [authState, setAuthState] = useState<"loading" | "guest" | "no-admin" | "ready">("loading");
  const [phase, setPhase] = useState<DemoPhase>("picker");
  const [demoId, setDemoId] = useState<string | null>(null);
  const [customDemo, setCustomDemo] = useState<EvidenceApiDemoDefinition | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customInputMode, setCustomInputMode] = useState<CustomInputMode>("prompt");
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [mcpAuthHeader, setMcpAuthHeader] = useState("");
  const [mcpTools, setMcpTools] = useState<McpToolDescriptor[]>([]);
  const [mcpSelectedTool, setMcpSelectedTool] = useState("");
  const [mcpToolArgs, setMcpToolArgs] = useState("{}");
  const [mcpEventLog, setMcpEventLog] = useState<McpSimulationEvent[]>([]);
  const [isMcpConnecting, setIsMcpConnecting] = useState(false);
  const [isMcpPulling, setIsMcpPulling] = useState(false);
  const [isSimulatingAllMcpEvents, setIsSimulatingAllMcpEvents] = useState(false);
  const [runningMcpEventId, setRunningMcpEventId] = useState<string | null>(null);
  const activeDemo = useMemo(() => {
    if (isCustomDemoId(demoId)) return customDemo ?? CUSTOM_DEMO_PICKER;
    return resolveDemoId(demoId);
  }, [demoId, customDemo]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<DemoWorkspaceBlock[]>([]);
  const [modelDocPreview, setModelDocPreview] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [worldState, setWorldState] = useState<SimulationWorldState>(createInitialWorldState);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [performanceResponseRaw, setPerformanceResponseRaw] = useState<PerformanceResponse | null>(null);
  const [reportHistory, setReportHistory] = useState<PerformanceReportSnapshot[]>([]);
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
  const [isResetting, setIsResetting] = useState(false);
  const [tapLinkUrl, setTapLinkUrl] = useState<string | null>(null);
  const [isCreatingTapLink, setIsCreatingTapLink] = useState(false);
  const [ileSessionUrl, setIleSessionUrl] = useState<string | null>(null);
  const [isCreatingIleSession, setIsCreatingIleSession] = useState(false);
  const [activeView, setActiveView] = useState<DemoView>("simulator");
  const [backgroundImage, setBackgroundImage] = useState(() =>
    aestheticImageForId("evidence-api-demo")
  );

  const backgroundSeed = planId ?? demoId ?? "evidence-api-demo";

  const actionCount = totalActionCount(worldState);
  const distinctEvidenceActions = countDistinctEvidenceActions(activeDemo, worldState);

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
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (hasDemoAccess(profile)) {
          setAuthState("ready");
          return;
        }

        try {
          const res = await fetchWithTimeout("/api/evidence-api-demo/status");
          if (res.ok) {
            const data = (await res.json()) as {
              authenticated?: boolean;
              isAdmin?: boolean;
            };
            if (data.authenticated && data.isAdmin) {
              setAuthState("ready");
              return;
            }
          }
        } catch {
          // Server status is a fallback only.
        }

        setAuthState("no-admin");
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

  const applyOrbitBridgeSnapshot = useCallback(
    (bridgePlanId: string) => {
      const bridge = readOrbitBridgeForPlan(bridgePlanId);
      if (!bridge) return null;

      setEvidenceCount(bridge.evidenceCount);
      setWorldState(bridge.worldState);

      if (bridge.inferredConversionGoal) {
        setPerformanceResponseRaw((prev) =>
          prev
            ? {
                ...prev,
                workspace_conversion_goal: bridge.inferredConversionGoal!,
                conversion_goal_source: bridge.conversionGoalSource ?? prev.conversion_goal_source,
              }
            : null
        );
      }

      return bridge;
    },
    []
  );

  useEffect(() => {
    if (authState !== "ready") return;
    const persisted = loadPersistedState();
    if (!persisted) return;
    const restoredDemo = isCustomDemoId(persisted.demoId)
      ? persisted.customDemo ?? CUSTOM_DEMO_PICKER
      : resolveDemoId(persisted.demoId);

    setPlanId(persisted.planId);
    setSessionId(persisted.sessionId);
    setDemoId(persisted.demoId);
    setCustomDemo(persisted.customDemo ?? null);
    setCustomPrompt(persisted.customPrompt ?? "");
    setCustomInputMode(persisted.customInputMode ?? "prompt");
    setWorldState(persisted.worldState);
    setWorkspaceTitle(persisted.workspaceTitle ?? null);
    setBlocks(persisted.blocks ?? []);

    if (isExternalDemo(restoredDemo)) {
      const bridge = applyOrbitBridgeSnapshot(persisted.planId);
      setEvidenceCount(bridge?.evidenceCount ?? 0);
    } else {
      setEvidenceCount(totalActionCount(persisted.worldState));
    }

    setPhase("simulating");
  }, [applyOrbitBridgeSnapshot, authState]);

  useEffect(() => {
    if (!planId || phase !== "simulating" || !isExternalDemo(activeDemo)) return;

    const sync = () => {
      const bridge = applyOrbitBridgeSnapshot(planId);
      if (!bridge) return;

      persistState({
        planId,
        sessionId,
        demoId: activeDemo.id,
        worldState: bridge.worldState,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks: bridge.blocks.length > 0 ? bridge.blocks : blocks,
        customDemo: isCustomDemoId(activeDemo.id) ? activeDemo : undefined,
        customPrompt: isCustomDemoId(activeDemo.id) ? customPrompt.trim() : undefined,
        customInputMode: isCustomDemoId(activeDemo.id) ? customInputMode : undefined,
      });

      if (shouldSuggestSkillRegeneration(bridge.evidenceCount, lastSkillEvidenceCount)) {
        setSkillRegenHint(true);
      }
    };

    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORBIT_BRIDGE_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(sync, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [
    activeDemo,
    applyOrbitBridgeSnapshot,
    blocks,
    customInputMode,
    customPrompt,
    lastSkillEvidenceCount,
    phase,
    planId,
    sessionId,
    workspaceTitle,
  ]);

  const handleSelectDemo = (demo: EvidenceApiDemoDefinition) => {
    setError("");
    setDemoId(demo.id);
    setCustomDemo(null);
    setCustomPrompt("");
    setCustomInputMode("prompt");
    resetMcpSimulationState();
    setPhase("intro");
  };

  const handleSelectCustomDemo = () => {
    setError("");
    setDemoId(CUSTOM_DEMO_ID);
    setCustomDemo(null);
    setCustomInputMode("prompt");
    resetMcpSimulationState();
    setPhase("intro");
  };

  const resetMcpSimulationState = () => {
    setMcpTools([]);
    setMcpSelectedTool("");
    setMcpToolArgs("{}");
    setMcpEventLog([]);
    setRunningMcpEventId(null);
    setIsSimulatingAllMcpEvents(false);
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

    setCustomInputMode("prompt");
    setError("");
    resetMcpSimulationState();
    setTapLinkUrl(null);
    setIsCreatingTapLink(false);
    setIleSessionUrl(null);
    setIsCreatingIleSession(false);
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
    setActiveView("simulator");

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
        if (data.code === "admin_required") {
          setAuthState("no-admin");
          throw new Error("Admin access required for this demo.");
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
      setModelDocPreview(data.demo.model_doc_preview ?? null);
      const initialWorld = createInitialWorldState();
      if (isExternalDemo(activeDemo)) {
        initOrbitBridge(
          { planId: data.workspace.id, sessionId: newSessionId, demoId: activeDemo.id },
          data.blocks
        );
      }
      persistState({
        planId: data.workspace.id,
        sessionId: newSessionId,
        demoId: activeDemo.id,
        worldState: initialWorld,
        workspaceTitle: data.workspace.title,
        blocks: data.blocks,
        customDemo: generatedCustomDemo ?? undefined,
        customPrompt: isCustomDemoId(demoId) ? customPrompt.trim() : undefined,
        customInputMode: isCustomDemoId(demoId) ? "prompt" : undefined,
      });

      setPhase("simulating");
      setWorldState(initialWorld);
    } catch (err) {
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

      if (
        isInteractiveDemo(activeDemo) &&
        action.kind === "evidence" &&
        nextEvidenceCount >= 3 &&
        nextEvidenceCount % 3 === 0
      ) {
        void handleRequestPerformance({ switchView: false });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setRunningActionId(null);
    }
  };

  const handleFetchEvidenceSchema = async () => {
    if (!planId || isFetchingSchema) return;

    setIsFetchingSchema(true);
    setError("");

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

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch evidence schema");
    } finally {
      setIsFetchingSchema(false);
    }
  };

  const handleRegenerateSkill = async () => {
    if (!planId || isRegeneratingSkill) return;

    let effectiveEvidenceCount = evidenceCount;
    let effectiveWorldState = worldState;
    if (isExternalDemo(activeDemo)) {
      const bridge = applyOrbitBridgeSnapshot(planId);
      if (bridge) {
        effectiveEvidenceCount = bridge.evidenceCount;
        effectiveWorldState = bridge.worldState;
      }
    }
    if (effectiveEvidenceCount < 1) {
      setError("Run at least one action in Orbit to upload evidence before regenerating the skill.");
      return;
    }

    const snapshotEvidenceCount = effectiveEvidenceCount;
    const snapshotActionCount = totalActionCount(effectiveWorldState);
    const snapshotSimulatedDays = effectiveWorldState.simulatedDays;

    setIsRegeneratingSkill(true);
    setError("");
    setSkillRegenHint(false);

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
      setLastSkillEvidenceCount(snapshotEvidenceCount);

      setSkillHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          skill_name: data.skill_name,
          skill_md: data.skill_md,
          spec_version: data.evidence_spec?.spec_version,
          evidenceCount: snapshotEvidenceCount,
          actionCount: snapshotActionCount,
          simulatedDays: snapshotSimulatedDays,
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
            evidenceCount: snapshotEvidenceCount,
            actionCount: snapshotActionCount,
            simulatedDays: snapshotSimulatedDays,
            timestamp: new Date(),
          },
        ]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate skill");
    } finally {
      setIsRegeneratingSkill(false);
    }
  };

  const handleRequestPerformance = async (options?: { switchView?: boolean }) => {
    if (!planId || isReporting) return;

    let effectiveEvidenceCount = evidenceCount;
    let effectiveWorldState = worldState;
    if (isExternalDemo(activeDemo)) {
      const bridge = applyOrbitBridgeSnapshot(planId);
      if (bridge) {
        effectiveEvidenceCount = bridge.evidenceCount;
        effectiveWorldState = bridge.worldState;
      }
    }
    if (effectiveEvidenceCount < 1) {
      setError(
        isExternalDemo(activeDemo)
          ? "Run at least one action in Orbit to upload evidence before requesting a score."
          : "Run at least one simulation action to upload evidence before requesting a score."
      );
      return;
    }

    setIsReporting(true);
    setError("");

    const snapshotEvidenceCount = effectiveEvidenceCount;
    const snapshotActionCount = totalActionCount(effectiveWorldState);
    const snapshotSimulatedDays = effectiveWorldState.simulatedDays;
    const switchView = options?.switchView !== false;

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

      const normalizedReport = normalizePerformanceReport(data.report);
      setReport(normalizedReport);
      setPerformanceResponseRaw({ ...data, report: normalizedReport });
      if (switchView) {
        setActiveView("score");
      }
      setEvidenceCount(data.evidence_summary.evidence_artifacts);
      setReportHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          report: normalizedReport,
          evidenceCount: snapshotEvidenceCount,
          actionCount: snapshotActionCount,
          simulatedDays: snapshotSimulatedDays,
          timestamp: new Date(),
        },
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleMcpConnect = async () => {
    if (!mcpServerUrl.trim()) {
      setError("Enter an MCP server URL.");
      return;
    }

    setIsMcpConnecting(true);
    setError("");

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/mcp-simulation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "connect",
            serverUrl: mcpServerUrl.trim(),
            authHeader: mcpAuthHeader.trim() || undefined,
          }),
        },
        120000
      );
      const data = await readJsonResponse<{
        tools?: McpToolDescriptor[];
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect to MCP server");
      }

      const tools = data.tools ?? [];
      const defaultTool = pickDefaultMcpTool(tools, planId);
      setMcpTools(tools);
      setMcpSelectedTool(defaultTool);
      setMcpToolArgs(JSON.stringify(suggestMcpToolArgs(defaultTool, planId), null, 2));
      setMcpEventLog([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to MCP server");
    } finally {
      setIsMcpConnecting(false);
    }
  };

  const handleMcpPull = async (toolName: string) => {
    if (!mcpServerUrl.trim()) {
      setError("Enter an MCP server URL.");
      return;
    }
    if (!toolName) {
      setError("Select an MCP tool to import data.");
      return;
    }

    setMcpSelectedTool(toolName);
    const suggestedArgs = suggestMcpToolArgs(toolName, planId);
    setMcpToolArgs(JSON.stringify(suggestedArgs, null, 2));

    let parsedArgs: Record<string, unknown> = suggestedArgs;
    if (!usesWorkspaceArgs(toolName) || !planId) {
      try {
        parsedArgs = JSON.parse(mcpToolArgs.trim() || "{}") as Record<string, unknown>;
      } catch {
        setError("Tool arguments must be valid JSON.");
        return;
      }
    }

    setIsMcpPulling(true);
    setError("");

    const selectedTool = mcpTools.find((tool) => tool.name === toolName);

    try {
      const res = await fetchWithTimeout(
        "/api/evidence-api-demo/mcp-simulation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "pull",
            serverUrl: mcpServerUrl.trim(),
            authHeader: mcpAuthHeader.trim() || undefined,
            toolName,
            toolDescription: selectedTool?.description,
            toolArgs: parsedArgs,
          }),
        },
        180000
      );
      const data = await readJsonResponse<{
        events?: McpSimulationEvent[];
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Failed to load MCP events");
      }

      const imported = data.events ?? [];
      setMcpEventLog((prev) => [...prev, ...imported]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pull MCP data");
    } finally {
      setIsMcpPulling(false);
    }
  };

  const uploadMcpSimulationEvent = async (
    event: McpSimulationEvent,
    currentWorld: SimulationWorldState,
    currentEvidenceCount: number
  ): Promise<{
    nextWorld: SimulationWorldState;
    evidenceId: string;
    nextEvidenceCount: number;
  }> => {
    if (!planId) {
      throw new Error("Workspace not ready.");
    }

    const matchedAction = getSimulationAction(activeDemo, event.verb);
    const nextWorld = matchedAction
      ? applySimulationAction(currentWorld, matchedAction)
      : applyMcpSimulationEvent(currentWorld, event.verb);
    const blockId = matchedAction
      ? matchBlockToStep(blocks, matchedAction)
      : blocks[0]?.id ?? null;

    const payload = buildMcpEventEvidencePayload(activeDemo, event, {
      sessionId,
      blockId,
      worldState: nextWorld,
    });

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
        tool_name: event.mcpTool,
        tool_action: event.verb,
        file_name: `mcp-${event.verb}-${(currentWorld.actionCounts[event.verb] ?? 0) + 1}.json`,
        metadata: {
          source: "mcp_simulation",
          product: activeDemo.productName,
          integration: activeDemo.integrationName,
          mcp_tool: event.mcpTool,
          simulated_days: nextWorld.simulatedDays,
        },
      }),
    });

    const data = await readJsonResponse<EvidenceResponse & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error || "Evidence upload failed");
    }

    return {
      nextWorld,
      evidenceId: data.evidence.id,
      nextEvidenceCount: currentEvidenceCount + 1,
    };
  };

  const handleSimulateMcpEvent = async (event: McpSimulationEvent) => {
    if (!planId || runningMcpEventId || isSimulatingAllMcpEvents || event.status === "simulated") {
      return;
    }

    setRunningMcpEventId(event.id);
    setError("");

    try {
      const { nextWorld, evidenceId, nextEvidenceCount } = await uploadMcpSimulationEvent(
        event,
        worldState,
        evidenceCount
      );

      setWorldState(nextWorld);
      setEvidenceCount(nextEvidenceCount);
      setMcpEventLog((prev) =>
        prev.map((entry) =>
          entry.id === event.id
            ? { ...entry, status: "simulated", evidenceId }
            : entry
        )
      );
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to simulate MCP event");
      setMcpEventLog((prev) =>
        prev.map((entry) => (entry.id === event.id ? { ...entry, status: "failed" } : entry))
      );
    } finally {
      setRunningMcpEventId(null);
    }
  };

  const handleSimulateAllMcpEvents = async () => {
    const pending = mcpEventLog.filter((event) => event.status === "pending");
    if (!planId || pending.length === 0 || runningMcpEventId || isSimulatingAllMcpEvents) return;

    setIsSimulatingAllMcpEvents(true);
    setError("");

    let currentWorld = worldState;
    let currentEvidenceCount = evidenceCount;

    try {
      for (const event of pending) {
        setRunningMcpEventId(event.id);
        const result = await uploadMcpSimulationEvent(event, currentWorld, currentEvidenceCount);
        currentWorld = result.nextWorld;
        currentEvidenceCount = result.nextEvidenceCount;
        setMcpEventLog((prev) =>
          prev.map((entry) =>
            entry.id === event.id
              ? { ...entry, status: "simulated", evidenceId: result.evidenceId }
              : entry
          )
        );
        setWorldState(currentWorld);
        setEvidenceCount(currentEvidenceCount);
      }

      persistState({
        planId,
        sessionId,
        demoId: activeDemo.id,
        worldState: currentWorld,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks,
        customDemo: isCustomDemoId(activeDemo.id) ? activeDemo : undefined,
        customPrompt: isCustomDemoId(activeDemo.id) ? customPrompt.trim() : undefined,
      });

      if (shouldSuggestSkillRegeneration(currentEvidenceCount, lastSkillEvidenceCount)) {
        setSkillRegenHint(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to simulate MCP events");
    } finally {
      setRunningMcpEventId(null);
      setIsSimulatingAllMcpEvents(false);
    }
  };

  const resetLocalDemoState = () => {
    clearPersistedState();
    setPhase("picker");
    setDemoId(null);
    setCustomDemo(null);
    setCustomPrompt("");
    setCustomInputMode("prompt");
    setMcpServerUrl("");
    setMcpAuthHeader("");
    resetMcpSimulationState();
    setPlanId(null);
    setWorkspaceTitle(null);
    setBlocks([]);
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
    setTapLinkUrl(null);
    setIsCreatingTapLink(false);
    setIleSessionUrl(null);
    setIsCreatingIleSession(false);
    setActiveView("simulator");
  };

  const handleOpenIlePractice = async () => {
    if (!planId || isCreatingIleSession) return;

    if (ileSessionUrl) {
      openDemoSessionUrl(ileSessionUrl);
      return;
    }

    setIsCreatingIleSession(true);
    setError("");

    try {
      const block = selectPracticeBlock(blocks);
      const res = await fetchWithTimeout("/api/evidence-api-demo/ile-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          ...(block?.id ? { blockId: block.id } : {}),
        }),
      });
      const data = await readJsonResponse<{ session_url?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to create ILE practice session");
      }
      if (!data.session_url) {
        throw new Error("ILE session URL missing from response");
      }

      const sessionUrl = normalizeDemoSessionUrl(data.session_url);
      setIleSessionUrl(sessionUrl);
      openDemoSessionUrl(sessionUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open ILE practice");
    } finally {
      setIsCreatingIleSession(false);
    }
  };

  const handleOpenTapValidation = async () => {
    if (!planId || isCreatingTapLink) return;

    if (tapLinkUrl) {
      openDemoSessionUrl(tapLinkUrl);
      return;
    }

    setIsCreatingTapLink(true);
    setError("");

    try {
      const block = selectTapValidationBlock(blocks);
      const res = await fetchWithTimeout("/api/evidence-api-demo/tap-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          ...(block?.id ? { blockId: block.id } : {}),
        }),
      });
      const data = await readJsonResponse<{ private_url?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to create TAP validation link");
      }
      if (!data.private_url) {
        throw new Error("TAP validation link missing from response");
      }

      const privateUrl = normalizeDemoSessionUrl(data.private_url);
      setTapLinkUrl(privateUrl);
      openDemoSessionUrl(privateUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create TAP validation link");
    } finally {
      setIsCreatingTapLink(false);
    }
  };

  const handleReset = async () => {
    const workspaceToArchive = planId;
    setIsResetting(true);

    if (workspaceToArchive) {
      try {
        const res = await fetchWithTimeout("/api/evidence-api-demo/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: workspaceToArchive }),
        });
        const data = await readJsonResponse<{ error?: string }>(res);
        if (!res.ok) {
          throw new Error(data.error || "Failed to archive workspace");
        }
        setError("");
      } catch (err) {
        setError(
          err instanceof Error
            ? `Workspace could not be archived: ${err.message}`
            : "Workspace could not be archived."
        );
      }
    } else {
      setError("");
    }

    resetLocalDemoState();
    setIsResetting(false);
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
        body="The Evidence API demo creates a real verification workspace and uploads live evidence. Admin access is required to continue."
        primaryHref="/login?redirect=/demo"
        primaryLabel="Sign in"
        secondaryHref="/dashboard"
        secondaryLabel="Back to dashboard"
      />
    );
  }

  if (authState === "no-admin") {
    return (
      <AuthGate
        backgroundImage={backgroundImage}
        title="Admin access required"
        body="This internal demo uses the Agentic API to create workspaces, upload evidence, and generate performance reports. Only admin accounts can run it."
        primaryHref="/dashboard"
        primaryLabel="Back to dashboard"
        secondaryHref="/docs/agentic-v2"
        secondaryLabel="API docs"
      />
    );
  }

  return (
    <DemoFlowShell backgroundImage={backgroundImage}>
      <Navbar
        breadcrumbs={[
          { label: "Demo" },
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
              openLesson in action
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Pick a learning scenario — adopt Orbit for sprint delivery or paste your own product workflow — then
              watch openLesson verify learning and conversion from live evidence. Score cards separate gaps from
              next steps: what to learn next and which product actions move adoption forward.
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
                  onClick={() => void handleReset()}
                  disabled={isResetting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isResetting ? <Loader2 className="size-3 animate-spin" /> : null}
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
          report={report}
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

        {error ? (
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
            customInputMode={customInputMode}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            customPromptMinLength={CUSTOM_PROMPT_MIN_LENGTH}
            evidenceCount={evidenceCount}
            report={report}
            isReporting={isReporting}
            onRequestPerformance={() => void handleRequestPerformance()}
            sessionId={sessionId}
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
                customInputMode={customInputMode}
                customPrompt={customPrompt}
                onCustomPromptChange={setCustomPrompt}
                customPromptMinLength={CUSTOM_PROMPT_MIN_LENGTH}
                mcpServerUrl={mcpServerUrl}
                onMcpServerUrlChange={setMcpServerUrl}
                mcpAuthHeader={mcpAuthHeader}
                onMcpAuthHeaderChange={setMcpAuthHeader}
                mcpTools={mcpTools}
                mcpSelectedTool={mcpSelectedTool}
                onMcpSelectedToolChange={setMcpSelectedTool}
                mcpToolArgs={mcpToolArgs}
                onMcpToolArgsChange={setMcpToolArgs}
                mcpEventLog={mcpEventLog}
                isMcpConnecting={isMcpConnecting}
                isMcpPulling={isMcpPulling}
                isSimulatingAllMcpEvents={isSimulatingAllMcpEvents}
                runningMcpEventId={runningMcpEventId}
                planId={planId}
                sessionId={sessionId}
                onMcpConnect={handleMcpConnect}
                onMcpPull={handleMcpPull}
                onSimulateMcpEvent={handleSimulateMcpEvent}
                onSimulateAllMcpEvents={handleSimulateAllMcpEvents}
                onCustomInputModeChange={setCustomInputMode}
                evidenceCount={evidenceCount}
                report={report}
                isReporting={isReporting}
                workspaceConversionGoal={performanceResponseRaw?.workspace_conversion_goal}
                conversionGoalSource={performanceResponseRaw?.conversion_goal_source}
                onRequestPerformance={() => void handleRequestPerformance()}
                tapLinkUrl={tapLinkUrl}
                isCreatingTapLink={isCreatingTapLink}
                onOpenTapValidation={() => void handleOpenTapValidation()}
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
                onRequestPerformance={() => void handleRequestPerformance()}
                showIntegrationActions={isCustomDemoId(demoId)}
                ileSessionUrl={ileSessionUrl}
                isCreatingIleSession={isCreatingIleSession}
                tapLinkUrl={tapLinkUrl}
                isCreatingTapLink={isCreatingTapLink}
                onOpenIlePractice={() => void handleOpenIlePractice()}
                onOpenTapValidation={() => void handleOpenTapValidation()}
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
    <div className="relative min-h-screen bg-[#0a0a0a] text-zinc-200">
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
  const scoreMetrics = getScoreCardMetrics(report);

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
          {scoreMetrics ? (
            <>
              <span className="font-mono text-zinc-500">
                Gaps <span className="text-white">{scoreMetrics.gaps}</span>
              </span>
              <span className="font-mono text-zinc-500">
                Next steps{" "}
                <span className="text-white">
                  {scoreMetrics.directions} goals · {scoreMetrics.events} events
                </span>
              </span>
            </>
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
  report,
}: {
  activeView: DemoView;
  onChange: (view: DemoView) => void;
  report: PerformanceReport | null;
}) {
  const scoreMetrics = getScoreCardMetrics(report);
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
      id: "score",
      label: "Score card",
      description: "Gaps · goals · granular events",
      icon: Gauge,
      badge: scoreMetrics
        ? `${scoreMetrics.gaps} gaps · ${scoreMetrics.nextSteps} steps`
        : undefined,
    },
    {
      id: "evaluation",
      label: "Continuous evaluation",
      description: "Regenerate & download specs",
      icon: RefreshCw,
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

function ExternalLaunchPanel({
  demo,
  planId,
  sessionId,
  evidenceCount,
  inferredGoal,
  conversionGoalSource,
  styles,
}: {
  demo: EvidenceApiDemoDefinition;
  planId: string | null;
  sessionId: string | null;
  evidenceCount: number;
  inferredGoal?: string | null;
  conversionGoalSource?: ConversionGoalSource;
  styles: ReturnType<typeof demoPanelStyles>;
}) {
  const canLaunch = Boolean(planId && sessionId);
  const launchUrl = canLaunch
    ? buildOrbitLaunchUrl({ planId: planId!, sessionId: sessionId! })
    : null;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`flex size-14 items-center justify-center rounded-lg text-lg font-bold ${styles.logo}`}>
        {demo.initials}
      </div>
      <h3 className="mt-6 text-2xl font-medium text-white">{demo.productName} is ready</h3>
      <p className={`mt-3 max-w-lg text-sm leading-relaxed ${styles.bodyText}`}>
        Launch the full-screen product in a new browser tab. Learn by doing inside Orbit while evidence
        verifies learning and conversion. Smart coaching overlays ask &ldquo;are you trying to X?&rdquo; and
        coach the next step as score cards update.
      </p>

      {inferredGoal ? (
        <p className="mt-4 max-w-lg rounded-md border border-zinc-700 bg-black/30 px-4 py-3 text-sm leading-snug text-zinc-200">
          Are you trying to <span className="font-medium text-white">{inferredGoal}</span>?
          {conversionGoalSource ? (
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-zinc-500">
              {conversionGoalSource === "workspace" ? "Workspace goal" : "Inferred goal"}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
        {evidenceCount} evidence event{evidenceCount === 1 ? "" : "s"} · synced live from Orbit
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={!launchUrl}
          onClick={() => {
            if (!launchUrl) return;
            window.open(launchUrl, "_blank", "noopener,noreferrer");
          }}
          className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
        >
          Launch {demo.productName}
          <ArrowRight className="size-4" />
        </button>
      </div>
      <p className="mt-6 max-w-md text-xs text-zinc-500">
        Use the Evaluation and Score tabs here for schema regeneration and full scorecards. Orbit keeps
        coaching overlays in-product while you work.
      </p>
    </div>
  );
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
        <h2 className="mt-2 text-2xl font-medium text-white sm:text-3xl">What workflow are we helping someone learn?</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Pick Orbit to verify learning and conversion inside a real product UI, or paste your own prompt to
          generate dynamic event actions. Same Evidence API flow throughout — score cards coach gaps and next steps
          toward adoption, not exam completion.
        </p>
      </div>

      <div className={`mt-8 grid gap-4 ${demos.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {demos.map((demo) => {
          const styles = demoPanelStyles(demo.accent);
          const verificationPills = getDemoVerificationPills(demo);
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
                <DemoVerificationPills pills={verificationPills} />
              </div>
              <p className={`mt-4 text-sm leading-relaxed ${styles.bodyText}`}>{demo.description}</p>
              <div className="mt-5 flex items-center gap-2 text-xs font-medium text-white/90">
                {demo.simulatorMode === "external" ? "Launch full-screen app" : "Run this demo"}
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-bold ${customStyles.logo}`}
            >
              {CUSTOM_DEMO_PICKER.initials}
            </div>
            <div>
              <div className="text-base font-medium text-white">Custom simulation</div>
              <div className={`text-xs ${customStyles.subtitle}`}>{CUSTOM_DEMO_PICKER.tagline}</div>
            </div>
          </div>
          <DemoVerificationPills pills={getDemoVerificationPills(CUSTOM_DEMO_PICKER)} />
        </div>
        <p className={`mt-4 max-w-2xl text-sm leading-relaxed ${customStyles.bodyText}`}>
          {CUSTOM_DEMO_PICKER.description} After you start, use the MCP simulation tab to connect to a live MCP
          server, pull real data, and simulate imported event logs.
        </p>
        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-white/90">
          Paste your prompt
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
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

function McpImportedEventGrid({
  events,
  runningMcpEventId,
  isSimulatingAll,
  onSimulate,
  styles,
}: {
  events: McpSimulationEvent[];
  runningMcpEventId: string | null;
  isSimulatingAll: boolean;
  onSimulate: (event: McpSimulationEvent) => void;
  styles: ReturnType<typeof demoPanelStyles>;
}) {
  const isBusy = runningMcpEventId !== null || isSimulatingAll;

  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
        Run an MCP tool above to import events you can simulate here.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => {
        const isRunning = runningMcpEventId === event.id;
        const isDone = event.status === "simulated";
        const isFailed = event.status === "failed";
        const disabled = isBusy || isDone;

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onSimulate(event)}
            disabled={disabled}
            className={`rounded-md border px-3 py-2.5 text-left transition ${
              isDone
                ? "border-zinc-600 bg-zinc-900/80"
                : isFailed
                  ? "border-red-900/60 bg-red-950/20"
                  : styles.actionDefault
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-white">{event.label}</span>
              {isDone ? (
                <Check className="size-3.5 shrink-0 text-emerald-400" />
              ) : isRunning ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-zinc-300" />
              ) : null}
            </div>
            <p className={`mt-1 text-[10px] leading-relaxed ${styles.actionText}`}>{event.description}</p>
            <span className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium ${styles.actionCta}`}>
              {isRunning ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Running…
                </>
              ) : isDone ? (
                "Evidence uploaded"
              ) : isFailed ? (
                "Tap to retry"
              ) : (
                <>
                  <Play className="size-3" />
                  Simulate event
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function McpSimulationPanel({
  mcpServerUrl,
  onMcpServerUrlChange,
  mcpAuthHeader,
  onMcpAuthHeaderChange,
  mcpTools,
  mcpSelectedTool,
  mcpToolArgs,
  onMcpToolArgsChange,
  mcpEventLog,
  isMcpConnecting,
  isMcpPulling,
  isSimulatingAll,
  runningMcpEventId,
  planId,
  onMcpConnect,
  onMcpPull,
  onSimulateMcpEvent,
  onSimulateAllMcpEvents,
  styles,
}: {
  mcpServerUrl: string;
  onMcpServerUrlChange: (value: string) => void;
  mcpAuthHeader: string;
  onMcpAuthHeaderChange: (value: string) => void;
  mcpTools: McpToolDescriptor[];
  mcpSelectedTool: string;
  mcpToolArgs: string;
  onMcpToolArgsChange: (value: string) => void;
  mcpEventLog: McpSimulationEvent[];
  isMcpConnecting: boolean;
  isMcpPulling: boolean;
  isSimulatingAll: boolean;
  runningMcpEventId: string | null;
  planId: string | null;
  onMcpConnect: () => void;
  onMcpPull: (toolName: string) => void;
  onSimulateMcpEvent: (event: McpSimulationEvent) => void;
  onSimulateAllMcpEvents: () => void;
  styles: ReturnType<typeof demoPanelStyles>;
}) {
  const isBusy = isMcpConnecting || isMcpPulling || isSimulatingAll;
  const needsCustomArgs = mcpTools.some((tool) => !planId || !usesWorkspaceArgs(tool.name));
  const pendingCount = mcpEventLog.filter((event) => event.status === "pending").length;

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-white">MCP server</h3>
          <p className={`mt-1 text-sm ${styles.bodyText}`}>
            Connect, browse tools, and import real data as simulatable events.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="url"
            value={mcpServerUrl}
            onChange={(event) => onMcpServerUrlChange(event.target.value)}
            disabled={isBusy}
            placeholder="/api/mcp"
            aria-label="MCP server URL"
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-black/40 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onMcpConnect}
            disabled={isBusy || !mcpServerUrl.trim()}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isMcpConnecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Plug className="size-4" />
                Connect
              </>
            )}
          </button>
        </div>

        <input
          type="text"
          value={mcpAuthHeader}
          onChange={(event) => onMcpAuthHeaderChange(event.target.value)}
          disabled={isBusy}
          placeholder="Auth header (optional)"
          aria-label="MCP auth header"
          className="w-full rounded-md border border-zinc-700 bg-black/40 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
        />
      </section>

      {mcpTools.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-white">Tools</h3>
            <p className={`mt-1 text-sm ${styles.bodyText}`}>
              Run a tool to import its response as simulation events below.
              {planId ? " Workspace ID is filled in automatically when supported." : ""}
            </p>
          </div>

          {needsCustomArgs ? (
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Tool arguments (JSON)
              </span>
              <textarea
                value={mcpToolArgs}
                onChange={(event) => onMcpToolArgsChange(event.target.value)}
                disabled={isBusy}
                rows={3}
                placeholder='{"workspace_id":"<uuid>"}'
                className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-black/40 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-60"
              />
            </label>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {mcpTools.map((tool) => {
              const isPullingThis = isMcpPulling && mcpSelectedTool === tool.name;
              return (
                <div
                  key={tool.name}
                  className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-black/25 p-4"
                >
                  <div>
                    <div className="font-mono text-xs font-medium text-white">{tool.name}</div>
                    {tool.description ? (
                      <p className={`mt-1 text-xs leading-relaxed ${styles.actionText}`}>
                        {tool.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onMcpPull(tool.name)}
                    disabled={isBusy}
                    className={`inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
                  >
                    {isPullingThis ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-4" />
                        Import events
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-white">Imported events</h3>
            <p className={`mt-1 text-sm ${styles.bodyText}`}>
              {mcpEventLog.length > 0
                ? `${mcpEventLog.length} event${mcpEventLog.length === 1 ? "" : "s"} ready to simulate`
                : "No imported events yet"}
            </p>
          </div>
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={onSimulateAllMcpEvents}
              disabled={isBusy}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
            >
              {isSimulatingAll ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Simulating all…
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Simulate all ({pendingCount})
                </>
              )}
            </button>
          ) : null}
        </div>

        <McpImportedEventGrid
          events={mcpEventLog}
          runningMcpEventId={runningMcpEventId}
          isSimulatingAll={isSimulatingAll}
          onSimulate={onSimulateMcpEvent}
          styles={styles}
        />
      </section>
    </div>
  );
}

function SimulatorSubviewTabs({
  activeSubview,
  onChange,
  eventsLabel,
  showMcp = true,
}: {
  activeSubview: SimulatorSubview;
  onChange: (tab: SimulatorSubview) => void;
  eventsLabel: string;
  showMcp?: boolean;
}) {
  const tabs: Array<{ id: SimulatorSubview; label: string }> = [
    { id: "events", label: eventsLabel },
    ...(showMcp ? [{ id: "mcp" as const, label: "MCP simulation" }] : []),
  ];

  return (
    <div className="mb-4 shrink-0 border-b border-zinc-800">
      <div
        className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Simulator views"
      >
        {tabs.map((tab) => {
          const isActive = activeSubview === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              <span className="whitespace-nowrap text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
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
  customInputMode = "prompt",
  customPrompt = "",
  onCustomPromptChange,
  customPromptMinLength = 40,
  mcpServerUrl = "",
  onMcpServerUrlChange,
  mcpAuthHeader = "",
  onMcpAuthHeaderChange,
  mcpTools = [],
  mcpSelectedTool = "",
  onMcpSelectedToolChange,
  mcpToolArgs = "{}",
  onMcpToolArgsChange,
  mcpEventLog = [],
  isMcpConnecting = false,
  isMcpPulling = false,
  isSimulatingAllMcpEvents = false,
  runningMcpEventId = null,
  planId = null,
  sessionId = null,
  onMcpConnect,
  onMcpPull,
  onSimulateMcpEvent,
  onSimulateAllMcpEvents,
  onCustomInputModeChange,
  evidenceCount = 0,
  report = null,
  isReporting = false,
  workspaceConversionGoal,
  conversionGoalSource,
  onRequestPerformance,
  tapLinkUrl = null,
  isCreatingTapLink = false,
  onOpenTapValidation,
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
  customInputMode?: CustomInputMode;
  customPrompt?: string;
  onCustomPromptChange?: (value: string) => void;
  customPromptMinLength?: number;
  mcpServerUrl?: string;
  onMcpServerUrlChange?: (value: string) => void;
  mcpAuthHeader?: string;
  onMcpAuthHeaderChange?: (value: string) => void;
  mcpTools?: McpToolDescriptor[];
  mcpSelectedTool?: string;
  onMcpSelectedToolChange?: (value: string) => void;
  mcpToolArgs?: string;
  onMcpToolArgsChange?: (value: string) => void;
  mcpEventLog?: McpSimulationEvent[];
  isMcpConnecting?: boolean;
  isMcpPulling?: boolean;
  isSimulatingAllMcpEvents?: boolean;
  runningMcpEventId?: string | null;
  planId?: string | null;
  sessionId?: string | null;
  onMcpConnect?: () => void;
  onMcpPull?: (toolName: string) => void;
  onSimulateMcpEvent?: (event: McpSimulationEvent) => void;
  onSimulateAllMcpEvents?: () => void;
  onCustomInputModeChange?: (mode: CustomInputMode) => void;
  evidenceCount?: number;
  report?: PerformanceReport | null;
  isReporting?: boolean;
  workspaceConversionGoal?: string;
  conversionGoalSource?: ConversionGoalSource;
  onRequestPerformance?: () => void;
  tapLinkUrl?: string | null;
  isCreatingTapLink?: boolean;
  onOpenTapValidation?: () => void;
}) {
  const styles = demoPanelStyles(demo.accent);
  const externalMode = isExternalDemo(demo);
  const interactiveMode = isInteractiveDemo(demo);
  const verificationPills = getDemoVerificationPills(demo);
  const totalActions = demo.actions.filter((action) => action.kind === "evidence").length;
  const explored = countDistinctEvidenceActions(demo, worldState);
  const coveragePercent = Math.round((explored / totalActions) * 100);
  const [activeCategory, setActiveCategory] = useState<SimulationCategory>(demo.categoryOrder[0]);
  const [activeSubview, setActiveSubview] = useState<SimulatorSubview>("events");

  useEffect(() => {
    setActiveCategory(demo.categoryOrder[0]);
  }, [demo.id]);

  const handleSubviewChange = (tab: SimulatorSubview) => {
    setActiveSubview(tab);
    onCustomInputModeChange?.(tab === "mcp" ? "import" : "prompt");
  };

  return (
    <section
      className={
        fullHeight
          ? DEMO_TAB_PANEL
          : `flex w-full flex-col rounded-lg border ${styles.section}`
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
          {interactiveMode || isCustom ? (
            <DemoVerificationPills pills={verificationPills} />
          ) : (
            <span
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${styles.badge}`}
            >
              {demo.saasCategory}
            </span>
          )}
        </div>
      </div>

      <div
        className={
          fullHeight
            ? interactiveMode && phase === "simulating"
              ? DEMO_TAB_BODY_INTERACTIVE
              : DEMO_TAB_BODY
            : "flex flex-1 flex-col p-5 sm:p-6"
        }
      >
        {phase === "intro" || phase === "creating" ? (
          <div className="flex flex-col justify-center py-4">
            <Sparkles className={`size-8 ${styles.sparkles}`} />
            <h2 className="mt-4 text-xl font-medium text-white">
              {isCustom ? "Custom verification scenario" : demo.scenarioTitle}
            </h2>
            {isCustom ? (
              <>
                <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${styles.bodyText}`}>
                  Describe the product workflow, learner role, and competency you want to verify. OpenLesson
                  generates event actions and a workspace from your prompt. Calendar gap tools (+1 day, +3 days,
                  +1 week) are always included. Score cards return separate gaps and next steps — intermediate
                  goals plus granular events. After you start, use the MCP simulation tab to pull live data and
                  simulate imported event logs.
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
                sessions — then request score cards with separate gap analysis and next steps (intermediate goals
                plus granular events). Regenerate OpenLesson specs as evidence grows.
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onStart()}
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
          <div className="flex w-full flex-col gap-4">
            {isCustom ? (
              <SimulatorSubviewTabs
                activeSubview={activeSubview}
                onChange={handleSubviewChange}
                eventsLabel="Events"
                showMcp={isCustom}
              />
            ) : null}

            {isCustom &&
            activeSubview === "mcp" &&
            onMcpConnect &&
            onMcpPull &&
            onSimulateMcpEvent &&
            onSimulateAllMcpEvents &&
            onMcpServerUrlChange &&
            onMcpAuthHeaderChange &&
            onMcpToolArgsChange ? (
              <McpSimulationPanel
                mcpServerUrl={mcpServerUrl}
                onMcpServerUrlChange={onMcpServerUrlChange}
                mcpAuthHeader={mcpAuthHeader}
                onMcpAuthHeaderChange={onMcpAuthHeaderChange}
                mcpTools={mcpTools}
                mcpSelectedTool={mcpSelectedTool}
                mcpToolArgs={mcpToolArgs}
                onMcpToolArgsChange={onMcpToolArgsChange}
                mcpEventLog={mcpEventLog}
                isMcpConnecting={isMcpConnecting}
                isMcpPulling={isMcpPulling}
                isSimulatingAll={isSimulatingAllMcpEvents}
                runningMcpEventId={runningMcpEventId}
                planId={planId}
                onMcpConnect={onMcpConnect}
                onMcpPull={onMcpPull}
                onSimulateMcpEvent={onSimulateMcpEvent}
                onSimulateAllMcpEvents={onSimulateAllMcpEvents}
                styles={styles}
              />
            ) : externalMode && phase === "simulating" ? (
              <ExternalLaunchPanel
                demo={demo}
                planId={planId}
                sessionId={sessionId}
                evidenceCount={evidenceCount}
                inferredGoal={workspaceConversionGoal}
                conversionGoalSource={conversionGoalSource}
                styles={styles}
              />
            ) : interactiveMode && phase === "simulating" ? null : (
              <div className="flex w-full flex-col">
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

            <div className="pr-1">
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
              </div>
            )}
          </div>
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
              Regenerate living specs and skills as evidence accumulates — then re-score to refresh gaps and
              next steps.
            </div>
          </div>
        </div>
      </div>

      <div className={DEMO_TAB_BODY_CONTENT}>
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
  showIntegrationActions = false,
  ileSessionUrl = null,
  isCreatingIleSession = false,
  tapLinkUrl = null,
  isCreatingTapLink = false,
  onOpenIlePractice,
  onOpenTapValidation,
}: {
  worldState: SimulationWorldState;
  evidenceCount: number;
  actionCount: number;
  distinctEvidenceActions: number;
  isReporting: boolean;
  report: PerformanceReport | null;
  performanceResponse: PerformanceResponse | null;
  reportHistory: PerformanceReportSnapshot[];
  onRequestPerformance: () => void;
  showIntegrationActions?: boolean;
  ileSessionUrl?: string | null;
  isCreatingIleSession?: boolean;
  tapLinkUrl?: string | null;
  isCreatingTapLink?: boolean;
  onOpenIlePractice?: () => void;
  onOpenTapValidation?: () => void;
}) {
  const canRequestScore = evidenceCount > 0;
  const latestSnapshot = reportHistory[reportHistory.length - 1];
  const scoreMetrics = getScoreCardMetrics(report);
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
                Request scores at any point — each card separates gaps from next steps with intermediate goals
                and granular events you can act on.
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

      <div className={`${DEMO_TAB_BODY_CONTENT} gap-4`}>
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
          <div className="flex w-full flex-col gap-3">
            <div className="font-mono text-xs uppercase tracking-[1.5px] text-zinc-600">
              POST /api/evidence-api-demo/performance
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-400 sm:text-sm">
              {JSON.stringify(performanceResponse, null, 2)}
            </pre>
          </div>
        ) : null}

        {showIntegrationActions ? (
          <div className="shrink-0 rounded-lg border border-violet-500/20 bg-violet-950/15 px-4 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-violet-300">
              Platform integration
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Route gap repairs into guided ILE practice or a hosted TAP validation session — both open in a new
              tab against this workspace{report ? "" : " after you request a score card"}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenIlePractice}
                disabled={isCreatingIleSession}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-black/35 px-4 py-2.5 text-sm font-medium text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingIleSession ? <Loader2 className="size-4 animate-spin" /> : null}
                {ileSessionUrl ? "Open ILE practice ↗" : "Start ILE practice ↗"}
              </button>
              <button
                type="button"
                onClick={onOpenTapValidation}
                disabled={isCreatingTapLink}
                className="inline-flex items-center gap-2 rounded-md border border-violet-500/35 bg-violet-950/30 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingTapLink ? <Loader2 className="size-4 animate-spin" /> : null}
                {tapLinkUrl ? "Open TAP session ↗" : "Start TAP validation ↗"}
              </button>
            </div>
          </div>
        ) : null}

        {report && !showRawResponse && scoreMetrics ? (
          <div className="grid shrink-0 gap-3 rounded-lg border border-zinc-800 bg-black/25 px-4 py-3 sm:grid-cols-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Gaps</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.gaps > 0
                  ? `${scoreMetrics.gaps} identified deficiencies with evidence and repairs`
                  : "No specific gaps flagged — review strengths and next steps"}
              </p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Direction</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.directions > 0
                  ? `${scoreMetrics.directions} intermediate goal${scoreMetrics.directions === 1 ? "" : "s"} toward readiness`
                  : "Add evidence and re-score to surface high-level direction"}
              </p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Events</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.events > 0
                  ? `${scoreMetrics.events} granular action${scoreMetrics.events === 1 ? "" : "s"} to run next`
                  : "Granular next events appear after more evidence is collected"}
              </p>
            </div>
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
          <div className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 px-6 py-16 text-center">
            <Gauge className="size-10 text-zinc-600" />
            <h3 className="mt-4 text-lg font-medium text-zinc-300">No score yet</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              Run scenario events, then request a performance report to see competency markers, a dedicated gaps
              tab, and a next-steps tab with intermediate goals plus granular events.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
