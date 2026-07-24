export { PROMPT_SYSTEM_VERSION } from "./version";
export { WORKSPACE_ONTOLOGY, WORKSPACE_ONTOLOGY_COMPACT } from "./ontology";
export {
  SCORE_FIELD_DESCRIPTIONS,
  TRIPLE_SCORE_INSTRUCTIONS,
  type GhcConfidence,
} from "./scores";
export { TIM_SYSTEM_ROLE, TIM_CONTRACT_NARRATIVE } from "./tim";
export {
  emptyLearningWorldModel,
  formatEvidenceAppetiteGuidance,
  learningWorldModelForTim,
  mergeLearningWorldModelDelta,
  parseLearningWorldModel,
  serializeLearningWorldModel,
  WORLD_MODEL_DELTA_INSTRUCTIONS,
  type BlockCoverageDepth,
  type LearningWorldModelDelta,
  type LearningWorldModelV0,
} from "./world-model";
// Knowledge config geometry lives in @/lib/knowledge-config (knowledgecfg-v1-d64).
export { composePrompt, type ComposePromptOptions, type OntologyDensity } from "./compose";
export {
  TAP_SURFACE,
  TAP_SELECTIVE_THOUGHT_OVERLAY,
  TAP_PRACTICE_THOUGHT_OVERLAY,
  buildTapFacilitatorInstructions,
  buildTapSelectiveThoughtSystemPrompt,
  buildTapOpeningQuestionTask,
  buildTapPracticeOpeningQuestionTask,
  buildTapStartingTopicsTask,
} from "./surfaces/tap";
export {
  ILE_SURFACE,
  ILE_TOOLS_BLOCK,
  ILE_CONTEXT_BODY,
  buildIleHeliosChatSystemPrompt,
  buildIleWelcomeSystemPrompt,
} from "./surfaces/ile";
export {
  SCORE_POW_CONTEXT_LAYER,
  SCORE_POW_CONTEXT_LAYER_OPAQUE,
  SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY,
  buildScoreContextSurface,
  buildOpaqueScoreContextSurface,
  scoreInstructionsRequirePowOnly,
  scoreInstructionsRequireSubmitStashAnalysis,
} from "./surfaces/score-context";
