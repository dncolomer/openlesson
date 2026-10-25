/**
 * Persist / load / score custom verification models / knowledge regions (workspace-scoped).
 * Public re-export barrel. Implementations live in crud / synthetic / eval.
 */

export type { CustomVerificationModelRow } from "@/lib/pow-api/custom-verification-model-crud";
export {
  listCustomVerificationModels,
  listImportableKnowledgeRegionsForOwner,
  getCustomVerificationModel,
  deleteCustomVerificationModel,
  createCustomVerificationModelFromSubjects,
  listSubjectsWithKnowledgeConfig,
  rowToSpec,
} from "@/lib/pow-api/custom-verification-model-crud";
export type { SyntheticRegionFileInput } from "@/lib/pow-api/custom-verification-model-synthetic";
export {
  decodeSyntheticRegionFileText,
  buildSyntheticRegionGenerationPrompt,
  generateSyntheticRegionProfileWithGrok,
  createSyntheticCustomVerificationModel,
} from "@/lib/pow-api/custom-verification-model-synthetic";
export {
  evalSubjectAgainstCustomVerificationModel,
  computeKnowledgeDistanceForSubject,
  buildWorkspaceLinkUrlMap,
} from "@/lib/pow-api/custom-verification-model-eval";
