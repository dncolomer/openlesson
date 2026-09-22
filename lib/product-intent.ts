/**
 * Product intent framing for learner/owner surfaces.
 * Technical products remain ILE/TAP in code; UI speaks Work / Drill / Scout.
 *
 * New launches are always the With AI path:
 * - Explore always → ILE learning
 * - Drill always → TAP conversational
 *
 * Solo / exercise / project second-axis tokens are accepted on read so stored
 * guest tokens still classify, but they no longer produce a distinct new-launch
 * target. Legacy open_ended_* / timed_* ids are accepted on read for stored rows.
 */

/** What the learner wants to do. */
export type LearningStyle = "explore" | "drill" | "scout";

/**
 * Second product axis: Dialog (LLM-powered conversation) vs Solo Exercise.
 * Replaces the old Open-ended/Timed authoring axis.
 */
export type PracticeModality = "dialog" | "solo";

/**
 * @deprecated Use PracticeModality. Kept for backward-compatible type imports.
 * open_ended ≈ dialog (no clock framing); timed ≈ solo duration on TAP.
 */
export type SessionHorizon = "open_ended" | "timed";

export type ProductIntent = {
  style: LearningStyle;
  modality: PracticeModality;
  /**
   * @deprecated Prefer modality. Mirrored for legacy callers that still
   * pass horizon; dialog→open_ended, solo→timed when derived.
   */
  horizon?: SessionHorizon;
};

/** Technical launch target (code/API identifiers — not user-facing). */
export type TechnicalProductKind = "ile" | "tap";

export type IleSessionModeTech = "learning" | "project";
export type TapInteractionKindTech = "conversational" | "exercise" | "scout";

/** Canonical product intent ids (new Dialog/Solo axes). */
export type ProductIntentId =
  | "explore_dialog"
  | "explore_solo"
  | "drill_dialog"
  | "drill_solo"
  | "scout_dialog";

/** Legacy ids still present in stored portal configs / guest-link metadata. */
export type LegacyProductIntentId =
  | "open_ended_explore"
  | "open_ended_drill"
  | "timed_explore"
  | "timed_drill";

export type ProductLaunchTarget = {
  product: TechnicalProductKind;
  /** ILE only */
  session_mode?: IleSessionModeTech;
  /** TAP only */
  interaction_kind?: TapInteractionKindTech;
  /** Stable id for data attributes / tests (canonical Dialog/Solo ids). */
  id: ProductIntentId;
};

/** Human labels used on workspace + settings (English defaults; i18n keys mirror these). */
export const PRODUCT_INTENT_LABELS = {
  styleExplore: "Learn",
  styleDrill: "Drill / Practice",
  styleScout: "Prepare",
  /** LLM-powered dialog practice (user-facing: "With AI"). */
  modalityDialog: "With AI",
  /** Solo exercise practice (user-facing: "Solo"). */
  modalitySolo: "Solo",
  /** @deprecated Prefer modalityDialog */
  horizonOpen: "With AI",
  /** @deprecated Prefer modalitySolo */
  horizonTimed: "Solo",
  exploreDialog: "Learn",
  exploreSolo: "Learn",
  drillDialog: "Drill",
  drillSolo: "Drill",
  scoutDialog: "Prepare",
  /** Legacy label keys — map to new names so old i18n/UI still resolve. */
  openEndedExplore: "Explore",
  openEndedDrill: "Explore",
  timedExplore: "Drill",
  timedDrill: "Drill",
  exploreDialogHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  exploreSoloHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  drillDialogHint:
    "Timed dialogue demonstration of what you know.",
  drillSoloHint:
    "Timed dialogue demonstration of what you know.",
  scoutDialogHint:
    "Timed mind-map prepare: follow-up questions, no speaking.",
  openEndedExploreHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  openEndedDrillHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  timedExploreHint:
    "Timed dialogue demonstration of what you know.",
  timedDrillHint:
    "Timed dialogue demonstration of what you know.",
  chooseStyle: "What do you want to do?",
  chooseModality: "How do you want to practice?",
  chooseHorizon: "How do you want to practice?",
  questionExplore: "Do you want to Learn?",
  questionDrill: "Do you want to Drill / Practice?",
  questionScout: "Do you want to Prepare?",
  questionDialog: "With AI?",
  questionSolo: "With AI?",
  questionOpen: "With AI?",
  questionTimed: "With AI?",
} as const;

export const PRODUCT_INTENT_DEFAULT: ProductIntent = {
  style: "explore",
  modality: "dialog",
  horizon: "open_ended",
};

/** Map legacy open_ended/timed tokens → PracticeModality. */
export function normalizePracticeModality(raw: unknown): PracticeModality {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    s === "solo" ||
    s === "exercise" ||
    s === "solo_exercise" ||
    s === "timed" ||
    s === "timer" ||
    s === "timed_run" ||
    s === "project"
  ) {
    return "solo";
  }
  // dialog, conversational, open_ended, open-ended, learning, empty → dialog
  return "dialog";
}

/** Map PracticeModality → legacy SessionHorizon for callers still on horizon. */
export function modalityToLegacyHorizon(modality: PracticeModality): SessionHorizon {
  return modality === "solo" ? "timed" : "open_ended";
}

/** Map legacy horizon → modality. */
export function legacyHorizonToModality(horizon: unknown): PracticeModality {
  return normalizePracticeModality(horizon);
}

/** New-launch Explore target (ILE learning). */
export function exploreLearningLaunchTarget(): ProductLaunchTarget {
  return {
    id: "explore_dialog",
    product: "ile",
    session_mode: "learning",
  };
}

/** New-launch Drill target (TAP conversational). */
export function drillConversationalLaunchTarget(): ProductLaunchTarget {
  return {
    id: "drill_dialog",
    product: "tap",
    interaction_kind: "conversational",
  };
}

/** New-launch Scout target (TAP-shaped, no think-aloud). */
export function scoutDialogLaunchTarget(): ProductLaunchTarget {
  return {
    id: "scout_dialog",
    product: "tap",
    interaction_kind: "scout",
  };
}

/**
 * Stored ILE project / TAP exercise targets — not offered as new launches.
 * Used only to classify already-issued guest tokens.
 */
export function storedExploreProjectLaunchTarget(): ProductLaunchTarget {
  return {
    id: "explore_solo",
    product: "ile",
    session_mode: "project",
  };
}

export function storedDrillExerciseLaunchTarget(): ProductLaunchTarget {
  return {
    id: "drill_solo",
    product: "tap",
    interaction_kind: "exercise",
  };
}

/**
 * Canonical resolve for NEW launches: Explore|Drill → technical launch.
 *
 * Drill always TAP conversational; Explore always ILE learning.
 * Second-arg tokens (solo|exercise|project|timed|dialog|…) are accepted so
 * callers keep compiling, but they no longer produce a distinct target.
 *
 * Defaults missing/invalid style → explore.
 */
export function resolveProductIntent(
  style: unknown,
  _modalityOrHorizon?: unknown,
): ProductLaunchTarget {
  if (style === "scout" || style === "scouting") {
    return scoutDialogLaunchTarget();
  }
  const s: LearningStyle =
    style === "drill" || style === "practice" || style === "project"
      ? "drill"
      : "explore";
  if (s === "explore") return exploreLearningLaunchTarget();
  return drillConversationalLaunchTarget();
}

/** Resolve from a full intent object (supports modality or legacy horizon). */
export function resolveProductIntentFromAxes(
  intent: Partial<ProductIntent> | null | undefined,
): ProductLaunchTarget {
  const modality =
    intent?.modality ??
    (intent?.horizon != null
      ? legacyHorizonToModality(intent.horizon)
      : PRODUCT_INTENT_DEFAULT.modality);
  return resolveProductIntent(
    intent?.style ?? PRODUCT_INTENT_DEFAULT.style,
    modality,
  );
}

/**
 * UI launch: Explore|Drill. The solo flag is ignored — new work is always With AI.
 */
export function resolveLaunchFromStyleAndModality(
  style: unknown,
  _soloEnabled?: boolean,
): ProductLaunchTarget {
  return resolveProductIntent(style, "dialog");
}

/**
 * @deprecated Prefer resolveLaunchFromStyleAndModality.
 * timeboxEnabled true was timed (TAP); false was open-ended (ILE) — that product
 * matrix is retired. Maps true→solo, false→dialog under the new axes so callers
 * that still pass a "second axis boolean" keep compiling while Drill→TAP / Explore→ILE.
 */
export function resolveLaunchFromStyleAndTimebox(
  style: unknown,
  timeboxEnabled: boolean,
): ProductLaunchTarget {
  return resolveLaunchFromStyleAndModality(style, timeboxEnabled);
}

/** Display cluster label for a technical launch target. */
export function productIntentClusterLabel(target: ProductLaunchTarget): string {
  switch (target.id) {
    case "explore_dialog":
      return PRODUCT_INTENT_LABELS.exploreDialog;
    case "explore_solo":
      return PRODUCT_INTENT_LABELS.exploreSolo;
    case "drill_dialog":
      return PRODUCT_INTENT_LABELS.drillDialog;
    case "drill_solo":
      return PRODUCT_INTENT_LABELS.drillSolo;
    case "scout_dialog":
      return PRODUCT_INTENT_LABELS.scoutDialog;
    default:
      return PRODUCT_INTENT_LABELS.exploreDialog;
  }
}

export function productIntentClusterHint(target: ProductLaunchTarget): string {
  switch (target.id) {
    case "explore_dialog":
      return PRODUCT_INTENT_LABELS.exploreDialogHint;
    case "explore_solo":
      return PRODUCT_INTENT_LABELS.exploreSoloHint;
    case "drill_dialog":
      return PRODUCT_INTENT_LABELS.drillDialogHint;
    case "drill_solo":
      return PRODUCT_INTENT_LABELS.drillSoloHint;
    case "scout_dialog":
      return PRODUCT_INTENT_LABELS.scoutDialogHint;
    default:
      return PRODUCT_INTENT_LABELS.exploreDialogHint;
  }
}

/**
 * Infer intent cluster from guest-link row technical fields.
 * Used for browse badges without saying TAP/ILE.
 * Classification is by technical product + mode (not stored horizon labels).
 */
export function productIntentFromGuestLink(input: {
  kind?: "tap" | "ile" | string | null;
  session_mode?: string | null;
  interaction_kind?: string | null;
}): ProductLaunchTarget {
  const kind = String(input.kind || "").toLowerCase();
  if (kind === "ile") {
    const mode = String(input.session_mode || "learning").toLowerCase();
    if (mode === "project" || mode === "exercise" || mode === "drill" || mode === "solo") {
      return storedExploreProjectLaunchTarget();
    }
    return exploreLearningLaunchTarget();
  }
  // TAP / default drill family
  const ik = String(input.interaction_kind || "conversational").toLowerCase();
  if (ik === "scout" || ik === "scouting") {
    return scoutDialogLaunchTarget();
  }
  if (ik === "exercise" || ik === "solo" || ik === "drill") {
    return storedDrillExerciseLaunchTarget();
  }
  return drillConversationalLaunchTarget();
}

/** New-launch targets in UI order (Work, Drill). Portal mint stays Work+Drill. */
export function allProductLaunchTargets(): ProductLaunchTarget[] {
  return [exploreLearningLaunchTarget(), drillConversationalLaunchTarget()];
}

/** Block play/work surface: Work, Drill, Scout. */
export function allBlockPracticeLaunchTargets(): ProductLaunchTarget[] {
  return [
    scoutDialogLaunchTarget(),
    exploreLearningLaunchTarget(),
    drillConversationalLaunchTarget(),
  ];
}

/**
 * Normalize any product-id string (canonical or legacy) → ProductLaunchTarget.
 * Unknown → explore dialog default.
 */
export function resolveProductIntentFromId(
  id: unknown,
): ProductLaunchTarget {
  const raw = String(id ?? "")
    .trim()
    .toLowerCase();
  switch (raw) {
    case "explore_dialog":
    case "explore_solo":
    case "open_ended_explore":
    case "open_ended_drill":
    case "ile_learning":
    case "ile_project":
      return exploreLearningLaunchTarget();
    case "drill_dialog":
    case "drill_solo":
    case "timed_explore":
    case "timed_drill":
    case "tap_conversational":
    case "tap_exercise":
      return drillConversationalLaunchTarget();
    case "scout_dialog":
    case "scout":
    case "tap_scout":
      return scoutDialogLaunchTarget();
    default:
      return exploreLearningLaunchTarget();
  }
}

/**
 * Map legacy product id → canonical id (for portal migration).
 */
export function canonicalizeProductIntentId(
  id: unknown,
): ProductIntentId {
  return resolveProductIntentFromId(id).id;
}

/**
 * Guest-link create body fields from intent (technical keys for APIs).
 * Callers still pass workspaceId / blockId / minutes / participants.
 */
export function productIntentToCreateFields(target: ProductLaunchTarget): {
  linkKind: "ile" | "tap";
  session_mode?: IleSessionModeTech;
  interaction_kind?: TapInteractionKindTech;
  exercise?: boolean;
  project?: boolean;
} {
  if (target.product === "ile") {
    return {
      linkKind: "ile",
      session_mode: target.session_mode === "project" ? "project" : "learning",
      project: target.session_mode === "project",
    };
  }
  const interaction_kind =
    target.interaction_kind === "exercise"
      ? "exercise"
      : target.interaction_kind === "scout"
        ? "scout"
        : "conversational";
  return {
    linkKind: "tap",
    interaction_kind,
    exercise: target.interaction_kind === "exercise",
  };
}

/** True when the launch is TAP (Drill family) — may need a duration. */
export function productIntentNeedsDuration(target: ProductLaunchTarget): boolean {
  return target.product === "tap";
}

/** One decode for guest-link mint, map placement, and learner launch. */
export function decodePracticeLaunchIntent(raw: unknown): ProductLaunchTarget {
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (rec.id != null) return resolveProductIntentFromId(rec.id);
    if (rec.style != null || rec.modality != null || rec.horizon != null) {
      return resolveProductIntentFromAxes({
        style: rec.style as LearningStyle | undefined,
        modality: rec.modality as PracticeModality | undefined,
        horizon: rec.horizon as SessionHorizon | undefined,
      });
    }
    if (rec.kind != null || rec.product != null) {
      return productIntentFromGuestLink({
        kind: String(rec.kind || rec.product || ""),
        session_mode: rec.session_mode != null ? String(rec.session_mode) : null,
        interaction_kind:
          rec.interaction_kind != null ? String(rec.interaction_kind) : null,
      });
    }
  }
  return resolveProductIntentFromId(raw);
}

/** Learner launch path from a decoded intent. */
export function launchPracticeHref(
  target: ProductLaunchTarget,
  input: { workspaceId: string; blockId?: string | null; sessionId?: string | null },
): string {
  const workspaceId = String(input.workspaceId || "").trim();
  if (target.product === "ile") {
    const params = new URLSearchParams();
    if (input.sessionId) params.set("id", String(input.sessionId));
    if (input.blockId) params.set("block", String(input.blockId));
    if (target.session_mode) params.set("session_mode", target.session_mode);
    const q = params.toString();
    return q ? `/session?${q}` : "/session";
  }
  if (target.interaction_kind === "scout") {
    const scoutParams = new URLSearchParams();
    if (input.blockId) scoutParams.set("blockId", String(input.blockId));
    if (input.sessionId) scoutParams.set("sessionId", String(input.sessionId));
    const scoutQ = scoutParams.toString();
    return scoutQ
      ? `/workspace/${workspaceId}/scout?${scoutQ}`
      : `/workspace/${workspaceId}/scout`;
  }
  const params = new URLSearchParams();
  if (input.blockId) params.set("block", String(input.blockId));
  if (target.interaction_kind) params.set("interaction_kind", target.interaction_kind);
  const q = params.toString();
  return q
    ? `/workspace/${workspaceId}/tap?${q}`
    : `/workspace/${workspaceId}/tap`;
}

/** Style extracted from a launch target. */
export function productIntentStyle(target: ProductLaunchTarget): LearningStyle {
  if (target.id.startsWith("scout")) return "scout";
  return target.id.startsWith("drill") ? "drill" : "explore";
}

/** Modality extracted from a launch target. */
export function productIntentModality(target: ProductLaunchTarget): PracticeModality {
  return target.id.endsWith("_solo") ? "solo" : "dialog";
}
