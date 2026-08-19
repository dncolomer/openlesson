import type { PerformanceReport } from "@/lib/pow-api/performance-report";

export type KnowledgePanelView = "models" | "lwm" | "ranking" | "strengths_gaps";

export type KnowledgeGoalMode = "default" | "adhoc" | "selected";

export type LwmDetailTab =
  | "profile"
  | "goals"
  | "summary"
  | "markers"
  | "strengths"
  | "gaps"
  | "next_steps"
  | "details";

export interface SnapshotEligibility {
  allowed: boolean;
  message?: string;
  last_eval_at?: string | null;
  new_pow_count?: number | null;
}

export interface GoalCatalogItem {
  id: string;
  text: string;
  scope: "workspace" | "block";
  block_id?: string | null;
}

export interface OverlayDistance {
  knowledge_distance: number;
  cosine_similarity: number;
  cosine_distance: number;
  in_region: boolean;
  region_name: string;
  error?: string;
}

export interface KnowledgePanelChromeProps {
  workspaceId: string;
  currentUserId?: string | null;
  isOwner?: boolean;
  ayclToken?: string;
  lockSubjectToSelf?: boolean;
}

export interface KnowledgeModelsViewProps {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
  canInspectOthers: boolean;
  lockSubjectToSelf: boolean;
}

export interface KnowledgeLwmViewProps {
  workspaceId: string;
  currentUserId?: string | null;
  isOwner: boolean;
  ayclToken?: string;
  canInspectOthers: boolean;
  lockSubjectToSelf: boolean;
}

export interface KnowledgeRankingViewProps {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
  canInspectOthers: boolean;
}

export type { PerformanceReport };
