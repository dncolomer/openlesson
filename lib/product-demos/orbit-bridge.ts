import type { ConversionGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import type { OrbitAppState } from "./orbit-app-model";
import {
  buildActionReflection,
  buildOrbitAppSnapshot,
  formatOrbitSnapshotForPrompt,
  type OrbitAppSnapshot,
} from "./orbit-app-context";
import { orbitDemo } from "./demos/orbit";
import { ORBIT_PERFORMANCE_STYLE_PROMPT } from "./orbit-performance-style";
import type { DemoWorkspaceBlock } from "./types";
import {
  applySimulationAction,
  buildSimulationProofOfWorkPayload,
  createInitialWorldState,
  matchBlockToStep,
} from "./simulation";
import type { SimulationAction, SimulationWorldState } from "./types";
import { getSimulationAction } from "./simulation";

export const ORBIT_BRIDGE_STORAGE_KEY = "orbit-proof-of-work-bridge";
export const DEMO_STORAGE_KEY = "uncertain-systems-demo";

export type OrbitProofOfWorkBridge = {
  workspaceId: string;
  sessionId: string;
  demoId: string;
  blocks: DemoWorkspaceBlock[];
  worldState: SimulationWorldState;
  proofOfWorkCount: number;
  inferredConversionGoal?: string;
  conversionGoalSource?: ConversionGoalSource;
  ileSessionUrl?: string;
  tapLinkUrl?: string;
  tapScore?: number | null;
  tapCleared?: boolean;
  sprintPublished?: boolean;
  lastPerformanceReport?: PerformanceReport | null;
  lastAppSnapshot?: OrbitAppSnapshot;
};

export type OrbitLaunchParams = {
  workspaceId: string;
  sessionId: string;
  demoId?: string;
};

export type OrbitPerformanceResponse = {
  report: PerformanceReport | null;
  workspace_conversion_goal: string;
  conversion_goal_source: ConversionGoalSource;
};

export function buildOrbitLaunchUrl(params: OrbitLaunchParams, origin = ""): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const search = new URLSearchParams({
    workspaceId: params.workspaceId,
    sessionId: params.sessionId,
    demoId: params.demoId ?? orbitDemo.id,
  });
  return `${base}/demo-app?${search.toString()}`;
}

export function parseOrbitLaunchParams(search: string): OrbitLaunchParams | null {
  const params = new URLSearchParams(search);
  const workspaceId = params.get("workspaceId");
  const sessionId = params.get("sessionId");
  if (!workspaceId || !sessionId) return null;
  return {
    workspaceId,
    sessionId,
    demoId: params.get("demoId") ?? orbitDemo.id,
  };
}

export function loadOrbitBridge(): OrbitProofOfWorkBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORBIT_BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrbitProofOfWorkBridge;
    if (!parsed.workspaceId || !parsed.sessionId) return null;
    return {
      ...parsed,
      worldState: parsed.worldState ?? createInitialWorldState(),
      proofOfWorkCount: parsed.proofOfWorkCount ?? 0,
      blocks: parsed.blocks ?? [],
    };
  } catch {
    return null;
  }
}

export function saveOrbitBridge(bridge: OrbitProofOfWorkBridge): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORBIT_BRIDGE_STORAGE_KEY, JSON.stringify(bridge));
  syncOrbitBridgeToDemoPersistence(bridge);
}

function syncOrbitBridgeToDemoPersistence(bridge: OrbitProofOfWorkBridge): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      workspaceId?: string;
      worldState?: SimulationWorldState;
      blocks?: DemoWorkspaceBlock[];
    };
    if (parsed.workspaceId !== bridge.workspaceId) return;
    localStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        worldState: bridge.worldState,
        blocks: bridge.blocks.length > 0 ? bridge.blocks : parsed.blocks,
      })
    );
  } catch {
    // ignore sync failures
  }
}

export function readOrbitBridgeForPlan(workspaceId: string): OrbitProofOfWorkBridge | null {
  const bridge = loadOrbitBridge();
  if (!bridge || bridge.workspaceId !== workspaceId) return null;
  return bridge;
}

export function initOrbitBridge(
  params: OrbitLaunchParams,
  blocks: DemoWorkspaceBlock[] = []
): OrbitProofOfWorkBridge {
  const existing = loadOrbitBridge();
  if (existing && existing.workspaceId === params.workspaceId) {
    const merged: OrbitProofOfWorkBridge = {
      ...existing,
      blocks: blocks.length > 0 ? blocks : existing.blocks,
    };
    saveOrbitBridge(merged);
    return merged;
  }
  const bridge: OrbitProofOfWorkBridge = {
    workspaceId: params.workspaceId,
    sessionId: params.sessionId,
    demoId: params.demoId ?? orbitDemo.id,
    blocks,
    worldState: createInitialWorldState(),
    proofOfWorkCount: 0,
  };
  saveOrbitBridge(bridge);
  return bridge;
}

export function getOrbitProofOfWorkCountForPlan(workspaceId: string): number {
  const bridge = loadOrbitBridge();
  if (!bridge || bridge.workspaceId !== workspaceId) return 0;
  return bridge.proofOfWorkCount;
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function applyPerformanceToBridge(
  bridge: OrbitProofOfWorkBridge,
  performance: OrbitPerformanceResponse
): OrbitProofOfWorkBridge {
  const goal =
    performance.workspace_conversion_goal?.trim() ||
    performance.report?.conversion_goal?.trim() ||
    "";
  const next: OrbitProofOfWorkBridge = {
    ...bridge,
    inferredConversionGoal: goal || bridge.inferredConversionGoal,
    conversionGoalSource: performance.conversion_goal_source ?? bridge.conversionGoalSource,
    lastPerformanceReport: performance.report ?? bridge.lastPerformanceReport ?? null,
  };
  saveOrbitBridge(next);
  return next;
}

export function orbitUiContextFromSnapshot(
  snapshot: OrbitAppSnapshot | null | undefined
): string {
  return snapshot ? formatOrbitSnapshotForPrompt(snapshot) : "";
}

export function syncOrbitAppSnapshotToBridge(
  snapshot: OrbitAppSnapshot
): OrbitProofOfWorkBridge | null {
  const bridge = loadOrbitBridge();
  if (!bridge) return null;
  const next: OrbitProofOfWorkBridge = { ...bridge, lastAppSnapshot: snapshot };
  saveOrbitBridge(next);
  return next;
}

export async function fetchOrbitPerformance(
  bridge: OrbitProofOfWorkBridge,
  options?: { orbitUiContext?: string; stylePrompt?: string }
): Promise<OrbitPerformanceResponse> {
  const orbitUiContext =
    options?.orbitUiContext?.trim() ||
    orbitUiContextFromSnapshot(bridge.lastAppSnapshot);
  const stylePrompt = options?.stylePrompt?.trim() || ORBIT_PERFORMANCE_STYLE_PROMPT;

  const res = await fetch("/api/demo/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: bridge.workspaceId,
      style_prompt: stylePrompt,
      ...(orbitUiContext ? { orbit_ui_context: orbitUiContext } : {}),
    }),
  });
  const data = await readJsonResponse<{
    report?: PerformanceReport;
    workspace_conversion_goal?: string;
    conversion_goal_source?: ConversionGoalSource;
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Performance report failed");
  }

  const performance: OrbitPerformanceResponse = {
    report: data.report ?? null,
    workspace_conversion_goal: data.workspace_conversion_goal ?? "",
    conversion_goal_source: data.conversion_goal_source ?? "inferred",
  };
  applyPerformanceToBridge(bridge, performance);
  return performance;
}


export async function emitOrbitAction(
  bridge: OrbitProofOfWorkBridge,
  actionId: string,
  extra?: {
    reflection?: string;
    outcome?: SimulationAction["outcome"];
    context?: Record<string, unknown>;
    appState?: OrbitAppState;
    tapCleared?: boolean;
  }
): Promise<{ bridge: OrbitProofOfWorkBridge; shouldScore: boolean }> {
  const action = getSimulationAction(orbitDemo, actionId);
  if (!action) {
    throw new Error(`Unknown Orbit action: ${actionId}`);
  }

  const appSnapshot = extra?.appState
    ? buildOrbitAppSnapshot(extra.appState, { tapCleared: extra.tapCleared })
    : bridge.lastAppSnapshot;

  const reflection =
    extra?.reflection ??
    (extra?.appState && appSnapshot
      ? buildActionReflection(actionId, extra.appState, appSnapshot)
      : `Completed "${action.label}" in Orbit.`);

  const nextWorld = applySimulationAction(bridge.worldState, action);
  const blockId = matchBlockToStep(bridge.blocks, action);
  const payload = buildSimulationProofOfWorkPayload(orbitDemo, action, {
    sessionId: bridge.sessionId,
    blockId,
    worldState: bridge.worldState,
    reflection,
    outcome: extra?.outcome ?? action.outcome,
    extra: {
      orbit_app_snapshot: appSnapshot,
      ui_context: appSnapshot
        ? {
            view: appSnapshot.view,
            selected_issue: appSnapshot.selected_issue_identifier,
            inbox_unread_count: appSnapshot.inbox_unread_count,
            suggested_next: appSnapshot.suggested_next,
          }
        : undefined,
      ...extra?.context,
    },
  });

  const res = await fetch("/api/demo/proof-of-work", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: bridge.workspaceId,
      type: "tool",
      mime_type: "application/json",
      payload,
      block_id: blockId,
      session_id: bridge.sessionId,
      tool_name: action.kind === "time_simulation" ? orbitDemo.simulatorToolName : orbitDemo.toolName,
      tool_action: action.id,
      file_name: `${action.id}-${(bridge.worldState.actionCounts[action.id] ?? 0) + 1}.json`,
      metadata: {
        source: "partner_integration",
        product: orbitDemo.productName,
        integration: orbitDemo.integrationName,
        category: action.category,
        dimension: action.dimension,
        simulated_days: nextWorld.simulatedDays,
        orbit_view: appSnapshot?.view,
        orbit_inbox_unread: appSnapshot?.inbox_unread_count ?? null,
        orbit_selected_issue: appSnapshot?.selected_issue_identifier ?? null,
        orbit_suggested_next: appSnapshot?.suggested_next ?? [],
      },
    }),
  });

  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Proof-of-work upload failed");
  }

  const nextProofOfWorkCount = bridge.proofOfWorkCount + 1;
  const nextBridge: OrbitProofOfWorkBridge = {
    ...bridge,
    worldState: nextWorld,
    proofOfWorkCount: nextProofOfWorkCount,
    lastAppSnapshot: appSnapshot ?? bridge.lastAppSnapshot,
  };
  saveOrbitBridge(nextBridge);

  const shouldScore =
    action.kind === "proof_of_work" && nextProofOfWorkCount >= 3 && nextProofOfWorkCount % 3 === 0;

  return { bridge: nextBridge, shouldScore };
}