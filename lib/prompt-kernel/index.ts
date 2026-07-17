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
export { composePrompt, type ComposePromptOptions, type OntologyDensity } from "./compose";
export {
  TAP_SURFACE,
  TAP_SELECTIVE_THOUGHT_OVERLAY,
  buildTapFacilitatorInstructions,
  buildTapSelectiveThoughtSystemPrompt,
  buildTapOpeningQuestionTask,
  buildTapStartingTopicsTask,
} from "./surfaces/tap";
export {
  ILE_SURFACE,
  ILE_TOOLS_BLOCK,
  ILE_CONTEXT_BODY,
  buildIleHeliosChatSystemPrompt,
  buildIleWelcomeSystemPrompt,
} from "./surfaces/ile";
