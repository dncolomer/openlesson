/**
 * Workspace Settings no longer mounts knowledge-region create.
 * Regions are created from the dashboard simulation for Solve, Verification,
 * or Calibration.
 */

export interface KnowledgeRegionListItem {
  id: string;
  name: string;
  description: string | null;
  subject_count: number;
  cosine_threshold: number;
  cohort_cohesion: number;
  mean_radius: number;
  embedding_model_id: string;
  centroid: number[];
  created_at: string;
  workspace_id?: string;
  workspace_title?: string;
  imported?: boolean;
}

export function CustomVerificationModelsPanel(_props: {
  workspaceId: string;
  currentUserId: string | null;
  ayclToken?: string;
  verificationWorkspace?: boolean;
  knowledgeFlowKind?: "calibrate" | "verify" | null;
  onRegionsChange?: (regions: KnowledgeRegionListItem[]) => void;
}) {
  return null;
}
