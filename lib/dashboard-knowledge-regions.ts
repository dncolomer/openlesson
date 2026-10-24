/**
 * Owner dashboard Knowledge regions: overlay models for Verification
 * and Calibration flows, listed without a workspace type.
 */

import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import { productRegionNewPath, productRegionPagePath } from "@/lib/product-flow";
import {
  workspaceProductShell,
  type WorkspaceProductShell,
} from "@/lib/workspace-kind";

export const DASHBOARD_KNOWLEDGE_REGIONS_PATH = "/api/dashboard/knowledge-regions";

export type DashboardKnowledgeRegionKind = "verification" | "calibration";

export type DashboardKnowledgeRegion = {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  workspaceTitle: string;
  subjectCount: number;
  createdAt: string;
};

export function parseDashboardKnowledgeRegionKind(
  value: unknown,
): DashboardKnowledgeRegionKind | null {
  if (value === "verification" || value === "calibration") return value;
  return null;
}

export function dashboardKnowledgeRegionHref(
  kind: DashboardKnowledgeRegionKind,
  regionId: string,
): string {
  return productRegionPagePath(kind, regionId);
}

export function dashboardKnowledgeRegionStudioHref(
  kind: DashboardKnowledgeRegionKind,
  regionId: string,
): string {
  return productRegionPagePath(kind, regionId);
}

export function dashboardKnowledgeRegionCreateHref(kind: DashboardKnowledgeRegionKind): string {
  return productRegionNewPath(kind);
}

export function presentDashboardKnowledgeRegions(
  workspaces: readonly {
    id?: unknown;
    title?: unknown;
    root_topic?: unknown;
    workspace_kind?: unknown;
  }[],
  regions: readonly {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    workspace_id?: unknown;
    subject_count?: unknown;
    created_at?: unknown;
    embedding_model_id?: unknown;
  }[],
  kind: DashboardKnowledgeRegionKind,
): DashboardKnowledgeRegion[] {
  const shell: WorkspaceProductShell = kind;
  const titleById = new Map<string, string>();
  for (const workspace of workspaces) {
    const id = String(workspace.id || "").trim();
    if (!id) continue;
    if (workspaceProductShell(workspace.workspace_kind) !== shell) continue;
    titleById.set(
      id,
      String(workspace.title || workspace.root_topic || "Workspace").trim() || "Workspace",
    );
  }

  const out: DashboardKnowledgeRegion[] = [];
  for (const region of regions) {
    const id = String(region.id || "").trim();
    const workspaceId = String(region.workspace_id || "").trim();
    const name = String(region.name || "").trim();
    if (!id || !workspaceId || !name) continue;
    if (String(region.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) continue;
    const workspaceTitle = titleById.get(workspaceId);
    if (!workspaceTitle) continue;
    const subjectCount = Number(region.subject_count);
    out.push({
      id,
      name,
      description:
        typeof region.description === "string" && region.description.trim()
          ? region.description.trim()
          : null,
      workspaceId,
      workspaceTitle,
      subjectCount: Number.isFinite(subjectCount) ? subjectCount : 0,
      createdAt: String(region.created_at || ""),
    });
  }

  return out.sort(
    (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
  );
}
