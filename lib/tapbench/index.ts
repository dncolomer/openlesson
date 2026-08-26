export { TAPBENCH_OWNER_EMAIL, TAPBENCH_API_BASE, TAPBENCH_KEY_PREFIX } from "./constants";

export {
  scoreTapbenchRegionIn64D,
  cosineThresholdToL2Radius,
  TapbenchScoreError,
  type TapbenchRegionScore,
  type TapbenchRegionGeometry,
} from "./score";

export {
  parseTapbenchTooling,
  toolingIsPresent,
  TapbenchToolingError,
  type TapbenchToolingDescription,
} from "./tooling";

export {
  issueTapbenchTaskKey,
  authenticateTapbenchKey,
  assertTapbenchKeyForTask,
  hashTapbenchKey,
  resetTapbenchKeyStoreForTests,
  memoryTapbenchKeyStore,
  type TapbenchIssuedKey,
  type TapbenchKeyStore,
} from "./keys";

export {
  memoryTapbenchRunStore,
  resetTapbenchRunStoreForTests,
  publicTapbenchRunView,
  tapbenchRunFromScore,
  type TapbenchRunRecord,
  type TapbenchRunStore,
} from "./runs";

export {
  listTapbenchBenchmarkTasks,
  getTapbenchBenchmarkTask,
  selectTapbenchBenchmarkTasks,
  isTapbenchPublicWorkspace,
  resolveTapbenchOwnerUserId,
  type TapbenchTask,
} from "./catalog";

export {
  presentTapbenchTaskGoals,
  loadTapbenchTaskGoals,
  type TapbenchTaskGoal,
  type TapbenchTaskGoals,
} from "./goals";

export {
  snapshotTapbenchPowPayload,
  scoreTapbenchPowPayload,
  powFeatureRowsFromTapbenchUpload,
  TapbenchWrapError,
  type TapbenchWrapResult,
  type TapbenchWrapIo,
} from "./wrap";

export { loadTapbenchLandingData } from "./landing-data";

export {
  buildTapbenchWrapSkillMarkdown,
  TAPBENCH_WRAP_SKILL_FILENAME,
} from "./skill-md";

export { stopTapbenchSession, type StopTapbenchSessionResult } from "./stop";

export {
  mintTapbenchGuests,
  tapbenchGuestIdFromRequest,
  resetTapbenchGuestStoreForTests,
  memoryTapbenchGuestStore,
  type TapbenchKeyGuest,
} from "./guests";

export {
  createTapbenchRegionFromGuests,
  listTapbenchPublicRegions,
  publicTapbenchRegionView,
  ownerScoreForRegion,
  type TapbenchPublicRegion,
} from "./region";

export {
  TAPBENCH_RESULTS_PAGE_SIZE,
  matchTapbenchColFilter,
  paginateTapbenchRows,
} from "./table-filter";

export {
  pickBestTapbenchRegion,
  rankTapbenchRegions,
  topTapbenchRegions,
  tapbenchWorkspaceRows,
  tapbenchWorkspaceHref,
  TAPBENCH_WORKSPACE_PATH,
  TAPBENCH_WORKSPACE_TOP_N,
  type TapbenchWorkspaceRow,
} from "./task-rows";
