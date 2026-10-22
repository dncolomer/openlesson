/**
 * Feature split for the three workspace products.
 *
 * Learning workspace (stored kind `standard`): a designer builds a map and
 * people in the organisation play it. Selling is AYCL only.
 * Verification workspace (stored kind `knowledge_region`): goals, verification
 * flows, proof of work, knowledge regions, and analysis.
 * Calibration workspace (stored kind `calibration`): same shell as Verification
 * with calibration flows and uncertainty embeddings.
 *
 * Knowledge Portal is not a feature of either product.
 */

import {
  isCalibrationWorkspace,
  isKnowledgeRegionWorkspace,
  parseWorkspaceKind,
  WORKSPACE_KIND_CALIBRATION,
  WORKSPACE_KIND_KNOWLEDGE_REGION,
} from "@/lib/workspace-kind";

export type WorkspaceFeature =
  | "map"
  | "dags"
  | "map_types"
  | "goals"
  | "verification_flows"
  | "calibration_flows"
  | "context"
  | "knowledge"
  | "insights"
  | "kpis"
  | "settings"
  | "make_public"
  | "aycl"
  | "knowledge_regions"
  | "data_studio"
  | "integrations"
  | "proof_of_work"
  | "knowledge_portal"
  | "knowledge_links";

const LEARNING_FEATURES: readonly WorkspaceFeature[] = [
  "map",
  "dags",
  "map_types",
  "context",
  "settings",
  "make_public",
  "aycl",
  "integrations",
];

const VERIFICATION_FEATURES: readonly WorkspaceFeature[] = [
  "goals",
  "verification_flows",
  "context",
  "knowledge",
  "settings",
  "make_public",
  "knowledge_regions",
  "data_studio",
  "integrations",
  "proof_of_work",
];

const CALIBRATION_FEATURES: readonly WorkspaceFeature[] = [
  "goals",
  "calibration_flows",
  "context",
  "knowledge",
  "settings",
  "make_public",
  "knowledge_regions",
  "data_studio",
  "integrations",
  "proof_of_work",
];

const LEARNING = new Set<WorkspaceFeature>(LEARNING_FEATURES);
const VERIFICATION = new Set<WorkspaceFeature>(VERIFICATION_FEATURES);
const CALIBRATION = new Set<WorkspaceFeature>(CALIBRATION_FEATURES);

export function learningWorkspaceFeatures(): readonly WorkspaceFeature[] {
  return LEARNING_FEATURES;
}

export function verificationWorkspaceFeatures(): readonly WorkspaceFeature[] {
  return VERIFICATION_FEATURES;
}

export function calibrationWorkspaceFeatures(): readonly WorkspaceFeature[] {
  return CALIBRATION_FEATURES;
}

export function workspaceSupportsFeature(
  kind: unknown,
  feature: WorkspaceFeature,
): boolean {
  const parsed = parseWorkspaceKind(kind);
  if (parsed === WORKSPACE_KIND_CALIBRATION) return CALIBRATION.has(feature);
  if (parsed === WORKSPACE_KIND_KNOWLEDGE_REGION) return VERIFICATION.has(feature);
  return LEARNING.has(feature);
}

function featurePhrase(feature: WorkspaceFeature): string {
  switch (feature) {
    case "map":
      return "the map designer";
    case "dags":
      return "DAGs";
    case "map_types":
      return "map types";
    case "goals":
      return "goals";
    case "verification_flows":
      return "verification flows";
    case "calibration_flows":
      return "calibration flows";
    case "context":
      return "context";
    case "knowledge":
      return "knowledge";
    case "insights":
      return "insights";
    case "kpis":
      return "KPIs";
    case "settings":
      return "settings";
    case "make_public":
      return "Make Public";
    case "aycl":
      return "AYCL";
    case "knowledge_regions":
      return "knowledge regions";
    case "data_studio":
      return "Data Studio";
    case "integrations":
      return "integrations";
    case "proof_of_work":
      return "proof of work";
    case "knowledge_portal":
      return "Knowledge Portal";
    case "knowledge_links":
      return "knowledge links";
  }
}

export function workspaceProductLabel(kind: unknown): string {
  if (isCalibrationWorkspace(kind)) return "Calibration workspace";
  return isKnowledgeRegionWorkspace(kind)
    ? "Verification workspace"
    : "Learning workspace";
}

export function workspaceFeatureDeniedMessage(
  kind: unknown,
  feature: WorkspaceFeature,
): string {
  const product = isCalibrationWorkspace(kind)
    ? "Calibration workspaces"
    : isKnowledgeRegionWorkspace(kind)
      ? "Verification workspaces"
      : "Learning workspaces";
  return `${product} do not support ${featurePhrase(feature)}.`;
}

/**
 * MCP / REST agent tool → feature. Null means both products may call it
 * (workspace metadata and integration skill).
 */
export function agentToolFeature(name: string): WorkspaceFeature | null {
  switch (name) {
    case "list_workspaces":
    case "get_workspace":
    case "create_workspace":
    case "update_workspace":
    case "list_blocks":
    case "update_blocks":
    case "get_workspace_settings":
    case "update_workspace_settings":
    case "get_account_settings":
    case "update_account_settings":
    case "generate_integration_skill":
    case "start_session":
    case "get_session":
    case "upload_proof_of_work":
    case "end_session":
    case "list_flow_embeddings":
    case "get_flow_embedding":
      return null;
    case "list_map_tools":
    case "apply_map_tool":
      return "map";
    case "generate_proof_of_work_schema":
    case "buffer_proof_of_work":
    case "stash_proof_of_work":
    case "submit_stashed_proof_of_work":
      return "proof_of_work";
    case "list_tap_links":
    case "create_tap_link":
      return "knowledge_links";
    default:
      return null;
  }
}
