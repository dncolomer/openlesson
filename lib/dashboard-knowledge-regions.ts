/**
 * Owner dashboard Knowledge regions: overlay models for Verification
 * and Calibration flows, listed by owner_user_id.
 */

import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import { productFlowOwnerTitle, productRegionNewPath, productRegionPagePath } from "@/lib/product-flow";

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
  regions: readonly {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    workspace_id?: unknown;
    owner_user_id?: unknown;
    product?: unknown;
    subject_count?: unknown;
    created_at?: unknown;
    embedding_model_id?: unknown;
  }[],
  kind: DashboardKnowledgeRegionKind,
  ownerUserId: string,
): DashboardKnowledgeRegion[] {
  const owner = String(ownerUserId || "").trim();
  if (!owner) return [];
  const title = productFlowOwnerTitle(kind);
  const out: DashboardKnowledgeRegion[] = [];
  for (const region of regions) {
    const id = String(region.id || "").trim();
    const name = String(region.name || "").trim();
    if (!id || !name) continue;
    if (String(region.owner_user_id || "").trim() !== owner) continue;
    if (String(region.product || "") !== kind) continue;
    if (String(region.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) continue;
    const subjectCount = Number(region.subject_count);
    out.push({
      id,
      name,
      description:
        typeof region.description === "string" && region.description.trim()
          ? region.description.trim()
          : null,
      workspaceId: String(region.workspace_id || "").trim(),
      workspaceTitle: title,
      subjectCount: Number.isFinite(subjectCount) ? subjectCount : 0,
      createdAt: String(region.created_at || ""),
    });
  }

  return out.sort(
    (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
  );
}
