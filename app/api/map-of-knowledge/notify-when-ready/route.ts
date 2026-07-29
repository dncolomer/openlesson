import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import {
  parsePlacementLinkToken,
  registerMapReadyNotifyRequest,
} from "@/lib/map-of-knowledge";

export const runtime = "nodejs";

/**
 * POST /api/map-of-knowledge/notify-when-ready
 * Register an email to notify when a placement guest appears on the public map.
 *
 * Body: { link: string, email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const linkRaw = typeof body.link === "string" ? body.link : "";
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const token = parsePlacementLinkToken(linkRaw);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Paste a valid placement link first.", code: "invalid_link" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const tokenHash = hashPrivateToken(token);

    let guestUserId: string | null = null;
    let workspaceId: string | null = null;

    const { data: tapByPublic } = await supabase
      .from("workspace_tap_sessions")
      .select("workspace_id, guest_user_id, public_token")
      .eq("public_token", token)
      .maybeSingle();

    if (tapByPublic?.workspace_id && tapByPublic.guest_user_id) {
      guestUserId = String(tapByPublic.guest_user_id);
      workspaceId = String(tapByPublic.workspace_id);
    } else {
      const { data: tapByHash } = await supabase
        .from("workspace_tap_sessions")
        .select("workspace_id, guest_user_id")
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (tapByHash?.workspace_id && tapByHash.guest_user_id) {
        guestUserId = String(tapByHash.guest_user_id);
        workspaceId = String(tapByHash.workspace_id);
      }
    }

    if (!guestUserId || !workspaceId) {
      const { data: ileByPublic } = await supabase
        .from("workspace_ile_links")
        .select("workspace_id, guest_user_id")
        .eq("public_token", token)
        .maybeSingle();
      if (ileByPublic?.workspace_id && ileByPublic.guest_user_id) {
        guestUserId = String(ileByPublic.guest_user_id);
        workspaceId = String(ileByPublic.workspace_id);
      } else {
        const { data: ileByHash } = await supabase
          .from("workspace_ile_links")
          .select("workspace_id, guest_user_id")
          .eq("private_token_hash", tokenHash)
          .maybeSingle();
        if (ileByHash?.workspace_id && ileByHash.guest_user_id) {
          guestUserId = String(ileByHash.guest_user_id);
          workspaceId = String(ileByHash.workspace_id);
        }
      }
    }

    if (!guestUserId || !workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "No session found for that link. Check you copied the full private URL.",
          code: "not_found",
        },
        { status: 404 },
      );
    }

    const result = await registerMapReadyNotifyRequest(supabase, {
      email: emailRaw,
      guest_user_id: guestUserId,
      workspace_id: workspaceId,
      placement_link: linkRaw.trim().slice(0, 2000),
    });

    if (!result.ok) {
      const status = result.code === "invalid_email" ? 400 : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      email: result.email,
      message:
        "We will email you when your Map of Knowledge location is ready. Keep your session link for Find yourself.",
    });
  } catch (error) {
    console.error("[api/map-of-knowledge/notify-when-ready]", error);
    return NextResponse.json(
      { ok: false, error: "Could not register notification", code: "server_error" },
      { status: 500 },
    );
  }
}
