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
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import {
  OPTIONAL_FLOW_ENFORCED_CHANNELS,
  parseFlowEnforcedChannels,
  serializeFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";

export type ProductFlowKind = "verification" | "calibration" | "solve";

export const PRODUCT_FLOW_KINDS = ["solve", "verification", "calibration"] as const;

export const DASHBOARD_FLOWS_PATH = "/api/dashboard/flows";
export const DASHBOARD_FLOWS_GENERATE_PATH = "/api/dashboard/flows/generate-questions";
export const DASHBOARD_FLOW_FILES_PATH = "/api/dashboard/flows/files";

export const PRODUCT_FLOW_WIZARD_STEPS = ["name", "author", "model", "channels", "publish"] as const;

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
  /** Solve / Verification: seed the Work canvas with this Problem as written. */
  exactProblemOnCanvas: boolean;
  /** Author unsys seed used when a learner runs this flow. */
  answersModelSeed: AuthorUnsysModelSeed | null;
  /** Channels the run requires. Audio off leaves the microphone optional. */
  enforcedChannels: FlowEnforcedChannels;
};

/** Solve and Verification author enforced sensors. Calibration sounding does not. */
export function flowAuthorShowsEnforcedChannels(kind: ProductFlowKind): boolean {
  return kind === "solve" || kind === "verification";
}

export function productFlowWizardSteps(
  kind: ProductFlowKind,
): readonly ProductFlowWizardStep[] {
  if (kind === "calibration") return ["name", "author", "model", "publish"];
  return PRODUCT_FLOW_WIZARD_STEPS;
}

/** Author option on Solve and Verification flows. Calibration has no canvas. */
export function parseExactProblemOnCanvas(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }
  return false;
}

export function flowShowsExactProblemOnCanvas(kind: ProductFlowKind): boolean {
  return kind === "solve" || kind === "verification";
}

/** Verification and Calibration lock the run clock at authoring. Solve has no run countdown. */
export function flowAuthorShowsCountdown(kind: ProductFlowKind): boolean {
  return kind === "verification" || kind === "calibration";
}

export function sessionWantsExactProblemOnCanvas(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return parseExactProblemOnCanvas(
    (metadata as Record<string, unknown>).exactProblemOnCanvas,
  );
}

export function parseProductFlowKind(value: unknown): ProductFlowKind | null {
  if (value === "verification" || value === "verify") return "verification";
  if (value === "calibration" || value === "calibrate") return "calibration";
  if (value === "solve") return "solve";
  return null;
}

export type ProductFlowKindFilter = ProductFlowKind | "all";

export function parseProductFlowKindFilter(value: unknown): ProductFlowKindFilter {
  return parseProductFlowKind(value) ?? "all";
}

export function productFlowKindFromDashboardKind(
  kind: "verify" | "calibrate" | "solve" | ProductFlowKind,
): ProductFlowKind {
  if (kind === "calibrate" || kind === "calibration") return "calibration";
  if (kind === "solve") return "solve";
  return "verification";
}

export function productFlowNewPath(kind?: ProductFlowKind | null): string {
  if (kind === "calibration") return "/calibration/flows/new";
  if (kind === "solve") return "/solve/flows/new";
  if (kind === "verification") return "/verification/flows/new";
  return "/flows/new";
}

export function productFlowDashboardPath(_kind?: ProductFlowKind | null): string {
  return "/dashboard?tab=flows";
}

export function productRegionDashboardPath(_kind?: ProductFlowKind | null): string {
  return "/dashboard?tab=regions";
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

/** Same-origin path for opening a public flow (identification still runs). */
export function flowPublicHref(pathOrUrl: string): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value);
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || value;
    } catch {
      return value;
    }
  }
  return value.startsWith("/") ? value : `/${value}`;
}

export function productFlowPagePath(kind: ProductFlowKind, flowId: string): string {
  const id = String(flowId || "").trim();
  if (!id) return productFlowNewPath(kind);
  if (kind === "calibration") return `/calibration/flows/${id}`;
  if (kind === "solve") return `/solve/flows/${id}`;
  return `/verification/flows/${id}`;
}

export function productRegionNewPath(kind?: ProductFlowKind | null): string {
  if (kind === "calibration") return "/calibration/regions/new";
  if (kind === "solve") return "/solve/regions/new";
  if (kind === "verification") return "/verification/regions/new";
  return "/regions/new";
}

export function productRegionPagePath(kind: ProductFlowKind, regionId: string): string {
  const id = String(regionId || "").trim();
  if (!id) return productRegionNewPath(kind);
  if (kind === "calibration") return `/calibration/regions/${id}`;
  if (kind === "solve") return `/solve/regions/${id}`;
  return `/verification/regions/${id}`;
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
    exactProblemOnCanvas: false,
    answersModelSeed: null,
    enforcedChannels: flowAuthorShowsEnforcedChannels(kind)
      ? parseFlowEnforcedChannels(null)
      : { ...OPTIONAL_FLOW_ENFORCED_CHANNELS },
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
  if (step === "model") return Boolean(productFlowProblem(draft));
  if (step === "channels") return Boolean(productFlowProblem(draft));
  return Boolean(normalizeFlowName(draft.name));
}

export function nextProductFlowWizardStep(
  step: ProductFlowWizardStep,
  kind?: ProductFlowKind,
): ProductFlowWizardStep {
  if (step === "name") return "author";
  if (step === "author") return "model";
  if (step === "model") return kind === "calibration" ? "publish" : "channels";
  return "publish";
}

export function previousProductFlowWizardStep(
  step: ProductFlowWizardStep,
  kind?: ProductFlowKind,
): ProductFlowWizardStep {
  if (step === "publish") return kind === "calibration" ? "model" : "channels";
  if (step === "channels") return "model";
  if (step === "model") return "author";
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
      exactProblemOnCanvas: boolean;
      answersModelSeed: AuthorUnsysModelSeed | null;
      enforcedChannels: FlowEnforcedChannels;
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
  const exactProblemOnCanvas = flowShowsExactProblemOnCanvas(draft.kind)
    ? parseExactProblemOnCanvas(draft.exactProblemOnCanvas)
    : false;
  const answersModelSeed = parseFlowUnsysSeed(draft.answersModelSeed);
  const enforcedChannels = flowAuthorShowsEnforcedChannels(draft.kind)
    ? serializeFlowEnforcedChannels(draft.enforcedChannels)
    : { ...OPTIONAL_FLOW_ENFORCED_CHANNELS };
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
      exactProblemOnCanvas: false,
      answersModelSeed,
      enforcedChannels,
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
      exactProblemOnCanvas,
      answersModelSeed,
      enforcedChannels,
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
    exactProblemOnCanvas,
    answersModelSeed,
    enforcedChannels,
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
