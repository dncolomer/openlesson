/**
 * Product intent framing for learner/owner surfaces.
 * Technical products remain ILE/TAP in code; UI speaks Explore/Drill × Dialog/Solo.
 *
 * Product axes (authoring model):
 * - Drill always → TAP; second choice = LLM Dialog vs Solo Exercise
 * - Explore always → ILE; second choice = LLM Dialog vs Solo Exercise
 *
 * Legacy open_ended_* / timed_* ids are accepted on read for stored rows.
 */

/** What the learner wants to do. */
export type LearningStyle = "explore" | "drill";

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
export type TapInteractionKindTech = "conversational" | "exercise";

/** Canonical product intent ids (new Dialog/Solo axes). */
export type ProductIntentId =
  | "explore_dialog"
  | "explore_solo"
  | "drill_dialog"
  | "drill_solo";

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
  styleExplore: "Explore",
  styleDrill: "Drill / Practice",
  /** LLM-powered dialog practice (user-facing: "With AI"). */
  modalityDialog: "With AI",
  /** Solo exercise practice (user-facing: "Solo"). */
  modalitySolo: "Solo",
  /** @deprecated Prefer modalityDialog */
  horizonOpen: "With AI",
  /** @deprecated Prefer modalitySolo */
  horizonTimed: "Solo",
  exploreDialog: "Explore · Dialog",
  exploreSolo: "Explore · Solo Exercise",
  drillDialog: "Drill · Dialog",
  drillSolo: "Drill · Solo Exercise",
  /** Legacy label keys — map to new names so old i18n/UI still resolve. */
  openEndedExplore: "Explore · Dialog",
  openEndedDrill: "Explore · Solo Exercise",
  timedExplore: "Drill · Dialog",
  timedDrill: "Drill · Solo Exercise",
  exploreDialogHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  exploreSoloHint:
    "Solo exercises per chapter — stash and solution stacks.",
  drillDialogHint:
    "Timed dialogue demonstration of what you know.",
  drillSoloHint:
    "Timed solo exercise — speak and submit your solution.",
  openEndedExploreHint:
    "Guided dialogue practice with an LLM partner — no clock.",
  openEndedDrillHint:
    "Solo exercises per chapter — stash and solution stacks.",
  timedExploreHint:
    "Timed dialogue demonstration of what you know.",
  timedDrillHint:
    "Timed solo exercise — speak and submit your solution.",
  chooseStyle: "What do you want to do?",
  chooseModality: "How do you want to practice?",
  chooseHorizon: "How do you want to practice?",
  questionExplore: "Do you want to Explore?",
  questionDrill: "Do you want to Drill / Practice?",
  questionDialog: "LLM-powered Dialog?",
  questionSolo: "Solo Exercise?",
  questionOpen: "LLM-powered Dialog?",
  questionTimed: "Solo Exercise?",
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

/**
 * Canonical resolve: Explore|Drill × Dialog|Solo → technical launch.
 *
 * Drill always TAP; Explore always ILE.
 * Dialog → conversational (TAP) / learning (ILE).
 * Solo → exercise (TAP) / project (ILE).
 *
 * Accepts second-arg tokens: dialog|solo|open_ended|timed|conversational|exercise|…
 * Defaults missing/invalid style → explore; modality → dialog.
 */
export function resolveProductIntent(
  style: unknown,
  modalityOrHorizon: unknown,
): ProductLaunchTarget {
  const s: LearningStyle =
    style === "drill" || style === "practice" || style === "project"
      ? "drill"
      : "explore";
  const modality = normalizePracticeModality(modalityOrHorizon);

  // Explore always → ILE
  if (s === "explore") {
    if (modality === "solo") {
      return {
        id: "explore_solo",
        product: "ile",
        session_mode: "project",
      };
    }
    return {
      id: "explore_dialog",
      product: "ile",
      session_mode: "learning",
    };
  }

  // Drill always → TAP
  if (modality === "solo") {
    return {
      id: "drill_solo",
      product: "tap",
      interaction_kind: "exercise",
    };
  }
  return {
    id: "drill_dialog",
    product: "tap",
    interaction_kind: "conversational",
  };
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
 * UI launch: Explore|Drill × Dialog/Solo via boolean "solo" flag.
 * soloEnabled true → solo; false → dialog.
 * (Replaces resolveLaunchFromStyleAndTimebox semantics.)
 */
export function resolveLaunchFromStyleAndModality(
  style: unknown,
  soloEnabled: boolean,
): ProductLaunchTarget {
  return resolveProductIntent(style, soloEnabled ? "solo" : "dialog");
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
      return resolveProductIntent("explore", "solo");
    }
    return resolveProductIntent("explore", "dialog");
  }
  // TAP / default drill family
  const ik = String(input.interaction_kind || "conversational").toLowerCase();
  if (ik === "exercise" || ik === "solo" || ik === "drill") {
    return resolveProductIntent("drill", "solo");
  }
  return resolveProductIntent("drill", "dialog");
}

/** All four launch targets in UI order (explore dialog, explore solo, drill dialog, drill solo). */
export function allProductLaunchTargets(): ProductLaunchTarget[] {
  return [
    resolveProductIntent("explore", "dialog"),
    resolveProductIntent("explore", "solo"),
    resolveProductIntent("drill", "dialog"),
    resolveProductIntent("drill", "solo"),
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
    case "open_ended_explore":
    case "ile_learning":
      return resolveProductIntent("explore", "dialog");
    case "explore_solo":
    case "open_ended_drill":
    case "ile_project":
      return resolveProductIntent("explore", "solo");
    case "drill_dialog":
    case "timed_explore":
    case "tap_conversational":
      return resolveProductIntent("drill", "dialog");
    case "drill_solo":
    case "timed_drill":
    case "tap_exercise":
      return resolveProductIntent("drill", "solo");
    default:
      return resolveProductIntent("explore", "dialog");
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
  return {
    linkKind: "tap",
    interaction_kind:
      target.interaction_kind === "exercise" ? "exercise" : "conversational",
    exercise: target.interaction_kind === "exercise",
  };
}

/** True when the launch is TAP (Drill family) — may need a duration. */
export function productIntentNeedsDuration(target: ProductLaunchTarget): boolean {
  return target.product === "tap";
}

/** Style extracted from a launch target. */
export function productIntentStyle(target: ProductLaunchTarget): LearningStyle {
  return target.id.startsWith("drill") ? "drill" : "explore";
}

/** Modality extracted from a launch target. */
export function productIntentModality(target: ProductLaunchTarget): PracticeModality {
  return target.id.endsWith("_solo") ? "solo" : "dialog";
}
