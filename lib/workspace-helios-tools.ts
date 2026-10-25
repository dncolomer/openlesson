/**
 * Helios Learning Map builder tools: catalog, snapshot, pure dispatch, and
 * persist from preview.snapshot. Existing imports stay on this path.
 */

export {
  HELIOS_MAP_TOOL_CATALOG,
  HELIOS_MAP_TOOL_IDS,
  heliosMapToolAwarenessText,
  isHeliosMapToolId,
  type HeliosMapToolFamily,
  type HeliosMapToolId,
  type HeliosMapToolSpec,
} from "./workspace-helios-tools/catalog";

export {
  formatHeliosMapSnapshotForPrompt,
  heliosMapOccupiedKeys,
  heliosMapSnapshotFromBlocks,
  heliosMapSnapshotFromUnknown,
  heliosMapSnapshotToAuthoringNodes,
  nextOpenHeliosCell,
  parseHeliosMapChatModelTurn,
  parseHeliosMapToolCall,
  type HeliosMapBlock,
  type HeliosMapChatModelTurn,
  type HeliosMapSnapshot,
  type HeliosMapToolCall,
  type HeliosMapToolResult,
} from "./workspace-helios-tools/snapshot";

export {
  dispatchHeliosMapTool,
  heliosBridgeWidthFromArgs,
} from "./workspace-helios-tools/dispatch";

export {
  applyHeliosMapToolsAtomically,
  executeHeliosMapToolCall,
  type HeliosMapAtomicStep,
  type HeliosMapToolHost,
} from "./workspace-helios-tools/persist";
