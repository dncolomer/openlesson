import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import { orbitDemo } from "./demos/orbit";
import type { DemoWorkspaceBlock } from "./types";
import {
  applySimulationAction,
  buildSimulationEvidencePayload,
  createInitialWorldState,
  matchBlockToStep,
} from "./simulation";
import type { SimulationAction, SimulationWorldState } from "./types";
import { getSimulationAction } from "./simulation";

export const ORBIT_BRIDGE_STORAGE_KEY = "orbit-evidence-bridge";

export type OrbitEvidenceBridge = {
  planId: string;
  sessionId: string;
  demoId: string;
  blocks: DemoWorkspaceBlock[];
  worldState: SimulationWorldState;
  evidenceCount: number;
};

export type OrbitLaunchParams = {
  planId: string;
  sessionId: string;
  demoId?: string;
};

export function buildOrbitLaunchUrl(params: OrbitLaunchParams, origin = ""): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const search = new URLSearchParams({
    planId: params.planId,
    sessionId: params.sessionId,
    demoId: params.demoId ?? orbitDemo.id,
  });
  return `${base}/demo-app?${search.toString()}`;
}

export function parseOrbitLaunchParams(search: string): OrbitLaunchParams | null {
  const params = new URLSearchParams(search);
  const planId = params.get("planId");
  const sessionId = params.get("sessionId");
  if (!planId || !sessionId) return null;
  return {
    planId,
    sessionId,
    demoId: params.get("demoId") ?? orbitDemo.id,
  };
}

export function loadOrbitBridge(): OrbitEvidenceBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORBIT_BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrbitEvidenceBridge;
    if (!parsed.planId || !parsed.sessionId) return null;
    return {
      ...parsed,
      worldState: parsed.worldState ?? createInitialWorldState(),
      evidenceCount: parsed.evidenceCount ?? 0,
      blocks: parsed.blocks ?? [],
    };
  } catch {
    return null;
  }
}

export function saveOrbitBridge(bridge: OrbitEvidenceBridge): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORBIT_BRIDGE_STORAGE_KEY, JSON.stringify(bridge));
}

export function initOrbitBridge(params: OrbitLaunchParams, blocks: DemoWorkspaceBlock[] = []): OrbitEvidenceBridge {
  const existing = loadOrbitBridge();
  if (existing && existing.planId === params.planId) {
    return existing;
  }
  const bridge: OrbitEvidenceBridge = {
    planId: params.planId,
    sessionId: params.sessionId,
    demoId: params.demoId ?? orbitDemo.id,
    blocks,
    worldState: createInitialWorldState(),
    evidenceCount: 0,
  };
  saveOrbitBridge(bridge);
  return bridge;
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function emitOrbitAction(
  bridge: OrbitEvidenceBridge,
  actionId: string,
  extra?: { reflection?: string; outcome?: SimulationAction["outcome"]; context?: Record<string, unknown> }
): Promise<{ bridge: OrbitEvidenceBridge; shouldScore: boolean }> {
  const action = getSimulationAction(orbitDemo, actionId);
  if (!action) {
    throw new Error(`Unknown Orbit action: ${actionId}`);
  }

  const nextWorld = applySimulationAction(bridge.worldState, action);
  const blockId = matchBlockToStep(bridge.blocks, action);
  const payload = buildSimulationEvidencePayload(orbitDemo, action, {
    sessionId: bridge.sessionId,
    blockId,
    worldState: bridge.worldState,
    reflection: extra?.reflection ?? `Completed "${action.label}" in Orbit.`,
    outcome: extra?.outcome ?? action.outcome,
    extra: extra?.context,
  });

  const res = await fetch("/api/evidence-api-demo/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId: bridge.planId,
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
      },
    }),
  });

  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Evidence upload failed");
  }

  const nextEvidenceCount = bridge.evidenceCount + 1;
  const nextBridge: OrbitEvidenceBridge = {
    ...bridge,
    worldState: nextWorld,
    evidenceCount: nextEvidenceCount,
  };
  saveOrbitBridge(nextBridge);

  const shouldScore =
    action.kind === "evidence" && nextEvidenceCount >= 3 && nextEvidenceCount % 3 === 0;

  return { bridge: nextBridge, shouldScore };
}

export async function fetchOrbitScorecard(
  bridge: OrbitEvidenceBridge
): Promise<PerformanceReport | null> {
  const res = await fetch("/api/evidence-api-demo/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: bridge.planId }),
  });
  const data = await readJsonResponse<{
    report?: PerformanceReport;
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Performance report failed");
  }
  return data.report ?? null;
}