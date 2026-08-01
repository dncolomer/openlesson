/**
 * Product intent framing for learner/owner surfaces.
 * Technical products remain ILE/TAP in code; UI speaks Explore/Drill × Open-ended/Timed.
 */

/** What the learner wants to do. */
export type LearningStyle = "explore" | "drill";

/** How long the run is structured. */
export type SessionHorizon = "open_ended" | "timed";

export type ProductIntent = {
  style: LearningStyle;
  horizon: SessionHorizon;
};

/** Technical launch target (code/API identifiers — not user-facing). */
export type TechnicalProductKind = "ile" | "tap";

export type IleSessionModeTech = "learning" | "project";
export type TapInteractionKindTech = "conversational" | "exercise";

export type ProductLaunchTarget = {
  product: TechnicalProductKind;
  /** ILE only */
  session_mode?: IleSessionModeTech;
  /** TAP only */
  interaction_kind?: TapInteractionKindTech;
  /** Stable id for data attributes / tests */
  id:
    | "open_ended_explore"
    | "open_ended_drill"
    | "timed_explore"
    | "timed_drill";
};

/** Human labels used on workspace + settings (English defaults; i18n keys mirror these). */
export const PRODUCT_INTENT_LABELS = {
  styleExplore: "Explore",
  styleDrill: "Drill / Practice",
  horizonOpen: "Open-ended",
  horizonTimed: "Timed",
  openEndedExplore: "Open-ended Exploration",
  openEndedDrill: "Open-ended Drill",
  timedExplore: "Timed Exploration",
  timedDrill: "Timed Drill",
  openEndedExploreHint: "Guided practice with a dialogue partner — no clock.",
  openEndedDrillHint: "Solo exercises per chapter — stash and solution stacks.",
  timedExploreHint: "Timed dialogue demonstration of what you know.",
  timedDrillHint: "Timed solo exercise — speak and submit your solution.",
  chooseStyle: "What do you want to do?",
  chooseHorizon: "How do you want to run it?",
  questionExplore: "Do you want to Explore?",
  questionDrill: "Do you want to Drill / Practice?",
  questionOpen: "Do you want open-ended?",
  questionTimed: "Do you want timed?",
} as const;

export const PRODUCT_INTENT_DEFAULT: ProductIntent = {
  style: "explore",
  horizon: "open_ended",
};

/**
 * Map Explore|Drill × Open-ended|Timed → technical launch.
 * Defaults missing/invalid style → explore; horizon → open_ended.
 */
export function resolveProductIntent(
  style: unknown,
  horizon: unknown,
): ProductLaunchTarget {
  const s: LearningStyle =
    style === "drill" || style === "practice" || style === "project"
      ? "drill"
      : "explore";
  const h: SessionHorizon =
    horizon === "timed" || horizon === "timer" || horizon === "timed_run"
      ? "timed"
      : "open_ended";

  if (h === "open_ended" && s === "explore") {
    return {
      id: "open_ended_explore",
      product: "ile",
      session_mode: "learning",
    };
  }
  if (h === "open_ended" && s === "drill") {
    return {
      id: "open_ended_drill",
      product: "ile",
      session_mode: "project",
    };
  }
  if (h === "timed" && s === "explore") {
    return {
      id: "timed_explore",
      product: "tap",
      interaction_kind: "conversational",
    };
  }
  return {
    id: "timed_drill",
    product: "tap",
    interaction_kind: "exercise",
  };
}

/** Resolve from a full intent object. */
export function resolveProductIntentFromAxes(
  intent: Partial<ProductIntent> | null | undefined,
): ProductLaunchTarget {
  return resolveProductIntent(
    intent?.style ?? PRODUCT_INTENT_DEFAULT.style,
    intent?.horizon ?? PRODUCT_INTENT_DEFAULT.horizon,
  );
}

/**
 * UI launch: Explore|Drill × timebox on/off → existing four targets.
 * timeboxEnabled true → timed (TAP path); false → open-ended (ILE path).
 */
export function resolveLaunchFromStyleAndTimebox(
  style: unknown,
  timeboxEnabled: boolean,
): ProductLaunchTarget {
  return resolveProductIntent(style, timeboxEnabled ? "timed" : "open_ended");
}

/** Display cluster label for a technical launch target. */
export function productIntentClusterLabel(target: ProductLaunchTarget): string {
  switch (target.id) {
    case "open_ended_explore":
      return PRODUCT_INTENT_LABELS.openEndedExplore;
    case "open_ended_drill":
      return PRODUCT_INTENT_LABELS.openEndedDrill;
    case "timed_explore":
      return PRODUCT_INTENT_LABELS.timedExplore;
    case "timed_drill":
      return PRODUCT_INTENT_LABELS.timedDrill;
    default:
      return PRODUCT_INTENT_LABELS.openEndedExplore;
  }
}

export function productIntentClusterHint(target: ProductLaunchTarget): string {
  switch (target.id) {
    case "open_ended_explore":
      return PRODUCT_INTENT_LABELS.openEndedExploreHint;
    case "open_ended_drill":
      return PRODUCT_INTENT_LABELS.openEndedDrillHint;
    case "timed_explore":
      return PRODUCT_INTENT_LABELS.timedExploreHint;
    case "timed_drill":
      return PRODUCT_INTENT_LABELS.timedDrillHint;
    default:
      return PRODUCT_INTENT_LABELS.openEndedExploreHint;
  }
}

/**
 * Infer intent cluster from guest-link row technical fields.
 * Used for browse badges without saying TAP/ILE.
 */
export function productIntentFromGuestLink(input: {
  kind?: "tap" | "ile" | string | null;
  session_mode?: string | null;
  interaction_kind?: string | null;
}): ProductLaunchTarget {
  const kind = String(input.kind || "").toLowerCase();
  if (kind === "ile") {
    const mode = String(input.session_mode || "learning").toLowerCase();
    if (mode === "project" || mode === "exercise" || mode === "drill") {
      return resolveProductIntent("drill", "open_ended");
    }
    return resolveProductIntent("explore", "open_ended");
  }
  // TAP / default timed
  const ik = String(input.interaction_kind || "conversational").toLowerCase();
  if (ik === "exercise" || ik === "solo" || ik === "drill") {
    return resolveProductIntent("drill", "timed");
  }
  return resolveProductIntent("explore", "timed");
}

/** All four launch targets in UI order (open explore, open drill, timed explore, timed drill). */
export function allProductLaunchTargets(): ProductLaunchTarget[] {
  return [
    resolveProductIntent("explore", "open_ended"),
    resolveProductIntent("drill", "open_ended"),
    resolveProductIntent("explore", "timed"),
    resolveProductIntent("drill", "timed"),
  ];
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
