/**
 * Map of Knowledge — pure aggregation, projection, and guest-placement helpers.
 * Public workspaces expose embeddings, regions, blocks, and PoW aggregates here.
 */

export type { ProjectionAlgorithmId } from "@/lib/knowledge-config";
export {
  PROJECTION_ALGORITHM_IDS,
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
} from "@/lib/knowledge-config";
export {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_SEM_DIM,
  FLOW_EMBEDDING_STRUCT_DIM,
} from "@/lib/flow-embedding";

export type {
  StemMiniAvatar,
  StemMiniAvatarId,
} from "@/lib/map-of-knowledge/stem-avatars";
export {
  STEM_MINI_AVATARS,
  STEM_MINI_AVATAR_BASE_PATH,
  getStemMiniAvatar,
  hashStringToSeed,
  isStemMiniAvatarId,
  pickStemMiniAvatar,
  resolveMapUserAvatar,
  stemMiniAvatarCatalogSize,
  stemMiniAvatarForSubjectId,
  stemMiniAvatarPath,
} from "@/lib/map-of-knowledge/stem-avatars";

export type {
  GlobalMapEdge,
  GlobalMapModel,
  GlobalMapNode3DLayout,
  GlobalMapRegionNode,
  GlobalMapRegionSummary,
  GlobalMapUserClass,
  GlobalMapViewTransform,
} from "@/lib/map-of-knowledge/global-map";
export {
  GLOBAL_MAP_MAX_ZOOM,
  GLOBAL_MAP_MIN_ZOOM,
  GLOBAL_MAP_NEAR_RADIUS_FACTOR,
  GLOBAL_MAP_VIEW_DEFAULT,
  buildGlobalMapEdges,
  buildGlobalMapModel,
  classifyUserAgainstRegion,
  clampGlobalMapZoom,
  countUsersForRegion,
  enabledRegionsForLocalFocus,
  formatGlobalMapDistance,
  globalMap3dLayoutScale,
  globalMapRegionSummary,
  globalMapViewTransformAttr,
  layoutGlobalMapNodes3D,
  panGlobalMapView,
  projectGlobalMapLayoutPoint,
  regionCentroidDistance,
  regionMembershipRadius,
  workspaceKnowledgeToGlobalMapInputs,
  zoomGlobalMapView,
} from "@/lib/map-of-knowledge/global-map";

export {
  buildFindYourselfMapFocus,
  enabledRegionsForFindYourself,
  findMapUserForGuestSubject,
  parsePlacementLinkToken,
  type FindYourselfResolveErr,
  type FindYourselfResolveOk,
} from "@/lib/map-of-knowledge/find-yourself";

export {
  MAP_NEWSLETTER_SUBSCRIBE_NOTE,
  MAP_NEWSLETTER_SUCCESS_MESSAGE,
  MAP_NOT_ON_MAP_MESSAGE,
  isValidNotifyEmail,
  normalizeNotifyEmail,
  validateMapNewsletterRegistration,
  validateMapReadyNotifyRegistration,
} from "@/lib/map-of-knowledge/map-ready-notify";

export {
  registerMapNewsletterLead,
  registerMapReadyNotifyRequest,
} from "@/lib/map-of-knowledge/map-ready-notify-store";

export type { MapInfiniteGridTokens } from "@/lib/map-of-knowledge/infinite-grid";
export {
  MAP_INFINITE_GRID,
  MAP_INFINITE_GRID_BACKGROUND,
  MAP_INFINITE_GRID_BACKGROUND_HEX,
  MAP_INFINITE_GRID_CELL_PX,
  MAP_INFINITE_GRID_3D_DIVISIONS,
  MAP_INFINITE_GRID_3D_FOG_FAR,
  MAP_INFINITE_GRID_3D_FOG_NEAR,
  MAP_INFINITE_GRID_3D_MAX_DISTANCE,
  MAP_INFINITE_GRID_3D_SIZE,
  MAP_INFINITE_GRID_PATTERN_ID,
  MAP_INFINITE_GRID_STROKE,
  MAP_INFINITE_GRID_STROKE_HEX,
  MAP_INFINITE_GRID_STROKE_OPACITY,
  mapInfiniteGridPatternAttrs,
  mapInfiniteGridPatternFill,
  mapInfiniteGridPatternPath,
} from "@/lib/map-of-knowledge/infinite-grid";

export type { EmbeddingModelInfo } from "@/lib/map-of-knowledge/embedding-catalog";
export {
  EMBEDDING_MODEL_CATALOG,
  describeEmbeddingModel,
  mergeEmbeddingModelCatalog,
  resolveSelectedEmbeddingModelId,
} from "@/lib/map-of-knowledge/embedding-catalog";

export type {
  DefaultRegionPickResult,
  MapAggregatedPowStats,
  MapDotKind,
  MapOfKnowledgePayload,
  MapPoint3D,
  MapPublicBlock,
  MapPublicWorkspace,
  MapRegion,
  MapRegionWorkspaceGroup,
  MapUserLocation,
  PublicBlockRaw,
  PublicPowWorkspaceStatsRaw,
  PublicRegionRaw,
  PublicUserPointRaw,
  PublicWorkspaceRaw,
} from "@/lib/map-of-knowledge/payload";
export {
  aggregatePublicPowStats,
  buildMapOfKnowledgePayload,
  filterEnabledRegions,
  filterMapPlacementWorkspaces,
  filterPublicWorkspaces,
  groupRegionsByWorkspace,
  isEligibleMapPublicWorkspace,
  mapDotColor,
  mapDotIsGolden,
  mapDotKindFromParticipant,
  pickDefaultEnabledRegionsFromOneWorkspace,
  pickRandomEnabledRegionIds,
  projectMapVectors,
  projectVectors3D,
  reprojectMapLayout,
  shortUserIdPreview,
} from "@/lib/map-of-knowledge/payload";

export type {
  GuestLinkKind,
  GuestPlacementError,
  GuestPlacementRequest,
  GuestPlacementResult,
} from "@/lib/map-of-knowledge/guest-placement";
export {
  buildGuestPlacementResult,
  generateAnonymousGuestIdentity,
  validateGuestPlacement,
} from "@/lib/map-of-knowledge/guest-placement";
