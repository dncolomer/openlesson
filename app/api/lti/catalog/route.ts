import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { organizationAdminUserId, organizationMemberIds } from "@/lib/lti/store";
import { listVerificationFlowsForOwnerUserId } from "@/lib/verification-flow-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function protocolsForOwners(ownerIds: readonly string[]) {
  const items: Array<{
    type: "protocol";
    id: string;
    name: string;
    challenge: string;
    publicToken: string;
  }> = [];
  for (const ownerId of ownerIds) {
    const verify = await listVerificationFlowsForOwnerUserId(ownerId);
    for (const flow of verify) {
      if (flow.publicToken) {
        items.push({
          type: "protocol",
          id: flow.id,
          name: flow.name,
          challenge: flow.topic,
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
    const protocols = await protocolsForOwners(ownerIds);
    const { data: regions } = ownerIds.length
      ? await createAdminClient()
          .from("knowledge_regions")
          .select("id, name, owner_user_id")
          .in("owner_user_id", ownerIds)
          .order("created_at", { ascending: false })
      : { data: [] as Array<Record<string, unknown>> };
    return NextResponse.json({
      protocols,
      regions: (regions || []).map((row) => ({
        type: "region" as const,
        id: String(row.id),
        name: String(row.name || "Knowledge region"),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load LTI catalog";
    return jsonError(500, message);
  }
}
