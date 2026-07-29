import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGuestPlacementResult,
  generateAnonymousGuestIdentity,
  validateGuestPlacement,
  type GuestLinkKind,
} from "@/lib/map-of-knowledge";
import {
  CreateTapLinkError,
  createWorkspaceTapLink,
} from "@/lib/pow-api/create-tap-link";
import {
  CreateIleLinkError,
  createWorkspaceIleLink,
} from "@/lib/pow-api/create-ile-link";
import type { AuthContext } from "@/lib/pow-api/types";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/** Timed Exploration durations offered on Map of Knowledge (minutes). */
const MAP_TIMED_EXPLORE_MINUTES = [5, 10, 30] as const;
const MAP_TIMED_EXPLORE_DEFAULT_MINUTES = 10;
/** Timed Drill durations offered on Map of Knowledge (minutes). */
const MAP_TIMED_DRILL_MINUTES = [15, 30, 45] as const;
const MAP_TIMED_DRILL_DEFAULT_MINUTES = 30;

function parseMapPlacementMinutes(
  value: unknown,
  product: "timed_explore" | "timed_drill" | null,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (product === "timed_drill") {
    if ((MAP_TIMED_DRILL_MINUTES as readonly number[]).includes(n)) return n;
    return MAP_TIMED_DRILL_DEFAULT_MINUTES;
  }
  if ((MAP_TIMED_EXPLORE_MINUTES as readonly number[]).includes(n)) return n;
  return MAP_TIMED_EXPLORE_DEFAULT_MINUTES;
}

/**
 * POST /api/map-of-knowledge/guest-link
 * Anonymous self-placement: mint a timed guest session (or legacy ILE) on a public workspace block.
 *
 * Body:
 * - workspace_id, block_id (required)
 * - link_kind: "tap" | "ile" (technical; map UI uses "tap" for both product options)
 * - interaction_kind?: "conversational" | "exercise" — TAP shell (Timed Exploration vs Timed Drill)
 * - placement_product?: "timed_explore" | "timed_drill" — product label echoed in response
 * - minutes?: 5 | 10 | 30 for Timed Exploration (default 10);
 *             15 | 30 | 45 for Timed Drill (default 30)
 * - guest_display_name?
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id.trim() : "";
    const blockId = typeof body.block_id === "string" ? body.block_id.trim() : "";
    const linkKind = (typeof body.link_kind === "string" ? body.link_kind.trim() : "") as GuestLinkKind;
    const interactionKindRaw =
      typeof body.interaction_kind === "string" ? body.interaction_kind.trim() : "";
    const interactionKind =
      interactionKindRaw === "exercise" ? "exercise" : "conversational";
    const placementProductRaw =
      typeof body.placement_product === "string" ? body.placement_product.trim() : "";
    const placementProduct =
      placementProductRaw === "timed_drill" || interactionKind === "exercise"
        ? "timed_drill"
        : placementProductRaw === "timed_explore" || linkKind === "tap"
          ? "timed_explore"
          : null;
    const minutes = parseMapPlacementMinutes(body.minutes, placementProduct);
    const guestNameRaw =
      typeof body.guest_display_name === "string" ? body.guest_display_name.trim() : "";

    const supabase = createAdminClient();

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, user_id, organization_id, is_public, title, root_topic, status, archived_at")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsError || !workspace) {
      return NextResponse.json({ error: "Workspace not found", code: "not_found" }, { status: 404 });
    }
    if (
      workspace.is_public !== true ||
      workspace.archived_at != null ||
      (typeof workspace.status === "string" &&
        workspace.status.trim() !== "" &&
        workspace.status !== "active")
    ) {
      return NextResponse.json(
        { error: "Workspace is not public", code: "not_public" },
        { status: 403 },
      );
    }

    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, workspace_id, title")
      .eq("workspace_id", workspaceId);

    const validation = validateGuestPlacement(
      { workspace_id: workspaceId, block_id: blockId, link_kind: linkKind },
      {
        workspaces: [{ id: workspace.id, is_public: true }],
        blocks: (blocks || []).map((b) => ({
          id: b.id as string,
          workspace_id: b.workspace_id as string,
        })),
      },
    );
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: validation.code === "block_not_found" ? 404 : 400 },
      );
    }

    const identity = generateAnonymousGuestIdentity();
    const guestDisplayName = guestNameRaw || identity.display_name;

    if (!workspace.user_id) {
      return NextResponse.json(
        { error: "Workspace owner is missing", code: "internal_error" },
        { status: 500 },
      );
    }

    const auth: AuthContext = {
      user_id: workspace.user_id,
      guest_user_id: null,
      organization_id: workspace.organization_id,
      is_org_admin: false,
      key_id: "map-of-knowledge",
      scopes: ["tap:write", "workspaces:write"],
    };

    const origin = baseUrl(req);

    if (linkKind === "tap") {
      const link = await createWorkspaceTapLink({
        supabase,
        auth,
        workspaceId,
        blockId,
        body: {
          minutes,
          participant_type: "anonymous",
          post_session: "show_results",
          interaction_kind: interactionKind,
        },
        baseUrl: origin,
        allowAnonymousForNonAdmin: true,
      });
      const result = buildGuestPlacementResult({
        link_kind: "tap",
        private_url: link.private_url,
        workspace_id: workspaceId,
        block_id: blockId,
        guest_display_name: guestDisplayName,
      });
      return NextResponse.json({
        ...result,
        interaction_kind: interactionKind,
        placement_product: placementProduct ?? "timed_explore",
        minutes,
      });
    }

    const link = await createWorkspaceIleLink({
      supabase,
      auth,
      workspaceId,
      blockId,
      body: {
        participant_type: "anonymous",
      },
      baseUrl: origin,
      allowAnonymousForNonAdmin: true,
    });
    const result = buildGuestPlacementResult({
      link_kind: "ile",
      private_url: link.private_url,
      workspace_id: workspaceId,
      block_id: blockId,
      guest_display_name: guestDisplayName,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CreateTapLinkError || error instanceof CreateIleLinkError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[api/map-of-knowledge/guest-link]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create guest link",
        code: "internal_error",
      },
      { status: 500 },
    );
  }
}
