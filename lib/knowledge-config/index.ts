export {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
  isKnowledgeConfigVector,
  type KnowledgeConfigEmbeddingModelId,
  type KnowledgeConfigEmbeddingV1,
  type KnowledgeConfigPointer,
  type KnowledgeConfigProjection2D,
  type KnowledgeConfigSnapshotTrigger,
  type KnowledgeConfigSubject,
  type KnowledgeConfigTrajectoryPoint,
} from "./types";

export {
  cosineSimilarity,
  l2Distance,
  l2Norm,
  l2Normalize,
  scoreToUnit,
} from "./math";

export {
  emptyKnowledgeConfig,
  encodeKnowledgeConfig,
  projectKnowledgeConfigTo2D,
  type KnowledgeConfigEncodeInput,
  type PowFeatureRow,
} from "./encoder";

export {
  PROJECTION_ALGORITHM_IDS,
  PROJECTION_ALGORITHM_OPTIONS,
  isProjectionAlgorithmId,
  parseProjectionAlgorithmId,
  projectionFrameId,
  projectionFrameId3d,
  pairwiseL2Distances,
  jacobiEigendecomposition,
  projectPca,
  projectClassicalMds,
  projectSmacof,
  projectVectors2D,
  projectPca3D,
  projectClassicalMds3D,
  projectSmacof3D,
  projectRandom3D,
  projectVectors3D,
  projectTrajectoryAndRegions,
  projectTrajectoryPoints2D,
  estimateDistanceScale,
  type ProjectionAlgorithmId,
  type Point2D,
  type Point3D,
  type TrajectoryPointInput,
  type RegionCentroidInput,
  type RegionOverlayProjected,
  type JointProjectionResult,
} from "./project-2d";

export {
  createCustomVerificationModelFromVectors,
  computeKnowledgeDistance,
  scoreAgainstCustomVerificationModel,
  CustomVerificationModelError,
  type CustomVerificationModelSpec,
  type CustomVerificationScore,
  type CustomVerificationSubjectRef,
  type KnowledgeDistance,
} from "./custom-verification-model";

export {
  encodeSyntheticRegionProfile,
  createSyntheticKnowledgeRegionFromProfile,
  projectKnowledgeRegionToOverlay,
  projectKnowledgeRegionsToOverlays,
  type SyntheticRegionProfile,
  type KnowledgeRegionOverlay2D,
} from "./synthetic-knowledge-region";

export {
  computeDataBounds,
  computeProjectionFitBounds,
  selectProjectionDisplayPoints,
  fitViewTransform,
  zoomViewTransform,
  panViewTransform,
  dataToScreen,
  screenToData,
  mapRadiusToScreen,
  generateAxisTicks,
  generateGridTicks,
  formatTickLabel,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  type DataBounds,
  type ViewTransform,
  type ScreenRect,
  type TickMark,
  type ProjectionDisplayMode,
} from "./projection-view";
