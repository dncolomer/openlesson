/**
 * Shared Map of Knowledge payload and layout types.
 * Stored MapDotKind ids stay "tap" | "ile" | "standard".
 */

import type { EmbeddingModelInfo } from "./embedding-catalog";

export type MapDotKind = "tap" | "ile" | "standard";

export interface MapPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface MapUserLocation {
  id: string;
  workspace_id: string;
  workspace_title: string;
  subject_label: string;
  /** Short user/guest id preview for map labels (e.g. first 6 hex chars). */
  id_preview: string;
  kind: MapDotKind;
  /** STEM mini avatar catalog id (explicit or deterministically assigned). */
  avatar_id: string;
  /** Public path for the mini avatar asset. */
  avatar_path: string;
  /** Full guest subject UUID when known (for Find yourself matching). */
  subject_guest_user_id?: string | null;
  /** Full user subject UUID when known. */
  subject_user_id?: string | null;
  vector: number[];
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface MapRegion {
  id: string;
  workspace_id: string;
  workspace_title: string;
  name: string;
  vector: number[];
  x: number;
  y: number;
  z: number;
  radius: number;
  enabled_default?: boolean;
}

export interface MapPublicWorkspace {
  id: string;
  title: string;
  root_topic: string;
  description: string | null;
  cover_image_url: string | null;
  /** Always true for payload rows from the public map loader. */
  is_public: boolean;
  block_count: number;
  region_count: number;
  user_point_count: number;
}

export interface MapPublicBlock {
  id: string;
  workspace_id: string;
  title: string;
  is_start: boolean;
}

export interface MapAggregatedPowStats {
  workspace_count: number;
  total_artifacts: number;
  unique_sessions: number;
  unique_blocks: number;
  last_24h: number;
  last_7d: number;
  by_type: Array<{ type: string; count: number }>;
}

export interface MapOfKnowledgePayload {
  title: string;
  workspaces: MapPublicWorkspace[];
  blocks: MapPublicBlock[];
  regions: MapRegion[];
  user_locations: MapUserLocation[];
  pow_stats: MapAggregatedPowStats;
  generated_at: string;
  /** Active embedding model for this payload (points + regions filtered to it). */
  embedding_model_id: string;
  /** Catalog + discovered models available across public workspaces. */
  embedding_models: EmbeddingModelInfo[];
  /** Explainer for the selected model (dims, hybrid structure, comparability). */
  embedding_info: EmbeddingModelInfo;
}

export interface PublicWorkspaceRaw {
  id: string;
  title: string | null;
  root_topic: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_public: boolean;
  status?: string | null;
  archived_at?: string | null;
}

export interface PublicBlockRaw {
  id: string;
  workspace_id: string;
  title: string | null;
  is_start?: boolean | null;
}

export interface PublicRegionRaw {
  id: string;
  workspace_id: string;
  name: string;
  centroid: number[];
  mean_radius?: number | null;
  embedding_model_id?: string | null;
  dim?: number | null;
}

export interface PublicUserPointRaw {
  id: string;
  workspace_id: string;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  vector: number[];
  confidence?: number | null;
  /** When known from guest metadata / participant type. */
  kind?: MapDotKind | null;
  embedding_model_id?: string | null;
  dim?: number | null;
}

export interface PublicPowWorkspaceStatsRaw {
  workspace_id: string;
  total_artifacts: number;
  unique_sessions: number;
  unique_blocks: number;
  last_24h: number;
  last_7d: number;
  by_type?: Array<{ type: string; count: number }>;
}

/** Workspace-grouped region list for Map of Knowledge collapsible toggles. */
export type MapRegionWorkspaceGroup<T extends {
  id: string;
  workspace_id: string;
  workspace_title: string;
  name: string;
} = MapRegion> = {
  workspace_id: string;
  workspace_title: string;
  regions: T[];
};

export type DefaultRegionPickResult = {
  /** Region ids enabled by default (all from `workspace_id`). */
  regionIds: string[];
  /** Workspace that was randomly selected as the default highlight source. */
  workspace_id: string | null;
};
