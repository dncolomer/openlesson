import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { organizationAdminUserId, organizationMemberIds } from "@/lib/lti/store";
import { listCalibrationFlowsForOwnerUserId } from "@/lib/calibration-flow-repository";
import { listSolveFlowsForOwnerUserId } from "@/lib/solve-flow-repository";
import { listVerificationFlowsForOwnerUserId } from "@/lib/verification-flow-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDashboardKnowledgeRegionKind } from "@/lib/dashboard-knowledge-regions";
import type { ProductFlowKind } from "@/lib/product-flow";

export const runtime = "nodejs";

async function flowsForOwners(ownerIds: readonly string[]) {
  const items: Array<{
    type: "flow";
    id: string;
    name: string;
    kind: ProductFlowKind;
    publicToken: string;
  }> = [];
  for (const ownerId of ownerIds) {
    const [solve, verify, calibrate] = await Promise.all([
      listSolveFlowsForOwnerUserId(ownerId),
      listVerificationFlowsForOwnerUserId(ownerId),
      listCalibrationFlowsForOwnerUserId(ownerId),
    ]);
    for (const flow of solve) {
      if (flow.publicToken) {
        items.push({
          type: "flow",
          id: flow.id,
          name: flow.name,
          kind: "solve",
          publicToken: flow.publicToken,
        });
      }
    }
    for (const flow of verify) {
      if (flow.publicToken) {
        items.push({
          type: "flow",
          id: flow.id,
          name: flow.name,
          kind: "verification",
          publicToken: flow.publicToken,
        });
      }
    }
    for (const flow of calibrate) {
      if (flow.publicToken) {
        items.push({
          type: "flow",
          id: flow.id,
          name: flow.name,
          kind: "calibration",
          publicToken: flow.publicToken,
        });
      }
    }
  }
  return items;
}

export async function GET() {
  try {
    const session = await readLtiLaunchSession();
    if (!session?.instructor) return jsonError(403, "Instructor launch required");
    const members = await organizationMemberIds(session.organizationId);
    const adminId = await organizationAdminUserId(session.organizationId);
    const ownerIds = members.length ? members : adminId ? [adminId] : [];
    const flows = await flowsForOwners(ownerIds);
    const { data: regions } = ownerIds.length
      ? await createAdminClient()
          .from("knowledge_regions")
          .select("id, name, product, owner_user_id")
          .in("owner_user_id", ownerIds)
          .order("created_at", { ascending: false })
      : { data: [] as Array<Record<string, unknown>> };
    return NextResponse.json({
      flows,
      regions: (regions || []).map((row) => ({
        type: "region" as const,
        id: String(row.id),
        name: String(row.name || "Knowledge region"),
        kind: parseDashboardKnowledgeRegionKind(row.product) || "solve",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load LTI catalog";
    return jsonError(500, message);
  }
}
