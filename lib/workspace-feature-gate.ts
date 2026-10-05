/**
 * Server gate for workspace-scoped routes. UI hiding is not the check.
 * A missing workspace returns null so the route can 404 on its own.
 */

import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  workspaceFeatureDeniedMessage,
  workspaceSupportsFeature,
  type WorkspaceFeature,
} from "@/lib/workspace-capabilities";

export function denyWorkspaceFeatureResponse(
  kind: unknown,
  feature: WorkspaceFeature,
): NextResponse | null {
  if (workspaceSupportsFeature(kind, feature)) return null;
  return jsonError(403, workspaceFeatureDeniedMessage(kind, feature), "forbidden");
}

export async function denyWorkspaceFeatureById(
  workspaceId: string,
  feature: WorkspaceFeature,
): Promise<NextResponse | null> {
  const id = workspaceId.trim();
  if (!id) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("workspace_kind")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return denyWorkspaceFeatureResponse(
    (data as { workspace_kind?: unknown }).workspace_kind,
    feature,
  );
}
