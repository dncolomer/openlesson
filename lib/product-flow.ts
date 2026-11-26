/**
 * Embeddable Knowledge Verification Protocols and Knowledge Regions.
 * Dashboard lists these objects; a workspace is Learning only.
 * Protocol rows store owner_user_id. workspace_id is optional.
 * Stored topic column is The Protocol Challenge.
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
  parseFlowEnforcedChannels,
  serializeFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  DEFAULT_FLOW_CANVAS_CAPTURE,
  serializeFlowCanvasCapture,
  type FlowCanvasCapture,
} from "@/lib/flow-canvas-capture";
import {
  flowOpeningCanvasHasContent,
  parseFlowOpeningCanvasScene,
  productFlowPublishTopicFromOpeningCanvas,
} from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";

export const PROTOCOL_PRODUCT_NAME = "Embeddable Knowledge Verification Protocols" as const;
export const PROTOCOL_CHALLENGE_LABEL = "The Protocol Challenge" as const;
export const PROTOCOL_LABEL = "Protocol" as const;

export const DASHBOARD_PROTOCOLS_PATH = "/api/dashboard/protocols";
export const DASHBOARD_FLOWS_PATH = DASHBOARD_PROTOCOLS_PATH;
export const DASHBOARD_FLOWS_GENERATE_PATH = "/api/dashboard/protocols/generate-questions";
export const DASHBOARD_FLOW_FILES_PATH = "/api/dashboard/protocols/files";
/** Client-safe path. Do not import `@/lib/flow-problem-generate` from client components. */
export const DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH =
  "/api/dashboard/protocols/generate-problem";

export const PRODUCT_FLOW_WIZARD_STEPS = ["name", "author", "model", "channels", "publish"] as const;

export type ProductFlowWizardStep = (typeof PRODUCT_FLOW_WIZARD_STEPS)[number];

export type ProtocolDraft = {
  name: string;
  /** The Protocol Challenge. Stored as topic. */
  challenge: string;
  artifacts: FlowArtifact[];
  actionCatalog: number;
  durationMinutes: number;
  exactProblemOnCanvas: boolean;
  openingCanvasScene: IleWorkCanvasScene | null;
  generateProblemOnOpen: boolean;
  answersModelSeed: AuthorUnsysModelSeed | null;
  enforcedChannels: FlowEnforcedChannels;
  canvasCapture: FlowCanvasCapture;
};

/** @deprecated Use ProtocolDraft. */
export type ProductFlowDraft = ProtocolDraft & {
  topic: string;
  goal: string;
  questions: string[];
};

export function flowAuthorShowsEnforcedChannels(_kind?: unknown): boolean {
  return true;
}

export function productFlowWizardSteps(_kind?: unknown): readonly ProductFlowWizardStep[] {
  return PRODUCT_FLOW_WIZARD_STEPS;
}

export function parseExactProblemOnCanvas(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }
  return false;
}

export function flowShowsExactProblemOnCanvas(_kind?: unknown): boolean {
  return true;
}

export function parseGenerateProblemOnOpen(value: unknown): boolean {
  return parseExactProblemOnCanvas(value);
}

/** Exclusive Author source. Exact problem on canvas is only valid on `problem`. */
export type FlowAuthoringSource = "problem" | "artifacts" | "canvas";

export function protocolChallengeFromUnknown(input: {
  challenge?: unknown;
  topic?: unknown;
  problem?: unknown;
  goal?: unknown;
}): string {
  const challenge = String(input.challenge ?? "").trim();
  if (challenge) return challenge;
  return flowProblemFromUnknown(input);
}

export function flowAuthoringSource(input: {
  kind?: unknown;
  challenge?: string | null;
  topic?: string | null;
  problem?: string | null;
  generateProblemOnOpen?: unknown;
  artifacts?: unknown;
  openingCanvasScene?: unknown;
}): FlowAuthoringSource {
  if (flowOpeningCanvasHasContent(parseFlowOpeningCanvasScene(input.openingCanvasScene))) {
    return "canvas";
  }
  if (
    parseGenerateProblemOnOpen(input.generateProblemOnOpen) &&
    parseFlowArtifacts(input.artifacts).length > 0
  ) {
    return "artifacts";
  }
  return "problem";
}

export function flowAuthoringAllowsExactProblem(input: {
  kind?: unknown;
  challenge?: string | null;
  topic?: string | null;
  problem?: string | null;
  generateProblemOnOpen?: unknown;
  artifacts?: unknown;
  openingCanvasScene?: unknown;
}): boolean {
  if (flowAuthoringSource(input) !== "problem") return false;
  return Boolean(protocolChallengeFromUnknown(input));
}

export function flowAuthorShowsCountdown(_kind?: unknown): boolean {
  return true;
}

export function sessionWantsExactProblemOnCanvas(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return parseExactProblemOnCanvas(
    (metadata as Record<string, unknown>).exactProblemOnCanvas,
  );
}

/** Other protocol types are gone. Callers must not send a kind. */
/** Residual. Protocol is the only product; callers must not send a kind. */
export type ProductFlowKind = "verification";

export function parseProductFlowKind(value: unknown): null {
  void value;
  return null;
}

export function rejectedProtocolKind(value: unknown): boolean {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    raw === "solve" ||
    raw === "calibration" ||
    raw === "calibrate" ||
    raw === "learn" ||
    raw === "mapping" ||
    raw === "map"
  );
}

export function productFlowNewPath(_kind?: unknown): string {
  return "/protocols/new";
}

export function productFlowDashboardPath(_kind?: unknown): string {
  return "/dashboard?tab=protocols";
}

export function productRegionDashboardPath(_kind?: unknown): string {
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

/** Same-origin path for opening a public protocol (identification still runs). */
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

export function productFlowPagePath(_kind: unknown, flowId?: string): string {
  const id = String(flowId || _kind || "").trim();
  if (!id || id === "verification" || id === "solve" || id === "calibration") {
    return productFlowNewPath();
  }
  return `/protocols/${id}`;
}

export function productRegionNewPath(_kind?: unknown): string {
  return "/regions/new";
}

export function productRegionPagePath(_kind: unknown, regionId?: string): string {
  const id = String(regionId || _kind || "").trim();
  if (!id || id === "verification" || id === "solve" || id === "calibration") {
    return productRegionNewPath();
  }
  return `/regions/${id}`;
}

export function productRegionEditPath(kindOrId: unknown, regionId?: string): string {
  const page = productRegionPagePath(kindOrId, regionId);
  return page.endsWith("/new") ? page : `${page}/edit`;
}

export function productFlowKindLabel(_kind?: unknown): string {
  return PROTOCOL_LABEL;
}

export function productFlowOwnerTitle(_kind?: unknown): string {
  return "Protocols";
}

export function productFlowEmbeddingKind(_kind?: unknown): "verify" {
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

export function emptyProtocolDraft(): ProtocolDraft {
  return {
    name: "",
    challenge: "",
    artifacts: [],
    actionCatalog: 4,
    durationMinutes: 15,
    exactProblemOnCanvas: false,
    openingCanvasScene: null,
    generateProblemOnOpen: false,
    answersModelSeed: null,
    enforcedChannels: parseFlowEnforcedChannels(null),
    canvasCapture: { ...DEFAULT_FLOW_CANVAS_CAPTURE },
  };
}

export function emptyProductFlowDraft(_kind?: unknown): ProductFlowDraft {
  const draft = emptyProtocolDraft();
  return {
    ...draft,
    topic: draft.challenge,
    goal: draft.challenge,
    questions: [],
  };
}

export function productFlowProblem(
  draft: Pick<ProtocolDraft, "challenge"> | { topic?: string; goal?: string; challenge?: string },
): string {
  return protocolChallengeFromUnknown(draft);
}

export function normalizeFlowName(raw: unknown, fallback?: unknown): string {
  const name = String(raw ?? "").trim();
  if (name) return name.slice(0, 160);
  const fb = String(fallback ?? "").trim();
  return fb ? fb.slice(0, 160) : "";
}

export function flowDisplayName(flow: {
  name?: unknown;
  challenge?: unknown;
  topic?: unknown;
  goal?: unknown;
  title?: unknown;
}): string {
  return (
    normalizeFlowName(flow.name) ||
    normalizeFlowName(flow.title) ||
    normalizeFlowName(flow.challenge) ||
    normalizeFlowName(flow.topic) ||
    normalizeFlowName(flow.goal) ||
    "Untitled protocol"
  );
}

export function productFlowQuestionsFromDraft(questions: unknown): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function productFlowAuthorHasMaterial(
  draft: ProtocolDraft | ProductFlowDraft,
): boolean {
  if (productFlowProblem(draft)) return true;
  if (flowOpeningCanvasHasContent(draft.openingCanvasScene)) return true;
  return (
    parseGenerateProblemOnOpen(draft.generateProblemOnOpen) && draft.artifacts.length > 0
  );
}

export function productFlowWizardCanAdvance(
  step: ProductFlowWizardStep,
  draft: ProtocolDraft | ProductFlowDraft,
): boolean {
  if (step === "name") return Boolean(normalizeFlowName(draft.name));
  if (step === "author") return productFlowAuthorHasMaterial(draft);
  if (step === "model") return productFlowAuthorHasMaterial(draft);
  if (step === "channels") return productFlowAuthorHasMaterial(draft);
  return Boolean(normalizeFlowName(draft.name));
}

export function nextProductFlowWizardStep(
  step: ProductFlowWizardStep,
  _kind?: unknown,
): ProductFlowWizardStep {
  if (step === "name") return "author";
  if (step === "author") return "model";
  if (step === "model") return "channels";
  return "publish";
}

export function previousProductFlowWizardStep(
  step: ProductFlowWizardStep,
  _kind?: unknown,
): ProductFlowWizardStep {
  if (step === "publish") return "channels";
  if (step === "channels") return "model";
  if (step === "model") return "author";
  return "name";
}

export type AcceptedProtocolPublish =
  | {
      ok: true;
      name: string;
      challenge: string;
      questions: string[];
      artifacts: FlowArtifact[];
      actionCatalog: ReturnType<typeof parseLearningModelSize>;
      durationMinutes: number;
      exactProblemOnCanvas: boolean;
      openingCanvasScene: IleWorkCanvasScene | null;
      generateProblemOnOpen: boolean;
      answersModelSeed: AuthorUnsysModelSeed | null;
      enforcedChannels: FlowEnforcedChannels;
      canvasCapture: FlowCanvasCapture;
    }
  | { ok: false; reason: string };

/** @deprecated Use AcceptedProtocolPublish. */
export type AcceptedProductFlowPublish =
  | (Extract<AcceptedProtocolPublish, { ok: true }> & {
      topic: string;
      goal: string;
    })
  | { ok: false; reason: string };

export function acceptProtocolPublish(
  draft: ProtocolDraft | ProductFlowDraft,
): AcceptedProtocolPublish {
  const name = normalizeFlowName(draft.name);
  if (!name) return { ok: false, reason: "name_required" };
  const openingCanvasScene = parseFlowOpeningCanvasScene(draft.openingCanvasScene);
  const artifacts = parseFlowArtifacts(draft.artifacts);
  const generateProblemOnOpen =
    artifacts.length > 0 &&
    (parseGenerateProblemOnOpen(draft.generateProblemOnOpen) ||
      (!productFlowProblem(draft) && !flowOpeningCanvasHasContent(openingCanvasScene)));
  const challenge =
    productFlowPublishTopicFromOpeningCanvas({
      problem: productFlowProblem(draft),
      name,
      scene: openingCanvasScene,
    }) || (generateProblemOnOpen ? name : "");
  if (!challenge) return { ok: false, reason: "challenge_required" };
  const actionCatalog = parseLearningModelSize(draft.actionCatalog);
  const durationMinutes = flowCountdownMinutes(draft.durationMinutes);
  const pool = flowProblemQuestionPool(challenge).map((item) => item.text);
  const source = flowAuthoringSource({
    challenge,
    topic: productFlowProblem(draft),
    problem: productFlowProblem(draft),
    generateProblemOnOpen,
    artifacts,
    openingCanvasScene,
  });
  const persistGenerate = source === "artifacts";
  const persistScene = source === "canvas" ? openingCanvasScene : null;
  const exactProblemOnCanvas =
    source === "problem" &&
    flowAuthoringAllowsExactProblem({
      challenge,
      topic: productFlowProblem(draft),
      problem: productFlowProblem(draft),
      generateProblemOnOpen: false,
      artifacts,
      openingCanvasScene: null,
    }) &&
    parseExactProblemOnCanvas(draft.exactProblemOnCanvas);
  const answersModelSeed = parseFlowUnsysSeed(draft.answersModelSeed);
  const enforcedChannels = serializeFlowEnforcedChannels(draft.enforcedChannels);
  const canvasCapture = serializeFlowCanvasCapture(draft.canvasCapture);
  return {
    ok: true,
    name,
    challenge,
    questions: pool,
    artifacts,
    actionCatalog,
    durationMinutes,
    exactProblemOnCanvas,
    openingCanvasScene: persistScene,
    generateProblemOnOpen: persistGenerate,
    answersModelSeed,
    enforcedChannels,
    canvasCapture,
  };
}

export function acceptProductFlowPublish(
  draft: ProtocolDraft | ProductFlowDraft,
): AcceptedProductFlowPublish {
  const accepted = acceptProtocolPublish(draft);
  if (!accepted.ok) {
    if (accepted.reason === "challenge_required") return { ok: false, reason: "topic_required" };
    return accepted;
  }
  return {
    ...accepted,
    topic: accepted.challenge,
    goal: accepted.challenge,
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
