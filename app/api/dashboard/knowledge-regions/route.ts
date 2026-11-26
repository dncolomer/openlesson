/**
 * Owner dashboard: Knowledge regions for Protocols.
 * Create goes through region simulation, not attach-from-flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { presentDashboardKnowledgeRegions } from "@/lib/dashboard-knowledge-regions";
import { rejectedProtocolKind } from "@/lib/product-flow";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    if (rejectedProtocolKind(new URL(req.url).searchParams.get("kind"))) {
      return jsonError(400, "Only knowledge verification protocols are supported");
    }

    const { data: rows, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, name, description, subject_count, created_at, embedding_model_id",
      )
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ regions: [] });
    }

    return NextResponse.json({
      regions: presentDashboardKnowledgeRegions(rows || [], auth.user.id),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load knowledge regions";
    return jsonError(500, message);
  }
}

export async function POST() {
  return jsonError(400, "Regions are created by running a simulation");
}
