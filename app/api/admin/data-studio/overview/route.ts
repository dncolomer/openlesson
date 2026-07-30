import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  emptyStudioOverviewCounts,
  summarizeXaiOrgRows,
} from "@/lib/admin/data-studio";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/overview
 * Platform-wide counts for Data Studio KPIs.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const counts = emptyStudioOverviewCounts();

    const [
      powRes,
      kcRes,
      evalRes,
      regionsRes,
      wsRes,
      orgsRes,
    ] = await Promise.all([
      adminClient.from("workspace_proof_of_work").select("id", { count: "exact", head: true }),
      adminClient.from("knowledge_config_snapshots").select("id", { count: "exact", head: true }),
      adminClient.from("eval_run_history").select("id", { count: "exact", head: true }),
      adminClient.from("custom_verification_models").select("id", { count: "exact", head: true }),
      adminClient
        .from("workspaces")
        .select("id", { count: "exact", head: true })
        .neq("status", "archived"),
      adminClient
        .from("organizations")
        .select("xai_api_key_status, xai_collection_status"),
    ]);

    counts.proofOfWork = powRes.count || 0;
    counts.knowledgeConfigSnapshots = kcRes.count || 0;
    counts.evalRunHistory = evalRes.count || 0;
    counts.customRegions = regionsRes.count || 0;
    counts.workspaces = wsRes.count || 0;

    const xai = summarizeXaiOrgRows(orgsRes.data || []);
    counts.organizationsWithXaiKey = xai.organizationsWithXaiKey;
    counts.organizationsWithXaiCollection = xai.organizationsWithXaiCollection;

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("[admin/data-studio/overview]", error);
    return NextResponse.json({ error: "Failed to load Data Studio overview" }, { status: 500 });
  }
}
