"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import type { PerformanceReport } from "@/lib/agent-v2/performance-context";
import {
  DEMO_EVAL_DEFINITION,
  DEMO_PRODUCT_NAME,
  FLOWSTACK_STEPS,
  buildToolEvidencePayload,
  matchBlockToStep,
  type DemoWorkspaceBlock,
  type FlowStackStep,
} from "@/lib/evidence-api-demo/flowstack";
import { readJsonResponse } from "@/lib/read-json-response";

type DemoPhase = "intro" | "creating" | "onboarding" | "ready" | "reporting" | "report";

type ApiLogEntry = {
  id: string;
  method: string;
  path: string;
  status: "pending" | "success" | "error";
  summary: string;
  detail?: string;
  timestamp: Date;
};

type WorkspaceResponse = {
  workspace: { id: string; title: string };
  blocks: DemoWorkspaceBlock[];
  demo: { product: string; integration_name: string; eval_definition: string };
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
  completedSteps: string[];
  workspaceTitle?: string;
  blocks?: DemoWorkspaceBlock[];
};

function loadPersistedState(): PersistedDemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDemoState;
    if (!parsed.planId || !parsed.sessionId) return null;
    return {
      planId: parsed.planId,
      sessionId: parsed.sessionId,
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
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
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [uploadingStep, setUploadingStep] = useState<string | null>(null);
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  const [error, setError] = useState("");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(0);

  const currentStep = FLOWSTACK_STEPS[currentStepIndex] ?? null;
  const allStepsComplete = completedSteps.length >= FLOWSTACK_STEPS.length;

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
    setCompletedSteps(persisted.completedSteps);
    setWorkspaceTitle(persisted.workspaceTitle ?? null);
    setBlocks(persisted.blocks ?? []);
    setEvidenceCount(persisted.completedSteps.length);
    setCurrentStepIndex(
      Math.min(persisted.completedSteps.length, FLOWSTACK_STEPS.length - 1)
    );
    if (persisted.completedSteps.length >= FLOWSTACK_STEPS.length) {
      setPhase("ready");
    } else {
      setPhase("onboarding");
    }
  }, [authState]);

  const handleStartDemo = async () => {
    setError("");
    setPhase("creating");
    clearPersistedState();
    const newSessionId = createSessionId();
    setSessionId(newSessionId);
    setCompletedSteps([]);
    setCurrentStepIndex(0);
    setReport(null);
    setEvidenceCount(0);
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
      persistState({
        planId: data.workspace.id,
        sessionId: newSessionId,
        completedSteps: [],
        workspaceTitle: data.workspace.title,
        blocks: data.blocks,
      });

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/workspace",
        status: "success",
        summary: `Workspace created: ${data.workspace.title}`,
        detail: `${data.blocks.length} assessable blocks generated`,
      });

      setPhase("onboarding");
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

  const handleCompleteStep = async (step: FlowStackStep) => {
    if (!planId || completedSteps.includes(step.id) || uploadingStep) return;

    setUploadingStep(step.id);
    setError("");

    const blockId = matchBlockToStep(blocks, step);
    const payload = buildToolEvidencePayload(step, {
      sessionId,
      blockId,
      reflection: `User completed "${step.label}" in the FlowStack trial onboarding flow.`,
      outcome: "success",
    });

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/evidence",
      status: "pending",
      summary: `Uploading tool evidence for "${step.label}"`,
      detail: blockId ? `block_id: ${blockId.slice(0, 8)}…` : "workspace-global",
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
          tool_name: "flowstack",
          tool_action: step.id,
          file_name: `${step.id}.json`,
        }),
      });

      const data = await readJsonResponse<EvidenceResponse & { error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Evidence upload failed");
      }

      const nextCompleted = [...completedSteps, step.id];
      setCompletedSteps(nextCompleted);
      setEvidenceCount((count) => count + 1);
      persistState({
        planId,
        sessionId,
        completedSteps: nextCompleted,
        workspaceTitle: workspaceTitle ?? undefined,
        blocks,
      });

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence",
        status: "success",
        summary: `Evidence stored: ${step.label}`,
        detail: `artifact ${data.evidence.id.slice(0, 8)}…`,
      });

      if (nextCompleted.length >= FLOWSTACK_STEPS.length) {
        setPhase("ready");
      } else {
        setCurrentStepIndex((index) => Math.min(index + 1, FLOWSTACK_STEPS.length - 1));
      }
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/evidence",
        status: "error",
        summary: err instanceof Error ? err.message : "Upload failed",
      });
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setUploadingStep(null);
    }
  };

  const handleRequestPerformance = async () => {
    if (!planId) return;

    setPhase("reporting");
    setError("");

    addLog({
      method: "POST",
      path: "/api/evidence-api-demo/performance",
      status: "pending",
      summary: "Requesting gap analysis and readiness report…",
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

      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/performance",
        status: "success",
        summary: "Performance report generated",
        detail: `confidence: ${data.report.confidence}`,
      });

      setPhase("report");
    } catch (err) {
      addLog({
        method: "POST",
        path: "/api/evidence-api-demo/performance",
        status: "error",
        summary: err instanceof Error ? err.message : "Report failed",
      });
      setError(err instanceof Error ? err.message : "Failed to generate report");
      setPhase("ready");
    }
  };

  const handleReset = () => {
    clearPersistedState();
    setPhase("intro");
    setPlanId(null);
    setWorkspaceTitle(null);
    setBlocks([]);
    setApiPaths(null);
    setSessionId(createSessionId());
    setCompletedSteps([]);
    setCurrentStepIndex(0);
    setReport(null);
    setEvidenceCount(0);
    setApiLog([]);
    setError("");
  };

  const progressPercent = useMemo(
    () => Math.round((completedSteps.length / FLOWSTACK_STEPS.length) * 100),
    [completedSteps.length]
  );

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
              Walk through a fictional SaaS product ({DEMO_PRODUCT_NAME}) while OpenLesson captures tool
              evidence and scores learning-to-conversion readiness — the same flow you would wire into
              your own product via the Agentic API.
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
        <FlowStackPanel
          phase={phase}
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          progressPercent={progressPercent}
          uploadingStep={uploadingStep}
          allStepsComplete={allStepsComplete}
          onStart={handleStartDemo}
          onCompleteStep={handleCompleteStep}
        />

        <OpenLessonPanel
          phase={phase}
          planId={planId}
          workspaceTitle={workspaceTitle}
          apiPaths={apiPaths}
          sessionId={sessionId}
          evidenceCount={evidenceCount}
          apiLog={apiLog}
          error={error}
          report={report}
          evalDefinition={DEMO_EVAL_DEFINITION}
          onRequestPerformance={handleRequestPerformance}
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

function FlowStackPanel({
  phase,
  currentStep,
  currentStepIndex,
  completedSteps,
  progressPercent,
  uploadingStep,
  allStepsComplete,
  onStart,
  onCompleteStep,
}: {
  phase: DemoPhase;
  currentStep: FlowStackStep | null;
  currentStepIndex: number;
  completedSteps: string[];
  progressPercent: number;
  uploadingStep: string | null;
  allStepsComplete: boolean;
  onStart: () => void;
  onCompleteStep: (step: FlowStackStep) => void;
}) {
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
              <div className="text-xs text-indigo-200/70">Trial onboarding · simulated product</div>
            </div>
          </div>
          <span className="rounded-full border border-indigo-400/25 bg-indigo-950/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-indigo-200">
            Demo app
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {phase === "intro" || phase === "creating" ? (
          <div className="flex flex-1 flex-col justify-center py-8">
            <Sparkles className="size-8 text-indigo-300" />
            <h2 className="mt-4 text-xl font-medium text-white">Start your 14-day trial</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-indigo-100/70">
              This is a fictional team collaboration product. Complete the onboarding milestones
              as a trial user would — connect Slack, create a project, invite a teammate, and reach
              activation.
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
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs text-indigo-200/60">
                <span>Onboarding progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-indigo-950">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <ol className="space-y-3">
              {FLOWSTACK_STEPS.map((step, index) => {
                const done = completedSteps.includes(step.id);
                const active = !done && index === currentStepIndex && !allStepsComplete;
                const isUploading = uploadingStep === step.id;

                return (
                  <li
                    key={step.id}
                    className={`rounded-md border px-4 py-3 transition ${
                      done
                        ? "border-emerald-500/25 bg-emerald-950/20"
                        : active
                          ? "border-indigo-400/40 bg-indigo-950/40"
                          : "border-indigo-500/10 bg-black/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {done ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-indigo-400/50" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">{step.label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-indigo-100/60">
                          {step.description}
                        </p>
                        {active ? (
                          <button
                            type="button"
                            onClick={() => onCompleteStep(step)}
                            disabled={!!uploadingStep}
                            className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-2 text-xs font-medium text-indigo-950 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Submitting evidence…
                              </>
                            ) : (
                              step.cta
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {allStepsComplete ? (
              <div className="mt-6 rounded-md border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/90">
                Activation milestone reached. OpenLesson has tool evidence for every onboarding step.
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function OpenLessonPanel({
  phase,
  planId,
  workspaceTitle,
  apiPaths,
  sessionId,
  evidenceCount,
  apiLog,
  error,
  report,
  evalDefinition,
  onRequestPerformance,
  onReset,
}: {
  phase: DemoPhase;
  planId: string | null;
  workspaceTitle: string | null;
  apiPaths: WorkspaceResponse["api_paths"] | null;
  sessionId: string;
  evidenceCount: number;
  apiLog: ApiLogEntry[];
  error: string;
  report: PerformanceReport | null;
  evalDefinition: string;
  onRequestPerformance: () => void;
  onReset: () => void;
}) {
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
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <Stat label="Workspace" value={planId ? "Active" : "—"} />
          <Stat label="Evidence" value={evidenceCount > 0 ? String(evidenceCount) : "—"} />
          <Stat
            label="Phase"
            value={
              phase === "report" || phase === "reporting"
                ? "Scoring"
                : phase === "ready"
                  ? "Ready"
                  : phase === "onboarding"
                    ? "Collecting"
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

        {(phase === "ready" || phase === "reporting" || phase === "report") && planId ? (
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs leading-relaxed text-zinc-500">
              Request a performance report to see gap analysis against this eval definition:
            </p>
            <p className="rounded-md border border-zinc-800 bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-400">
              {evalDefinition.slice(0, 280)}
              {evalDefinition.length > 280 ? "…" : ""}
            </p>
            <button
              type="button"
              onClick={onRequestPerformance}
              disabled={phase === "reporting"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {phase === "reporting" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating report…
                </>
              ) : (
                "Request performance report"
              )}
            </button>
          </div>
        ) : null}

        {report ? <PerformanceReportCard report={report} /> : null}

        {planId ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            Reset demo session
          </button>
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

function PerformanceReportCard({ report }: { report: PerformanceReport }) {
  return (
    <div className="space-y-4 rounded-md border border-cyan-500/20 bg-cyan-950/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white">Performance report</h3>
        <span className="rounded-full border border-cyan-400/25 bg-cyan-950/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200">
          {confidenceLabel(report.confidence)}
        </span>
      </div>

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