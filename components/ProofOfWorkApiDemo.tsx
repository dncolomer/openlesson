"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Download,
  FileCode2,
  Gauge,
  LayoutGrid,
  ShieldCheck,
  Check,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { Navbar } from "@/components/Navbar";
import {
  getScoreCardMetrics,
  PerformanceReportCard,
  type PerformanceReportSnapshot,
} from "@/components/PerformanceReportCard";
import { normalizePerformanceReport, type PerformanceReport } from "@/lib/pow-api/performance-context";
import type { WorkspaceGoalSource } from "@/lib/pow-api/conversion-goal";
import type { ProofOfWorkEvalSchemaResult } from "@/lib/pow-api/proof-of-work-schema";
import type { ProofOfWorkApiDemoDefinition } from "@/lib/product-demos/demo-definition";
import { DemoVerificationPills } from "@/components/proof-of-work-demo/DemoVerificationPills";
import { PROOF_OF_WORK_API_DEMOS, resolveDemoId } from "@/lib/product-demos/demos";
import { isExternalDemo, isInteractiveDemo } from "@/lib/product-demos/game-tips";
import {
  buildOrbitLaunchUrl,
  initOrbitBridge,
  ORBIT_BRIDGE_STORAGE_KEY,
  readOrbitBridgeForPlan,
} from "@/lib/product-demos/orbit-bridge";
import {
  normalizeDemoSessionUrl,
  openDemoSessionUrl,
} from "@/lib/product-demos/demo-session-url";
import { selectTapValidationBlock } from "@/lib/product-demos/tap-validation";
import { getDemoVerificationPills } from "@/lib/product-demos/verification-pills";
import {
  applySimulationAction,
  buildSimulationProofOfWorkPayload,
  countDistinctProofOfWorkActions,
  createInitialWorldState,
  getActionsByCategory,
  hasCompletedAction,
  isActionRepeatable,
  matchBlockToStep,
  shouldSuggestSkillRegeneration,
  totalActionCount,
} from "@/lib/product-demos/simulation";
import type {
  DemoWorkspaceBlock,
  SimulationAction,
  SimulationCategory,
  SimulationWorldState,
} from "@/lib/product-demos/types";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { readJsonResponse } from "@/lib/read-json-response";

type DemoPhase = "picker" | "intro" | "creating" | "simulating";
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
  proofOfWorkCount: number;
  actionCount: number;
  simulatedDays: number;
  prefetch: boolean;
  timestamp: Date;
};

type SchemaSnapshot = {
  id: string;
  schema_name: string;
  spec_version?: string;
  spec: ProofOfWorkEvalSchemaResult;
  proofOfWorkCount: number;
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
};

type EvidenceResponse = {
  proof_of_work: { id: string; tool_action: string | null; created_at: string };
};

type PerformanceResponse = {
  mode: "score" | "chat";
  vertical?: "verification" | "augmentation" | "optimization";
  workspace_goal: string;
  workspace_goal_source: WorkspaceGoalSource;
  report: PerformanceReport;
  proof_of_work_summary: { proof_of_work_artifacts: number; blocks: number };
  file_ids?: string[];
};

const STORAGE_KEY = "uncertain-systems-demo";

type PersistedDemoState = {
  workspaceId: string;
  sessionId: string;
  demoId: string;
  worldState: SimulationWorldState;
  workspaceTitle?: string;
  blocks?: DemoWorkspaceBlock[];
};

function buildDemoApiBody(demo: ProofOfWorkApiDemoDefinition, payload: Record<string, unknown>) {
  return {
    ...payload,
    demoId: demo.id,
  };
}

function loadPersistedState(): PersistedDemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDemoState & { completedSteps?: string[] };
    if (!parsed.workspaceId || !parsed.sessionId) return null;
    const legacySteps = Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [];
    return {
      workspaceId: parsed.workspaceId,
      sessionId: parsed.sessionId,
      demoId: parsed.demoId ?? "orbit",
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

function hasDemoAccess(profile: { is_admin?: boolean | null } | null): boolean {
  return profile?.is_admin === true;
}

export function ProofOfWorkApiDemo() {
  const [authState, setAuthState] = useState<"loading" | "guest" | "no-admin" | "ready">("loading");
  const [phase, setPhase] = useState<DemoPhase>("picker");
  const [demoId, setDemoId] = useState<string | null>(null);
  const activeDemo = useMemo(() => resolveDemoId(demoId), [demoId]);
  const [workspaceId, setPlanId] = useState<string | null>(null);
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
  const [latestSchema, setLatestSchema] = useState<ProofOfWorkEvalSchemaResult | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [isRegeneratingSkill, setIsRegeneratingSkill] = useState(false);
  const [proofOfWorkCount, setProofOfWorkCount] = useState(0);
  const [lastSkillEvidenceCount, setLastSkillEvidenceCount] = useState<number | null>(null);
  const [skillRegenHint, setSkillRegenHint] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tapLinkUrl, setTapLinkUrl] = useState<string | null>(null);
  const [isCreatingTapLink, setIsCreatingTapLink] = useState(false);
  const [activeView, setActiveView] = useState<DemoView>("simulator");
  const [backgroundImage, setBackgroundImage] = useState(() =>
    aestheticImageForId("uncertain-systems-demo")
  );

  const backgroundSeed = workspaceId ?? demoId ?? "uncertain-systems-demo";

  const actionCount = totalActionCount(worldState);
  const distinctEvidenceActions = countDistinctProofOfWorkActions(activeDemo, worldState);

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
    const supabase = createClient();

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
          const res = await fetchWithTimeout("/api/demo/status");
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

      setProofOfWorkCount(bridge.proofOfWorkCount);
      setWorldState(bridge.worldState);

      if (bridge.inferredConversionGoal) {
        setPerformanceResponseRaw((prev) =>
          prev
            ? {
                ...prev,
                workspace_goal: bridge.inferredConversionGoal!,
                workspace_goal_source: bridge.workspaceGoalSource ?? prev.workspace_goal_source,
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
    const restoredDemo = resolveDemoId(persisted.demoId);

    setPlanId(persisted.workspaceId);
    setSessionId(persisted.sessionId);
    setDemoId(persisted.demoId);
    setWorldState(persisted.worldState);
    setWorkspaceTitle(persisted.workspaceTitle ?? null);
    setBlocks(persisted.blocks ?? []);

    if (isExternalDemo(restoredDemo)) {
      const bridge = applyOrbitBridgeSnapshot(persisted.workspaceId);
      setProofOfWorkCount(bridge?.proofOfWorkCount ?? 0);
    } else {
      setProofOfWorkCount(totalActionCount(persisted.worldState));
    }

    setPhase("simulating");
  }, [applyOrbitBridgeSnapshot, authState]);

  useEffect(() => {
    if (!workspaceId || phase !== "simulating" || !isExternalDemo(activeDemo)) return;

    const sync = () => {
      const bridge = applyOrbitBridgeSnapshot(workspaceId);
      if (!bridge) return;

      persistState({
        workspaceId,
        sessionId,
        demoId: activeDemo.id,
        worldState: bridge.worldState,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks: bridge.blocks.length > 0 ? bridge.blocks : blocks,
      });

      if (shouldSuggestSkillRegeneration(bridge.proofOfWorkCount, lastSkillEvidenceCount)) {
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
    lastSkillEvidenceCount,
    phase,
    workspaceId,
    sessionId,
    workspaceTitle,
  ]);

  const handleSelectDemo = (demo: ProofOfWorkApiDemoDefinition) => {
    setError("");
    setDemoId(demo.id);
    setPhase("intro");
  };

  const handleBackToPicker = () => {
    setError("");
    setPhase("picker");
  };

  const handleStartDemo = async () => {
    setError("");
    setTapLinkUrl(null);
    setIsCreatingTapLink(false);
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
    setProofOfWorkCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setActiveView("simulator");

    try {
      const res = await fetchWithTimeout(
        "/api/demo/workspace",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demoId: activeDemo.id,
          }),
        },
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
        if (data.code === "admin_required") {
          setAuthState("no-admin");
          throw new Error("Admin access required for this demo.");
        }
        throw new Error(
          [data.error || "Failed to create workspace", data.hint].filter(Boolean).join(" ")
        );
      }

      setPlanId(data.workspace.id);
      setWorkspaceTitle(data.workspace.title);
      setBlocks(data.blocks);
      setModelDocPreview(data.demo.model_doc_preview ?? null);
      const initialWorld = createInitialWorldState();
      if (isExternalDemo(activeDemo)) {
        initOrbitBridge(
          { workspaceId: data.workspace.id, sessionId: newSessionId, demoId: activeDemo.id },
          data.blocks
        );
      }
      persistState({
        workspaceId: data.workspace.id,
        sessionId: newSessionId,
        demoId: activeDemo.id,
        worldState: initialWorld,
        workspaceTitle: data.workspace.title,
        blocks: data.blocks,
      });

      setPhase("simulating");
      setWorldState(initialWorld);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start demo");
      setPhase("intro");
    }
  };

  const handleRunAction = async (action: SimulationAction) => {
    if (!workspaceId || runningActionId) return;
    if (!isActionRepeatable(action) && hasCompletedAction(worldState, action.id)) return;

    setRunningActionId(action.id);
    setError("");

    const nextWorld = applySimulationAction(worldState, action);
    const blockId = matchBlockToStep(blocks, action);
    const payload = buildSimulationProofOfWorkPayload(activeDemo, action, {
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
      const res = await fetchWithTimeout("/api/demo/proof-of-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
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
        throw new Error(data.error || "Proof-of-work upload failed");
      }

      const nextProofOfWorkCount = proofOfWorkCount + 1;
      setWorldState(nextWorld);
      setProofOfWorkCount(nextProofOfWorkCount);
      persistState({
        workspaceId,
        sessionId,
        demoId: activeDemo.id,
        worldState: nextWorld,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks,
      });

      if (shouldSuggestSkillRegeneration(nextProofOfWorkCount, lastSkillEvidenceCount)) {
        setSkillRegenHint(true);
      }

      if (
        isInteractiveDemo(activeDemo) &&
        action.kind === "proof_of_work" &&
        nextProofOfWorkCount >= 3 &&
        nextProofOfWorkCount % 3 === 0
      ) {
        void handleRequestPerformance({ switchView: false });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload proof of work");
    } finally {
      setRunningActionId(null);
    }
  };

  const handleFetchEvidenceSchema = async () => {
    if (!workspaceId || isFetchingSchema) return;

    setIsFetchingSchema(true);
    setError("");

    try {
      const res = await fetchWithTimeout(
        "/api/demo/proof-of-work-schema",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildDemoApiBody(activeDemo, {
              workspaceId,
              definition: activeDemo.evalDefinition,
            })
          ),
        },
        120000
      );

      const data = await readJsonResponse<{
        spec: ProofOfWorkEvalSchemaResult;
        context_counts?: { proof_of_work_artifacts?: number };
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Proof-of-work schema fetch failed");
      }

      setLatestSchema(data.spec);
      setSchemaHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          schema_name: data.spec.schema_name,
          spec_version: data.spec.spec_version,
          spec: data.spec,
          proofOfWorkCount,
          actionCount,
          simulatedDays: worldState.simulatedDays,
          timestamp: new Date(),
        },
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch proof-of-work schema");
    } finally {
      setIsFetchingSchema(false);
    }
  };

  const handleRegenerateSkill = async () => {
    if (!workspaceId || isRegeneratingSkill) return;

    let effectiveEvidenceCount = proofOfWorkCount;
    let effectiveWorldState = worldState;
    if (isExternalDemo(activeDemo)) {
      const bridge = applyOrbitBridgeSnapshot(workspaceId);
      if (bridge) {
        effectiveEvidenceCount = bridge.proofOfWorkCount;
        effectiveWorldState = bridge.worldState;
      }
    }
    if (effectiveEvidenceCount < 1) {
      setError("Run at least one action in Orbit to upload proof of work before regenerating the skill.");
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
        "/api/demo/integration-skill",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildDemoApiBody(activeDemo, {
              workspaceId,
              prefetch_proof_of_work_spec: true,
            })
          ),
        },
        180000
      );

      const data = await readJsonResponse<{
        skill_md: string;
        skill_name: string;
        proof_of_work_spec?: ProofOfWorkEvalSchemaResult;
        proof_of_work_spec_prefetched?: boolean;
        error?: string;
      }>(res);

      if (!res.ok) {
        throw new Error(data.error || "Skill regeneration failed");
      }

      setLatestSkillMd(data.skill_md);
      setLatestSkillName(data.skill_name);
      if (data.proof_of_work_spec) {
        setLatestSchema(data.proof_of_work_spec);
      }
      setLastSkillEvidenceCount(snapshotEvidenceCount);

      setSkillHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          skill_name: data.skill_name,
          skill_md: data.skill_md,
          spec_version: data.proof_of_work_spec?.spec_version,
          proofOfWorkCount: snapshotEvidenceCount,
          actionCount: snapshotActionCount,
          simulatedDays: snapshotSimulatedDays,
          prefetch: data.proof_of_work_spec_prefetched === true,
          timestamp: new Date(),
        },
      ]);

      if (data.proof_of_work_spec) {
        setSchemaHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            schema_name: data.proof_of_work_spec!.schema_name,
            spec_version: data.proof_of_work_spec!.spec_version,
            spec: data.proof_of_work_spec!,
            proofOfWorkCount: snapshotEvidenceCount,
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
    if (!workspaceId || isReporting) return;

    let effectiveEvidenceCount = proofOfWorkCount;
    let effectiveWorldState = worldState;
    if (isExternalDemo(activeDemo)) {
      const bridge = applyOrbitBridgeSnapshot(workspaceId);
      if (bridge) {
        effectiveEvidenceCount = bridge.proofOfWorkCount;
        effectiveWorldState = bridge.worldState;
      }
    }
    if (effectiveEvidenceCount < 1) {
      setError(
        isExternalDemo(activeDemo)
          ? "Run at least one action in Orbit to upload proof of work before requesting a score."
          : "Run at least one simulation action to upload proof of work before requesting a score."
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
        "/api/demo/performance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
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
      setProofOfWorkCount(data.proof_of_work_summary.proof_of_work_artifacts);
      setReportHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          report: normalizedReport,
          proofOfWorkCount: snapshotEvidenceCount,
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

  const resetLocalDemoState = () => {
    clearPersistedState();
    setPhase("picker");
    setDemoId(null);
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
    setProofOfWorkCount(0);
    setLastSkillEvidenceCount(null);
    setSkillRegenHint(false);
    setTapLinkUrl(null);
    setIsCreatingTapLink(false);
    setActiveView("simulator");
  };

  const handleOpenTapValidation = async () => {
    if (!workspaceId || isCreatingTapLink) return;

    if (tapLinkUrl) {
      openDemoSessionUrl(tapLinkUrl);
      return;
    }

    setIsCreatingTapLink(true);
    setError("");

    try {
      const block = selectTapValidationBlock(blocks);
      const res = await fetchWithTimeout("/api/demo/tap-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
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
    const workspaceToArchive = workspaceId;
    setIsResetting(true);

    if (workspaceToArchive) {
      try {
        const res = await fetchWithTimeout("/api/demo/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspaceToArchive }),
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
        <div className="flex min-h-[70vh] flex-col items-center justify-center">
          <LoadingStatusMessage message="Checking your account" />
        </div>
      </DemoFlowShell>
    );
  }

  if (authState === "guest") {
    return (
      <AuthGate
        backgroundImage={backgroundImage}
        title="Sign in to run the demo"
        body="The Proof-of-Work API demo creates a real verification workspace and uploads live proof of work. Admin access is required to continue."
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
        body="This internal demo uses the Proof-of-Work API to create workspaces, upload proof of work, and generate performance reports. Only admin accounts can run it."
        primaryHref="/dashboard"
        primaryLabel="Back to dashboard"
        secondaryHref="/docs/proof-of-work-api"
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
              Uncertain Systems in action
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Interactive demos for Uncertain Systems&apos;s three pillars:{" "}
              <span className="text-zinc-200">verification</span>,{" "}
              <span className="text-zinc-200">optimization</span>, and{" "}
              <span className="text-zinc-200">augmentation</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/docs/proof-of-work-api"
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
            {workspaceId ? (
              <>
                <Link
                  href={`/workspace/${workspaceId}`}
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
          workspaceId={workspaceId}
          worldState={worldState}
          proofOfWorkCount={proofOfWorkCount}
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
          <DemoUseCasePicker demos={PROOF_OF_WORK_API_DEMOS} onSelect={handleSelectDemo} />
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
            proofOfWorkCount={proofOfWorkCount}
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
                workspaceId={workspaceId}
                sessionId={sessionId}
                proofOfWorkCount={proofOfWorkCount}
                report={report}
                isReporting={isReporting}
                workspaceGoal={performanceResponseRaw?.workspace_goal}
                workspaceGoalSource={performanceResponseRaw?.workspace_goal_source}
                onRequestPerformance={() => void handleRequestPerformance()}
                tapLinkUrl={tapLinkUrl}
                isCreatingTapLink={isCreatingTapLink}
                onOpenTapValidation={() => void handleOpenTapValidation()}
              />
            ) : null}

            {activeView === "evaluation" ? (
              <ContinuousEvaluationView
                workspaceId={workspaceId}
                proofOfWorkCount={proofOfWorkCount}
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
                proofOfWorkCount={proofOfWorkCount}
                actionCount={actionCount}
                distinctEvidenceActions={distinctEvidenceActions}
                isReporting={isReporting}
                report={report}
                performanceResponse={performanceResponseRaw}
                reportHistory={reportHistory}
                onRequestPerformance={() => void handleRequestPerformance()}
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
  workspaceId,
  worldState,
  proofOfWorkCount,
  actionCount,
  phase,
  isReporting,
  isFetchingSchema,
  isRegeneratingSkill,
  report,
}: {
  workspaceId: string | null;
  worldState: SimulationWorldState;
  proofOfWorkCount: number;
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

  const primaryScore =
    typeof report?.score === "number"
      ? Math.round(Math.max(0, Math.min(100, report.score)))
      : null;
  const verticalLabel = "LWM Snapshot";
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
            Evidence <span className="text-white">{proofOfWorkCount}</span>
          </span>
          {primaryScore != null ? (
            <span className="font-mono text-zinc-500">
              {verticalLabel} <span className="text-white">{primaryScore}/100</span>
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
          {workspaceId ? (
            <code className="hidden font-mono text-[10px] text-zinc-600 sm:inline">
              {workspaceId.slice(0, 8)}…
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

function demoPanelStyles(_accent?: ProofOfWorkApiDemoDefinition["accent"]) {
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
  workspaceId,
  sessionId,
  proofOfWorkCount,
  inferredGoal,
  workspaceGoalSource,
  styles,
}: {
  demo: ProofOfWorkApiDemoDefinition;
  workspaceId: string | null;
  sessionId: string | null;
  proofOfWorkCount: number;
  inferredGoal?: string | null;
  workspaceGoalSource?: WorkspaceGoalSource;
  styles: ReturnType<typeof demoPanelStyles>;
}) {
  const canLaunch = Boolean(workspaceId && sessionId);
  const launchUrl = canLaunch
    ? buildOrbitLaunchUrl({ workspaceId: workspaceId!, sessionId: sessionId! })
    : null;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`flex size-14 items-center justify-center rounded-lg text-lg font-bold ${styles.logo}`}>
        {demo.initials}
      </div>
      <h3 className="mt-6 text-2xl font-medium text-white">{demo.productName} is ready</h3>
      <p className={`mt-3 max-w-lg text-sm leading-relaxed ${styles.bodyText}`}>
        Launch the full-screen product in a new browser tab. Learn by doing inside Orbit while proof of work
        verifies learning and conversion. Smart coaching overlays ask &ldquo;are you trying to X?&rdquo; and
        coach the next step as score cards update.
      </p>

      {inferredGoal ? (
        <p className="mt-4 max-w-lg rounded-md border border-zinc-700 bg-black/30 px-4 py-3 text-sm leading-snug text-zinc-200">
          Are you trying to <span className="font-medium text-white">{inferredGoal}</span>?
          {workspaceGoalSource ? (
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-zinc-500">
              {workspaceGoalSource === "workspace" ? "Workspace goal" : "Inferred goal"}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
        {proofOfWorkCount} proof-of-work event{proofOfWorkCount === 1 ? "" : "s"} · synced live from Orbit
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

type DemoVerticalCard = {
  id: string;
  title: string;
  description: string;
  status: "available" | "coming_soon";
  demo?: ProofOfWorkApiDemoDefinition;
  icon: ReactNode;
};

function DemoUseCasePicker({
  demos,
  onSelect,
}: {
  demos: ProofOfWorkApiDemoDefinition[];
  onSelect: (demo: ProofOfWorkApiDemoDefinition) => void;
}) {
  const orbitDemo = demos.find((demo) => demo.id === "orbit") ?? demos[0];

  const verticals: DemoVerticalCard[] = [
    {
      id: "verification",
      title: "Learning Verification",
      description:
        "Verify what candidates, employees, and agents can actually do before hire, deploy, or certify — with TAP, ILE, and Proof-of-Work API scoring.",
      status: "coming_soon",
      icon: <ShieldCheck className="size-5" />,
    },
    {
      id: "optimization",
      title: "Learning Optimization",
      description: orbitDemo
        ? `${orbitDemo.productName} — ${orbitDemo.description}`
        : "Turn verification findings into onboarding and agent skill loops that close gaps until adoption improves.",
      status: "available",
      demo: orbitDemo,
      icon: <Gauge className="size-5" />,
    },
    {
      id: "augmentation",
      title: "Learning Augmentation",
      description:
        "Strengthen how learners think inside courses, prep programs, and certification journeys — with coached practice beyond shallow knowledge checks.",
      status: "coming_soon",
      icon: <Sparkles className="size-5" />,
    },
  ];

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5 sm:p-8">
      <div className="max-w-2xl">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          Step 1 · Choose a vertical
        </div>
        <h2 className="mt-2 text-2xl font-medium text-white sm:text-3xl">
          Verification, optimization, and augmentation in action
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Each demo shows one Uncertain Systems vertical inside a real product workflow. Score cards coach gaps and next steps
          toward adoption — not exam completion.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {verticals.map((vertical) => {
          const styles = demoPanelStyles(vertical.demo?.accent);
          const isAvailable = vertical.status === "available" && vertical.demo;

          if (isAvailable) {
            const demo = vertical.demo!;
            const verificationPills = getDemoVerificationPills(demo);
            return (
              <button
                key={vertical.id}
                type="button"
                onClick={() => onSelect(demo)}
                className={`group rounded-lg border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${styles.section}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md border border-zinc-700 bg-black/40 text-zinc-300">
                      {vertical.icon}
                    </div>
                    <div>
                      <div className="text-base font-medium text-white">{vertical.title}</div>
                      <div className={`text-xs ${styles.subtitle}`}>{demo.productName} demo</div>
                    </div>
                  </div>
                  <DemoVerificationPills pills={verificationPills} />
                </div>
                <p className={`mt-4 text-sm leading-relaxed ${styles.bodyText}`}>{vertical.description}</p>
                <div className="mt-5 flex items-center gap-2 text-xs font-medium text-white/90">
                  {demo.simulatorMode === "external" ? "Launch full-screen app" : "Run this demo"}
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          }

          return (
            <div
              key={vertical.id}
              className={`rounded-lg border p-5 text-left opacity-80 ${styles.section}`}
              aria-disabled
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md border border-zinc-800 bg-black/20 text-zinc-500">
                    {vertical.icon}
                  </div>
                  <div>
                    <div className="text-base font-medium text-zinc-300">{vertical.title}</div>
                    <div className="text-xs text-zinc-600">Demo coming soon</div>
                  </div>
                </div>
                <span className="rounded border border-zinc-800 bg-black/20 px-2 py-1 font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">
                  Soon
                </span>
              </div>
              <p className={`mt-4 text-sm leading-relaxed ${styles.bodyText}`}>{vertical.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function countCategoryActivity(
  demo: ProofOfWorkApiDemoDefinition,
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
  workspaceId = null,
  sessionId = null,
  proofOfWorkCount = 0,
  report = null,
  isReporting = false,
  workspaceGoal,
  workspaceGoalSource,
  onRequestPerformance,
  tapLinkUrl = null,
  isCreatingTapLink = false,
  onOpenTapValidation,
}: {
  demo: ProofOfWorkApiDemoDefinition;
  phase: DemoPhase;
  worldState: SimulationWorldState;
  runningActionId: string | null;
  onStart: () => void;
  onRunAction: (action: SimulationAction) => void;
  onBackToPicker?: () => void;
  fullHeight?: boolean;
  workspaceId?: string | null;
  sessionId?: string | null;
  proofOfWorkCount?: number;
  report?: PerformanceReport | null;
  isReporting?: boolean;
  workspaceGoal?: string;
  workspaceGoalSource?: WorkspaceGoalSource;
  onRequestPerformance?: () => void;
  tapLinkUrl?: string | null;
  isCreatingTapLink?: boolean;
  onOpenTapValidation?: () => void;
}) {
  const styles = demoPanelStyles(demo.accent);
  const externalMode = isExternalDemo(demo);
  const interactiveMode = isInteractiveDemo(demo);
  const verificationPills = getDemoVerificationPills(demo);
  const totalActions = demo.actions.filter((action) => action.kind === "proof_of_work").length;
  const explored = countDistinctProofOfWorkActions(demo, worldState);
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
          {interactiveMode ? (
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
            <h2 className="mt-4 text-xl font-medium text-white">{demo.scenarioTitle}</h2>
            <p className={`mt-2 max-w-md text-sm leading-relaxed ${styles.bodyText}`}>
              {demo.scenarioIntro.replace(/\*\*/g, "")} Use calendar gap tools to record idle time between
              sessions — then request score cards with separate gap analysis and next steps (intermediate goals
              plus granular events). Regenerate Uncertain Systems specs as proof of work grows.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onStart()}
                disabled={phase === "creating"}
                className={`inline-flex w-fit items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
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
            {externalMode && phase === "simulating" ? (
              <ExternalLaunchPanel
                demo={demo}
                workspaceId={workspaceId}
                sessionId={sessionId}
                proofOfWorkCount={proofOfWorkCount}
                inferredGoal={workspaceGoal}
                workspaceGoalSource={workspaceGoalSource}
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
  demo: ProofOfWorkApiDemoDefinition;
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
  workspaceId,
  proofOfWorkCount,
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
  workspaceId: string | null;
  proofOfWorkCount: number;
  isFetchingSchema: boolean;
  isRegeneratingSkill: boolean;
  skillRegenHint: boolean;
  error: string;
  skillHistory: SkillSnapshot[];
  schemaHistory: SchemaSnapshot[];
  latestSkillMd: string | null;
  latestSkillName: string | null;
  latestSchema: ProofOfWorkEvalSchemaResult | null;
  onFetchEvidenceSchema: () => void;
  onRegenerateSkill: () => void;
}) {
  const canRegenerate = !!workspaceId && proofOfWorkCount > 0;
  const hasArtifacts = schemaHistory.length > 0 || skillHistory.length > 0;

  return (
    <section className={DEMO_TAB_PANEL}>
      <div className={DEMO_TAB_HEADER}>
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-zinc-300" />
          <div>
            <div className="text-sm font-medium text-white">Continuous evaluation</div>
            <div className="text-xs text-zinc-500">
              Regenerate living specs and skills as proof of work accumulates — then re-score to refresh gaps and
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
                Evidence crossed a threshold ({proofOfWorkCount} artifacts). Regenerate the integration
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
                Re-fetch proof-of-work spec
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
                      Proof-of-work spec versions
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
                              {snapshot.simulatedDays} · {snapshot.proofOfWorkCount} artifacts
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
                              v{index + 1} · day {snapshot.simulatedDays} · {snapshot.proofOfWorkCount} artifacts
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
  proofOfWorkCount,
  actionCount,
  distinctEvidenceActions,
  isReporting,
  report,
  performanceResponse,
  reportHistory,
  onRequestPerformance,
}: {
  worldState: SimulationWorldState;
  proofOfWorkCount: number;
  actionCount: number;
  distinctEvidenceActions: number;
  isReporting: boolean;
  report: PerformanceReport | null;
  performanceResponse: PerformanceResponse | null;
  reportHistory: PerformanceReportSnapshot[];
  onRequestPerformance: () => void;
}) {
  const canRequestScore = proofOfWorkCount > 0;
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
            {worldState.simulatedDays} · {proofOfWorkCount} proof-of-work artifact
            {proofOfWorkCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Run scenario actions in the Event simulator tab to upload proof of work, then request your first score.
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
              POST /api/demo/performance
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-400 sm:text-sm">
              {JSON.stringify(performanceResponse, null, 2)}
            </pre>
          </div>
        ) : null}

        {report && !showRawResponse && scoreMetrics ? (
          <div className="grid shrink-0 gap-3 rounded-lg border border-zinc-800 bg-black/25 px-4 py-3 sm:grid-cols-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Gaps</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.gaps > 0
                  ? `${scoreMetrics.gaps} identified deficiencies with proof of work and repairs`
                  : "No specific gaps flagged — review strengths and next steps"}
              </p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Direction</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.directions > 0
                  ? `${scoreMetrics.directions} intermediate goal${scoreMetrics.directions === 1 ? "" : "s"} toward readiness`
                  : "Add proof of work and re-score to surface high-level direction"}
              </p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Events</div>
              <p className="mt-1 text-sm text-zinc-300">
                {scoreMetrics.events > 0
                  ? `${scoreMetrics.events} granular action${scoreMetrics.events === 1 ? "" : "s"} to run next`
                  : "Granular next events appear after more proof of work is collected"}
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
              workspaceGoal={performanceResponse?.workspace_goal}
              workspaceGoalSource={performanceResponse?.workspace_goal_source}
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
