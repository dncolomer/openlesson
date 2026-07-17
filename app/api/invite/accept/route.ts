import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    const { data: invite, error } = await adminClient
      .from("organization_invites")
      .select(`
        id,
        token,
        used_by,
        used_at,
        organization:organizations(id, name, slug)
      `)
      .eq("token", token)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    const orgData = invite.organization;
    const org = Array.isArray(orgData) ? orgData[0] : orgData;

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.token,
        is_used: invite.used_by !== null,
        organization: org
          ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invite/accept - Accept an invite (transfers from personal/current org)
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Prefer RPC with transfer semantics; fall back to inline transfer if RPC missing
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "accept_organization_invite",
      {
        invite_token: token,
        accepting_user_id: user.id,
      }
    );

    if (!rpcError && rpcResult) {
      const result = rpcResult as {
        success?: boolean;
        error?: string;
        organization_id?: string;
        organization_name?: string;
        organization_slug?: string;
      };

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to accept invite" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        organization: {
          id: result.organization_id,
          name: result.organization_name,
          slug: result.organization_slug,
        },
      });
    }

    // Inline transfer fallback (same semantics as migration RPC)
    console.warn("accept_organization_invite RPC unavailable, using inline transfer:", rpcError);

    const { data: invite, error: inviteError } = await adminClient
      .from("organization_invites")
      .select(`
        id,
        organization_id,
        used_by,
        organization:organizations(id, name, slug)
      `)
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    if (invite.used_by) {
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (profile.organization_id === invite.organization_id) {
      await adminClient
        .from("organization_invites")
        .update({ used_by: user.id, used_at: new Date().toISOString() })
        .eq("id", invite.id);

      const orgData = invite.organization;
      const org = Array.isArray(orgData) ? orgData[0] : orgData;
      return NextResponse.json({
        success: true,
        organization: org
          ? { id: org.id, name: org.name, slug: org.slug }
          : null,
      });
    }

    const oldOrgId = profile.organization_id as string | null;

    if (oldOrgId) {
      await adminClient
        .from("profiles")
        .update({ organization_id: null, is_org_admin: false })
        .eq("id", user.id);

      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", oldOrgId);

      if ((count ?? 0) === 0) {
        await adminClient
          .from("organizations")
          .update({
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", oldOrgId)
          .eq("kind", "personal");
      }
    }

    const { error: updateInviteError } = await adminClient
      .from("organization_invites")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateInviteError) {
      return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
    }

    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update({ organization_id: invite.organization_id, is_org_admin: false })
      .eq("id", user.id);

    if (updateProfileError) {
      await adminClient
        .from("organization_invites")
        .update({ used_by: null, used_at: null })
        .eq("id", invite.id);
      return NextResponse.json({ error: "Failed to join organization" }, { status: 500 });
    }

    const orgData = invite.organization;
    const org = Array.isArray(orgData) ? orgData[0] : orgData;

    return NextResponse.json({
      success: true,
      organization: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
          }
        : null,
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
