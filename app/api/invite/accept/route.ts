import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findInviteByToken,
  inviteOrganization,
} from "@/lib/organization/find-invite";
import { acceptOrganizationInviteForUser } from "@/lib/organization/accept-invite";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/invite/accept?token=xxx - Get invite details
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return jsonError(400, "Token required");
    }

    const adminClient = getAdminClient();
    const invite = await findInviteByToken(adminClient, token);

    if (!invite) {
      return jsonError(404, "Invalid invite token");
    }

    const org = inviteOrganization(invite);

    return NextResponse.json({
      invite: {
        id: invite.id,
        // Do not echo stored placeholder/hash; client already has the secret token.
        token,
        is_used: invite.used_by !== null,
        organization: org
          ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
              logo_url: org.logo_url ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get invite error:", error);
    return jsonError(500, "Internal server error");
  }
}

// POST /api/invite/accept - Accept an invite (transfers from personal/current org)
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return jsonError(400, "Token required");
    }

    const adminClient = getAdminClient();
    const result = await acceptOrganizationInviteForUser(adminClient, token, user.id, {
      email: user.email,
    });

    if (!result.ok) {
      return jsonError(result.status, result.error);
    }

    return NextResponse.json({
      success: true,
      organization: result.organization,
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return jsonError(500, "Internal server error");
  }
}
