import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInviteToken,
  hashInviteToken,
  inviteTokenStoragePlaceholder,
} from "@/lib/organization/invite-token";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// POST /api/organization/invites - Create invite token(s) (org admin only)
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonError(404, "Profile not found");
    }

    if (!profile.organization_id) {
      return jsonError(400, "You don't belong to an organization");
    }

    if (!profile.is_org_admin) {
      return jsonError(403, "Only org admins can create invites");
    }

    const { count = 1 } = await request.json();

    // Limit to max 50 invites at once
    const inviteCount = Math.min(Math.max(1, count), 50);

    const adminClient = getAdminClient();

    // Generate invites: store hash at rest; return plaintext once.
    const pending: Array<{ plaintext: string; row: Record<string, unknown> }> = [];
    for (let i = 0; i < inviteCount; i++) {
      const plaintext = createInviteToken();
      const tokenHash = hashInviteToken(plaintext);
      pending.push({
        plaintext,
        row: {
          organization_id: profile.organization_id,
          token: inviteTokenStoragePlaceholder(tokenHash),
          token_hash: tokenHash,
          created_by: user.id,
        },
      });
    }

    const { data: createdInvites, error } = await adminClient
      .from("organization_invites")
      .insert(pending.map((p) => p.row))
      .select("id, organization_id, created_by, used_by, used_at, created_at, token_hash");

    if (error) {
      console.error("Error creating invites:", error);
      return jsonError(500, "Failed to create invites");
    }

    // Map returned rows back to one-time plaintext tokens by hash.
    const hashToPlain = new Map(pending.map((p) => [p.row.token_hash as string, p.plaintext]));
    const invites = (createdInvites || []).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      created_by: row.created_by,
      used_by: row.used_by,
      used_at: row.used_at,
      created_at: row.created_at,
      // One-time secret for sharing; not stored as plaintext.
      token: hashToPlain.get(row.token_hash as string) || null,
    }));

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Create invites error:", error);
    return jsonError(500, "Internal server error");
  }
}

// DELETE /api/organization/invites - Revoke an unused invite (org admin only)
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonError(404, "Profile not found");
    }

    if (!profile.organization_id) {
      return jsonError(400, "You don't belong to an organization");
    }

    if (!profile.is_org_admin) {
      return jsonError(403, "Only org admins can revoke invites");
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return jsonError(400, "Invite ID required");
    }

    const adminClient = getAdminClient();

    // Only delete if unused and belongs to this org
    const { error } = await adminClient
      .from("organization_invites")
      .delete()
      .eq("id", inviteId)
      .eq("organization_id", profile.organization_id)
      .is("used_by", null);

    if (error) {
      console.error("Error deleting invite:", error);
      return jsonError(500, "Failed to revoke invite");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke invite error:", error);
    return jsonError(500, "Internal server error");
  }
}
