// Session storage public API (stable import path: @/lib/storage)
// Domain types: @/lib/domain/types — persistence modules: @/lib/storage/*

export type {
  RequestType,
  ToolName,
  ToolAction,
  Probe,
  SessionPlanStep,
  SessionPlan,
  SessionStatus,
  ObserverMode,
  Frequency,
  Session,
  FacialDataPoint,
  LogToolUsageResult,
  SessionScreenshot,
  RecentAudioChunk,
  RecentTranscript,
  RecentToolEvent,
  RecentFacialData,
  RecentEEGData,
  UserCalibration,
  Workspace,
  Block,
  DeduplicatedSaveResult,
} from "@/lib/domain/types";

export {
  validatePlanSteps,
  isUuid,
  addProbeToSession,
  endSession,
  getIlePostSessionPath,
  getSessionStats,
} from "@/lib/domain/types";

export {
  createSession,
  getSession,
  getSessions,
  saveSession,
  deleteSession,
  addProbe,
  updateProbeExpanded,
  toggleProbeStarred,
  updateProbeRevealed,
  archiveProbe,
  unarchiveProbe,
  toggleProbeFocused,
  resetSessionProbes,
  restartSession,
  startSession,
  updateSessionStatus,
  pauseSession,
  resumeSession,
} from "@/lib/storage/sessions";

export {
  saveSessionAudio,
  saveAudioChunk,
  saveBrowserTranscript,
  getSessionAudio,
  saveFacialData,
  logToolUsage,
  logEEGData,
  saveSessionEEG,
  saveScreenshot,
  getSessionScreenshots,
  getScreenshotUrl,
  getRecentAudioChunks,
  getRecentTranscripts,
  getRecentToolEvents,
  getRecentFacialData,
  getRecentEEGData,
  getRecentScreenshots,
  deleteSessionScreenshots,
  getAllTranscripts,
  getAllEEGData,
  getAllFacialData,
  getAllToolEvents,
  getAllAudioChunks,
  getUserCalibration,
} from "@/lib/storage/media";

export {
  getWorkspaces,
  getBlocks,
  getIncompleteNodes,
  getWorkspaceById,
  updatePlanNotes,
  updatePlanVisibility,
} from "@/lib/storage/workspaces";

export {
  createSessionPlan,
  getSessionPlan,
  updateSessionPlan,
} from "@/lib/storage/session-plans";

export {
  saveWithDedupString,
  saveWithDedupBlob,
  clearDedupCache,
  getDedupCacheSize,
} from "@/lib/storage/dedup";
