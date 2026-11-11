/**
 * First-class Verification, Calibration, and Solve Flows and Knowledge regions.
 * Dashboard lists these objects; a workspace is Learning only.
 * Flow rows store owner_user_id. workspace_id is optional.
 */

import { parseLearningModelSize } from "@/lib/learning-model";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import {
  parseFlowArtifacts,
  flowProblemFromUnknown,
  flowProblemQuestionPool,
  type FlowArtifact,
} from "@/lib/flow-artifacts";

export type ProductFlowKind = "verification" | "calibration" | "solve";

export const DASHBOARD_FLOWS_PATH = "/api/dashboard/flows";
export const DASHBOARD_FLOWS_GENERATE_PATH = "/api/dashboard/flows/generate-questions";
export const DASHBOARD_FLOW_FILES_PATH = "/api/dashboard/flows/files";

export const PRODUCT_FLOW_WIZARD_STEPS = ["name", "author", "publish"] as const;

export type ProductFlowWizardStep = (typeof PRODUCT_FLOW_WIZARD_STEPS)[number];

export type ProductFlowDraft = {
  kind: ProductFlowKind;
  name: string;
  /** Problem text. Stored as topic. Calibration `goal` is the same string. */
  topic: string;
  goal: string;
  questions: string[];
  artifacts: FlowArtifact[];
  actionCatalog: number;
  durationMinutes: number;
};

export function parseProductFlowKind(value: unknown): ProductFlowKind | null {
  if (value === "verification" || value === "verify") return "verification";
  if (value === "calibration" || value === "calibrate") return "calibration";
  if (value === "solve") return "solve";
  return null;
}

export function productFlowKindFromDashboardKind(
  kind: "verify" | "calibrate" | "solve" | ProductFlowKind,
): ProductFlowKind {
  if (kind === "calibrate" || kind === "calibration") return "calibration";
  if (kind === "solve") return "solve";
  return "verification";
}

export function productFlowNewPath(kind: ProductFlowKind): string {
  if (kind === "calibration") return "/calibration/flows/new";
  if (kind === "solve") return "/solve/flows/new";
  return "/verification/flows/new";
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
  if (kind === "calibration") return `/calibration/flows/${id}`;
  if (kind === "solve") return `/solve/flows/${id}`;
  return `/verification/flows/${id}`;
}

export function productRegionNewPath(kind: ProductFlowKind): string {
  if (kind === "calibration") return "/calibration/regions/new";
  if (kind === "solve") return "/solve/regions/new";
  return "/verification/regions/new";
}

export function productRegionPagePath(kind: ProductFlowKind, regionId: string): string {
  const id = String(regionId || "").trim();
  if (!id) return productRegionNewPath(kind);
  if (kind === "calibration") return `/calibration/regions/${id}`;
  if (kind === "solve") return `/solve/regions/${id}`;
  return `/verification/regions/${id}`;
}

export function productRegionStudioPath(kind: ProductFlowKind, regionId: string): string {
  const id = String(regionId || "").trim();
  const tab =
    kind === "calibration"
      ? "calibration_studio"
      : kind === "solve"
        ? "solve_studio"
        : "verification_studio";
  if (!id) return `/dashboard?tab=${tab}`;
  return `/dashboard?tab=${tab}&region=${encodeURIComponent(id)}`;
}

export function productFlowKindLabel(kind: ProductFlowKind): string {
  if (kind === "calibration") return "Calibration";
  if (kind === "solve") return "Solve";
  return "Verification";
}

export function productFlowOwnerTitle(kind: ProductFlowKind): string {
  return `${productFlowKindLabel(kind)} flows`;
}

export function productFlowEmbeddingKind(
  kind: ProductFlowKind,
): "verify" | "calibrate" | "solve" {
  if (kind === "calibration") return "calibrate";
  if (kind === "solve") return "solve";
  return "verify";
}

export function flowOwnedByUser(
  flow: { ownerUserId?: string | null },
  userId: string,
): boolean {
  const owner = String(flow.ownerUserId || "").trim();
  const user = String(userId || "").trim();
  return Boolean(owner && user && owner === user);
}

export function emptyProductFlowDraft(kind: ProductFlowKind): ProductFlowDraft {
  return {
    kind,
    name: "",
    topic: "",
    goal: "",
    questions: [],
    artifacts: [],
    actionCatalog: 4,
    durationMinutes: 15,
  };
}

export function productFlowProblem(draft: Pick<ProductFlowDraft, "topic" | "goal">): string {
  return flowProblemFromUnknown(draft);
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
  if (step === "author") return Boolean(productFlowProblem(draft));
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
      artifacts: FlowArtifact[];
      actionCatalog: ReturnType<typeof parseLearningModelSize>;
      durationMinutes: number;
    }
  | { ok: false; reason: string };

export function acceptProductFlowPublish(draft: ProductFlowDraft): AcceptedProductFlowPublish {
  const name = normalizeFlowName(draft.name);
  if (!name) return { ok: false, reason: "name_required" };
  const problem = productFlowProblem(draft);
  if (!problem) return { ok: false, reason: "topic_required" };
  const artifacts = parseFlowArtifacts(draft.artifacts);
  const actionCatalog = parseLearningModelSize(draft.actionCatalog);
  const durationMinutes = flowCountdownMinutes(draft.durationMinutes);
  const pool = flowProblemQuestionPool(problem).map((item) => item.text);
  if (draft.kind === "calibration") {
    return {
      ok: true,
      kind: "calibration",
      name,
      topic: problem,
      goal: problem,
      questions: pool,
      artifacts,
      actionCatalog,
      durationMinutes,
    };
  }
  if (draft.kind === "solve") {
    return {
      ok: true,
      kind: "solve",
      name,
      topic: problem,
      goal: "",
      questions: [],
      artifacts,
      actionCatalog,
      durationMinutes,
    };
  }
  return {
    ok: true,
    kind: "verification",
    name,
    topic: problem,
    goal: "",
    questions: pool,
    artifacts,
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
