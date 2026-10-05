/**
 * Feature split for the two workspace products.
 *
 * Learning workspace (stored kind `standard`): a designer builds a map and
 * people in the organisation play it. Selling is AYCL only.
 * Verification workspace (stored kind `knowledge_region`): goals, flows,
 * proof of work, knowledge regions, and analysis.
 *
 * Knowledge Portal is not a feature of either product.
 */

import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";

export type WorkspaceFeature =
  | "map"
  | "dags"
  | "map_types"
  | "goals"
  | "verification_flows"
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
  | "snapshots"
  | "knowledge_portal"
  | "knowledge_links";

const LEARNING_FEATURES: readonly WorkspaceFeature[] = [
  "map",
  "dags",
  "map_types",
  "context",
  "settings",
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
  "snapshots",
];

const LEARNING = new Set<WorkspaceFeature>(LEARNING_FEATURES);
const VERIFICATION = new Set<WorkspaceFeature>(VERIFICATION_FEATURES);

export function learningWorkspaceFeatures(): readonly WorkspaceFeature[] {
  return LEARNING_FEATURES;
}

export function verificationWorkspaceFeatures(): readonly WorkspaceFeature[] {
  return VERIFICATION_FEATURES;
}

export function workspaceSupportsFeature(
  kind: unknown,
  feature: WorkspaceFeature,
): boolean {
  const allowed = isKnowledgeRegionWorkspace(kind) ? VERIFICATION : LEARNING;
  return allowed.has(feature);
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
    case "snapshots":
      return "snapshots";
    case "knowledge_portal":
      return "Knowledge Portal";
    case "knowledge_links":
      return "knowledge links";
  }
}

export function workspaceProductLabel(kind: unknown): string {
  return isKnowledgeRegionWorkspace(kind)
    ? "Verification workspace"
    : "Learning workspace";
}

export function workspaceFeatureDeniedMessage(
  kind: unknown,
  feature: WorkspaceFeature,
): string {
  const product = isKnowledgeRegionWorkspace(kind)
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
    case "generate_integration_skill":
      return null;
    case "list_blocks":
      return "map";
    case "generate_proof_of_work_schema":
    case "upload_proof_of_work":
    case "buffer_proof_of_work":
    case "stash_proof_of_work":
    case "submit_stashed_proof_of_work":
      return "proof_of_work";
    case "lwm_snapshot":
    case "get_world_model":
    case "list_snapshot_history":
      return "snapshots";
    case "get_knowledge_config":
    case "get_knowledge_config_trajectory":
    case "knowledge_distance":
      return "knowledge";
    case "list_custom_knowledge_regions":
    case "create_custom_knowledge_region":
    case "eval_custom_knowledge_region":
      return "knowledge_regions";
    case "list_tap_links":
    case "create_tap_link":
      return "knowledge_links";
    default:
      return null;
  }
}
