import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import { parsePlacementLinkToken } from "@/lib/map-of-knowledge";

export const runtime = "nodejs";

/**
 * POST /api/map-of-knowledge/find-yourself
 * Resolve a saved placement session URL (or bare token) to guest + workspace
 * for Map of Knowledge Local overlay focus.
 *
 * Body: { link: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const linkRaw =
      typeof body.link === "string"
        ? body.link
        : typeof body.token === "string"
          ? body.token
          : "";
    const token = parsePlacementLinkToken(linkRaw);
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Paste a valid placement link (or session token).",
          code: "invalid_link",
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const tokenHash = hashPrivateToken(token);

    // TAP sessions (Map of Knowledge mint path)
    const { data: tapByPublic } = await supabase
      .from("workspace_tap_sessions")
      .select("id, workspace_id, block_id, guest_user_id, public_token, status")
      .eq("public_token", token)
      .maybeSingle();

    let session:
      | {
          workspace_id: string;
          block_id: string | null;
          guest_user_id: string | null;
          link_kind: "tap" | "ile";
        }
      | null = null;

    if (tapByPublic?.workspace_id) {
      session = {
        workspace_id: tapByPublic.workspace_id as string,
        block_id: (tapByPublic.block_id as string | null) ?? null,
        guest_user_id: (tapByPublic.guest_user_id as string | null) ?? null,
        link_kind: "tap",
      };
    } else {
      const { data: tapByHash } = await supabase
        .from("workspace_tap_sessions")
        .select("id, workspace_id, block_id, guest_user_id, status")
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (tapByHash?.workspace_id) {
        session = {
          workspace_id: tapByHash.workspace_id as string,
          block_id: (tapByHash.block_id as string | null) ?? null,
          guest_user_id: (tapByHash.guest_user_id as string | null) ?? null,
          link_kind: "tap",
        };
      }
    }

    // ILE fallback
    if (!session) {
      const { data: ileByPublic } = await supabase
        .from("workspace_ile_links")
        .select("id, workspace_id, block_id, guest_user_id, public_token")
        .eq("public_token", token)
        .maybeSingle();
      if (ileByPublic?.workspace_id) {
        session = {
          workspace_id: ileByPublic.workspace_id as string,
          block_id: (ileByPublic.block_id as string | null) ?? null,
          guest_user_id: (ileByPublic.guest_user_id as string | null) ?? null,
          link_kind: "ile",
        };
      } else {
        const { data: ileByHash } = await supabase
          .from("workspace_ile_links")
          .select("id, workspace_id, block_id, guest_user_id")
          .eq("private_token_hash", tokenHash)
          .maybeSingle();
        if (ileByHash?.workspace_id) {
          session = {
            workspace_id: ileByHash.workspace_id as string,
            block_id: (ileByHash.block_id as string | null) ?? null,
            guest_user_id: (ileByHash.guest_user_id as string | null) ?? null,
            link_kind: "ile",
          };
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "No session found for that link. Check you copied the full private URL.",
          code: "not_found",
        },
        { status: 404 },
      );
    }

    const guest = (session.guest_user_id || "").trim();
    if (!guest) {
      return NextResponse.json(
        {
          ok: false,
          error: "That link has no guest identity yet.",
          code: "not_found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      guest_user_id: guest,
      workspace_id: session.workspace_id,
      block_id: session.block_id,
      link_kind: session.link_kind,
    });
  } catch (error) {
    console.error("[api/map-of-knowledge/find-yourself]", error);
    return NextResponse.json(
      { ok: false, error: "Could not resolve placement link", code: "server_error" },
      { status: 500 },
    );
  }
}
