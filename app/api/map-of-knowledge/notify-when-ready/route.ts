import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import {
  parsePlacementLinkToken,
  registerMapNewsletterLead,
} from "@/lib/map-of-knowledge";

export const runtime = "nodejs";

/**
 * POST /api/map-of-knowledge/notify-when-ready
 * Capture email as Uncertain Systems newsletter lead (export for periodic campaigns).
 * Does not send transactional “map ready” email.
 *
 * Body: { email: string, link?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const linkRaw = typeof body.link === "string" ? body.link : "";
    const emailRaw = typeof body.email === "string" ? body.email : "";

    const supabase = createAdminClient();

    // Optional: resolve guest/workspace for lead message context (not required to subscribe).
    let guestUserId: string | null = null;
    let workspaceId: string | null = null;
    const token = parsePlacementLinkToken(linkRaw);
    if (token) {
      const tokenHash = hashPrivateToken(token);
      const { data: tapByPublic } = await supabase
        .from("workspace_tap_sessions")
        .select("workspace_id, guest_user_id")
        .eq("public_token", token)
        .maybeSingle();
      if (tapByPublic?.guest_user_id) {
        guestUserId = String(tapByPublic.guest_user_id);
        workspaceId = String(tapByPublic.workspace_id || "");
      } else {
        const { data: tapByHash } = await supabase
          .from("workspace_tap_sessions")
          .select("workspace_id, guest_user_id")
          .eq("private_token_hash", tokenHash)
          .maybeSingle();
        if (tapByHash?.guest_user_id) {
          guestUserId = String(tapByHash.guest_user_id);
          workspaceId = String(tapByHash.workspace_id || "");
        }
      }
    }

    const result = await registerMapNewsletterLead(supabase, {
      email: emailRaw,
      placement_link: linkRaw.trim().slice(0, 2000) || null,
      guest_user_id: guestUserId,
      workspace_id: workspaceId,
    });

    if (!result.ok) {
      const status = result.code === "invalid_email" ? 400 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      email: result.email,
      message: result.message,
    });
  } catch (error) {
    console.error("[api/map-of-knowledge/notify-when-ready]", error);
    return NextResponse.json(
      { ok: false, error: "Could not save your email. Please try again.", code: "server_error" },
      { status: 500 },
    );
  }
}
