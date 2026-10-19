/**
 * Historical action catalogs for the unsys model.
 * Size 4 names Forage / Exploit / Avoid / Infer. Sizes 8 and 16 were finer
 * policy sets. Live inference is hidden-state travel on priced edges.
 * Stored four-action ids stay try / hold / drop / insight.
 */

export const LEARNING_MODEL_SIZES = [4, 8, 16] as const;

export type LearningModelSize = (typeof LEARNING_MODEL_SIZES)[number];

export const DEFAULT_LEARNING_MODEL_SIZE: LearningModelSize = 4;

export type LearningModelActionKind =
  | "epistemic"
  | "pragmatic"
  | "aversive"
  | "precision"
  | "preference"
  | "report"
  | "travel";

export type LearningModelAction = {
  id: string;
  label: string;
  kind: LearningModelActionKind;
  /** Expected free energy role. */
  efe: string;
  meaning: string;
  /** Live four-action stored id, when this action is that core policy. */
  storedId?: "try" | "hold" | "drop" | "insight";
};

export const LEARNING_MODEL_CATALOG_4: readonly LearningModelAction[] = [
  {
    id: "forage",
    label: "Forage",
    kind: "epistemic",
    efe: "epistemic value",
    storedId: "hold",
    meaning:
      "Seek information. Stay with this hidden state and open finer hidden states of the same state factor.",
  },
  {
    id: "exploit",
    label: "Exploit",
    kind: "pragmatic",
    efe: "pragmatic value",
    storedId: "try",
    meaning:
      "Act on a preferred outcome. This hidden state is precise enough; settle the line and move on.",
  },
  {
    id: "avoid",
    label: "Avoid",
    kind: "aversive",
    efe: "negative preference",
    storedId: "drop",
    meaning:
      "Withdraw. This is not the hidden state in focus. Drop the line.",
  },
  {
    id: "infer",
    label: "Infer",
    kind: "report",
    efe: "posterior report",
    storedId: "insight",
    meaning:
      "Craft the insight. Report the hidden state the work found.",
  },
] as const;

export const LEARNING_MODEL_CATALOG_8: readonly LearningModelAction[] = [
  {
    id: "descend",
    label: "Descend",
    kind: "travel",
    efe: "epistemic value",
    meaning: "Focus on a finer hidden state (a child of the current hidden state).",
  },
  {
    id: "ascend",
    label: "Ascend",
    kind: "travel",
    efe: "complexity",
    meaning: "Focus on the coarser hidden state (the parent).",
  },
  {
    id: "switch",
    label: "Switch",
    kind: "travel",
    efe: "expected information gain",
    meaning: "Focus on a rival hidden state on the same state factor.",
  },
  {
    id: "exploit",
    label: "Exploit",
    kind: "pragmatic",
    efe: "pragmatic value",
    storedId: "try",
    meaning:
      "Act on a preferred outcome. This hidden state is precise enough; settle the line.",
  },
  {
    id: "avoid",
    label: "Avoid",
    kind: "aversive",
    efe: "negative preference",
    storedId: "drop",
    meaning: "Withdraw. This is not the hidden state in focus.",
  },
  {
    id: "sample",
    label: "Sample",
    kind: "epistemic",
    efe: "epistemic value",
    storedId: "hold",
    meaning:
      "Seek the next observation that would shrink uncertainty about this hidden state.",
  },
  {
    id: "predict",
    label: "Predict",
    kind: "epistemic",
    efe: "prediction error",
    meaning:
      "Generate the observation we would expect while focusing on this hidden state, and compare it to what shows up.",
  },
  {
    id: "infer",
    label: "Infer",
    kind: "report",
    efe: "posterior report",
    storedId: "insight",
    meaning: "Craft the insight. Report the hidden state the work found.",
  },
] as const;

export const LEARNING_MODEL_CATALOG_16: readonly LearningModelAction[] = [
  {
    id: "descend",
    label: "Descend",
    kind: "travel",
    efe: "epistemic value",
    meaning: "Focus on a finer hidden state (a child of the current hidden state).",
  },
  {
    id: "ascend",
    label: "Ascend",
    kind: "travel",
    efe: "complexity",
    meaning: "Focus on the coarser hidden state (the parent).",
  },
  {
    id: "switch",
    label: "Switch",
    kind: "travel",
    efe: "expected information gain",
    meaning: "Focus on a rival hidden state on the same state factor.",
  },
  {
    id: "divert",
    label: "Divert",
    kind: "travel",
    efe: "expected information gain",
    meaning: "Focus on a hidden state on a different state factor.",
  },
  {
    id: "exploit",
    label: "Exploit",
    kind: "pragmatic",
    efe: "pragmatic value",
    storedId: "try",
    meaning: "Act on a preferred outcome. Settle this hidden state.",
  },
  {
    id: "avoid",
    label: "Avoid",
    kind: "aversive",
    efe: "negative preference",
    storedId: "drop",
    meaning: "Withdraw. This is not the hidden state in focus.",
  },
  {
    id: "dwell",
    label: "Dwell",
    kind: "precision",
    efe: "ambiguity",
    meaning: "Remain on this hidden state. No transition. Gather in place.",
  },
  {
    id: "reopen",
    label: "Reopen",
    kind: "precision",
    efe: "expected free energy",
    meaning: "Reverse an exploit. This hidden state is open again.",
  },
  {
    id: "sample",
    label: "Sample",
    kind: "epistemic",
    efe: "epistemic value",
    storedId: "hold",
    meaning: "Seek the next observation that would shrink uncertainty.",
  },
  {
    id: "predict",
    label: "Predict",
    kind: "epistemic",
    efe: "prediction error",
    meaning: "Generate the observation we would expect while focusing on this hidden state.",
  },
  {
    id: "compare",
    label: "Compare",
    kind: "epistemic",
    efe: "prediction error",
    meaning: "Read the prediction error between the observation we would expect while focusing on this hidden state and what showed up.",
  },
  {
    id: "novelty",
    label: "Novelty",
    kind: "epistemic",
    efe: "salience",
    meaning: "Seek an unexpected observation (unexpected uncertainty).",
  },
  {
    id: "sharpen",
    label: "Sharpen",
    kind: "precision",
    efe: "precision",
    meaning: "Increase precision on this hidden state. Trust the prediction more.",
  },
  {
    id: "relax",
    label: "Relax",
    kind: "precision",
    efe: "precision",
    meaning: "Decrease precision on this hidden state. The prediction is not trusted.",
  },
  {
    id: "prefer",
    label: "Prefer",
    kind: "preference",
    efe: "prior preference C",
    meaning: "Update the prior preference over observations for this hidden state.",
  },
  {
    id: "infer",
    label: "Infer",
    kind: "report",
    efe: "posterior report",
    storedId: "insight",
    meaning: "Craft the insight. Report the hidden state the work found.",
  },
] as const;

export const LEARNING_MODEL_CATALOGS: Record<
  LearningModelSize,
  readonly LearningModelAction[]
> = {
  4: LEARNING_MODEL_CATALOG_4,
  8: LEARNING_MODEL_CATALOG_8,
  16: LEARNING_MODEL_CATALOG_16,
};

export const LEARNING_MODEL_SIZE_COPY: Record<
  LearningModelSize,
  { title: string; body: string }
> = {
  4: {
    title: "4 actions",
    body: "Historical names: Forage, Exploit, Avoid, Infer. Seek information, act on a preference, withdraw, or report the posterior.",
  },
  8: {
    title: "8 actions",
    body: "Historical catalog. Adds travel names (Descend, Ascend, Switch) and splits foraging into Sample and Predict.",
  },
  16: {
    title: "16 actions",
    body: "Historical catalog. Adds Divert, Dwell, Reopen, Compare, Novelty, Sharpen, Relax, and Prefer.",
  },
};

export function parseLearningModelSize(value: unknown): LearningModelSize {
  const n = Math.round(Number(value));
  if (n === 8) return 8;
  if (n === 16) return 16;
  return 4;
}

export function learningModelCatalog(size: unknown): readonly LearningModelAction[] {
  return LEARNING_MODEL_CATALOGS[parseLearningModelSize(size)];
}

export function learningModelActionLabel(storedId: "try" | "hold" | "drop" | "insight"): string {
  const row = LEARNING_MODEL_CATALOG_4.find((action) => action.storedId === storedId);
  return row?.label ?? storedId;
}
