/**
 * Owner dashboard Knowledge regions: overlay models for Protocols,
 * listed by owner_user_id.
 */

import { FLOW_EMBEDDING_PATH_TEXT_MODEL_ID } from "@/lib/flow-embedding";
import {
  productFlowOwnerTitle,
  productRegionEditPath,
  productRegionNewPath,
  productRegionPagePath,
} from "@/lib/product-flow";

export const DASHBOARD_KNOWLEDGE_REGIONS_PATH = "/api/dashboard/knowledge-regions";

export function dashboardKnowledgeRegionSimulationPath(regionId: string): string {
  const id = String(regionId || "").trim();
  return id
    ? `${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/${encodeURIComponent(id)}/simulation`
    : `${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/simulation`;
}

export type DashboardKnowledgeRegion = {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  workspaceTitle: string;
  subjectCount: number;
  createdAt: string;
};

export function dashboardKnowledgeRegionHref(regionId: string): string {
  return productRegionPagePath(regionId);
}

export function dashboardKnowledgeRegionEditHref(regionId: string): string {
  return productRegionEditPath(regionId);
}

export function dashboardKnowledgeRegionCreateHref(): string {
  return productRegionNewPath();
}

export function presentDashboardKnowledgeRegions(
  regions: readonly {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    workspace_id?: unknown;
    owner_user_id?: unknown;
    subject_count?: unknown;
    created_at?: unknown;
    embedding_model_id?: unknown;
  }[],
  ownerUserId: string,
): DashboardKnowledgeRegion[] {
  const owner = String(ownerUserId || "").trim();
  if (!owner) return [];
  const out: DashboardKnowledgeRegion[] = [];
  for (const region of regions) {
    const id = String(region.id || "").trim();
    const name = String(region.name || "").trim();
    if (!id || !name) continue;
    if (String(region.owner_user_id || "").trim() !== owner) continue;
    if (String(region.embedding_model_id || "") === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID) continue;
    if (String(region.description || "").includes("region-simulation-cluster:")) continue;
    const subjectCount = Number(region.subject_count);
    out.push({
      id,
      name,
      description:
        typeof region.description === "string" && region.description.trim()
          ? region.description.trim()
          : null,
      workspaceId: String(region.workspace_id || "").trim(),
      workspaceTitle: productFlowOwnerTitle(),
      subjectCount: Number.isFinite(subjectCount) ? subjectCount : 0,
      createdAt: String(region.created_at || ""),
    });
  }

  return out.sort(
    (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
  );
}
