/**
 * First-class Verification and Calibration Flows and Knowledge regions.
 * Dashboard lists these objects; a workspace is Learning only.
 * Internal owner containers may still store workspace_id.
 */

import { parseLearningModelSize } from "@/lib/learning-model";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import {
  WORKSPACE_KIND_CALIBRATION,
  WORKSPACE_KIND_KNOWLEDGE_REGION,
  type WorkspaceKind,
} from "@/lib/workspace-kind";

export type ProductFlowKind = "verification" | "calibration";

export const DASHBOARD_FLOWS_PATH = "/api/dashboard/flows";
export const DASHBOARD_FLOWS_GENERATE_PATH = "/api/dashboard/flows/generate-questions";

export const PRODUCT_FLOW_WIZARD_STEPS = ["name", "author", "publish"] as const;

export type ProductFlowWizardStep = (typeof PRODUCT_FLOW_WIZARD_STEPS)[number];

export type ProductFlowDraft = {
  kind: ProductFlowKind;
  name: string;
  topic: string;
  goal: string;
  questions: string[];
  actionCatalog: number;
  durationMinutes: number;
};

export function parseProductFlowKind(value: unknown): ProductFlowKind | null {
  if (value === "verification" || value === "verify") return "verification";
  if (value === "calibration" || value === "calibrate") return "calibration";
  return null;
}

export function productFlowKindFromDashboardKind(
  kind: "verify" | "calibrate" | ProductFlowKind,
): ProductFlowKind {
  if (kind === "calibrate" || kind === "calibration") return "calibration";
  return "verification";
}

export function productFlowNewPath(kind: ProductFlowKind): string {
  return kind === "calibration" ? "/calibration/flows/new" : "/verification/flows/new";
}

export function productFlowDashboardPath(kind: ProductFlowKind): string {
  return `/dashboard?tab=${kind}`;
}

/** Public run URL for clipboard copy. Paths become origin + path. */
export function absoluteFlowPublicUrl(pathOrUrl: string, origin: string): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  const base = String(origin || "").replace(/\/$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
}

export function productFlowPagePath(kind: ProductFlowKind, flowId: string): string {
  const id = String(flowId || "").trim();
  if (!id) return productFlowNewPath(kind);
  return kind === "calibration" ? `/calibration/flows/${id}` : `/verification/flows/${id}`;
}

export function productRegionNewPath(kind: ProductFlowKind): string {
  return kind === "calibration" ? "/calibration/regions/new" : "/verification/regions/new";
}

export function productRegionPagePath(kind: ProductFlowKind, regionId: string): string {
  const id = String(regionId || "").trim();
  if (!id) return productRegionNewPath(kind);
  return kind === "calibration" ? `/calibration/regions/${id}` : `/verification/regions/${id}`;
}

export function productFlowOwnerWorkspaceKind(kind: ProductFlowKind): WorkspaceKind {
  return kind === "calibration" ? WORKSPACE_KIND_CALIBRATION : WORKSPACE_KIND_KNOWLEDGE_REGION;
}

export function productFlowOwnerTitle(kind: ProductFlowKind): string {
  return kind === "calibration" ? "Calibration flows" : "Verification flows";
}

export function emptyProductFlowDraft(kind: ProductFlowKind): ProductFlowDraft {
  return {
    kind,
    name: "",
    topic: "",
    goal: "",
    questions: [""],
    actionCatalog: 4,
    durationMinutes: 15,
  };
}

export function normalizeFlowName(raw: unknown, fallback?: unknown): string {
  const name = String(raw ?? "").trim();
  if (name) return name.slice(0, 160);
  const fb = String(fallback ?? "").trim();
  return fb ? fb.slice(0, 160) : "";
}

export function flowDisplayName(flow: {
  name?: unknown;
  topic?: unknown;
  goal?: unknown;
  title?: unknown;
}): string {
  return (
    normalizeFlowName(flow.name) ||
    normalizeFlowName(flow.title) ||
    normalizeFlowName(flow.topic) ||
    normalizeFlowName(flow.goal) ||
    "Untitled flow"
  );
}

export function productFlowQuestionsFromDraft(questions: unknown): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function productFlowWizardCanAdvance(
  step: ProductFlowWizardStep,
  draft: ProductFlowDraft,
): boolean {
  if (step === "name") return Boolean(normalizeFlowName(draft.name));
  if (step === "author") {
    if (draft.kind === "calibration") {
      return Boolean(String(draft.goal || "").trim()) && productFlowQuestionsFromDraft(draft.questions).length > 0;
    }
    return Boolean(String(draft.topic || "").trim());
  }
  return Boolean(normalizeFlowName(draft.name));
}

export function nextProductFlowWizardStep(
  step: ProductFlowWizardStep,
): ProductFlowWizardStep {
  if (step === "name") return "author";
  return "publish";
}

export function previousProductFlowWizardStep(
  step: ProductFlowWizardStep,
): ProductFlowWizardStep {
  if (step === "publish") return "author";
  return "name";
}

export type AcceptedProductFlowPublish =
  | {
      ok: true;
      kind: ProductFlowKind;
      name: string;
      topic: string;
      goal: string;
      questions: string[];
      actionCatalog: ReturnType<typeof parseLearningModelSize>;
      durationMinutes: number;
    }
  | { ok: false; reason: string };

export function acceptProductFlowPublish(draft: ProductFlowDraft): AcceptedProductFlowPublish {
  const name = normalizeFlowName(draft.name);
  if (!name) return { ok: false, reason: "name_required" };
  const questions = productFlowQuestionsFromDraft(draft.questions);
  const actionCatalog = parseLearningModelSize(draft.actionCatalog);
  const durationMinutes = flowCountdownMinutes(draft.durationMinutes);
  if (draft.kind === "calibration") {
    const goal = String(draft.goal || "").trim();
    if (!goal) return { ok: false, reason: "goal_required" };
    if (questions.length === 0) return { ok: false, reason: "questions_required" };
    return {
      ok: true,
      kind: "calibration",
      name,
      topic: "",
      goal,
      questions,
      actionCatalog,
      durationMinutes,
    };
  }
  const topic = String(draft.topic || "").trim();
  if (!topic) return { ok: false, reason: "topic_required" };
  return {
    ok: true,
    kind: "verification",
    name,
    topic,
    goal: "",
    questions,
    actionCatalog,
    durationMinutes,
  };
}

export function knowledgeRegionCreateOffersFlowSelect(flowCount: number): {
  canSelectExistingFlow: boolean;
  needsCreateFlowFirst: boolean;
} {
  const count = Number.isFinite(flowCount) ? Math.max(0, Math.floor(flowCount)) : 0;
  return {
    canSelectExistingFlow: count > 0,
    needsCreateFlowFirst: count === 0,
  };
}
