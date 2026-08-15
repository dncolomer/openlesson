/**
 * Workspace Settings → Data Studio: list / patch / bulk-invalidate PoW (owner-scoped).
 * Invalidation is metadata-only (invalidated: true).
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardWorkspaceRoute } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_POW_SELECT,
  mapProofOfWorkRow,
  proofOfWorkSummary,
} from "@/lib/admin/proof-of-work";
import {
  matchesStudioPowToSessionLink,
  parsePositiveInt,
  parseStudioSessionLinkInput,
  parseStudioSortDirection,
  sortStudioRows,
  type StudioResolvedSessionLink,
  type StudioSessionLinkKind,
} from "@/lib/admin/data-studio";
import { hashPrivateToken } from "@/lib/private-token";
import {
  buildStudioPowPatch,
  isInvalidatedPoWMetadata,
} from "@/lib/pow-api/studio-pow-mutate";

export const runtime = "nodejs";

/** Max candidates loaded for in-memory filters (link / search / invalidated). */
const POW_CANDIDATE_LIMIT = 500;

async function resolveSessionLinkFromToken(
  supabase: SupabaseClient,
  token: string,
  preferredKind: StudioSessionLinkKind | null,
  workspaceId: string,
): Promise<StudioResolvedSessionLink | null> {
  const tokenHash = hashPrivateToken(token);
  const tryKinds: StudioSessionLinkKind[] =
    preferredKind === "tap"
      ? ["tap", "ile", "tapbench"]
      : preferredKind === "ile"
        ? ["ile", "tap", "tapbench"]
        : preferredKind === "tapbench"
          ? ["tapbench", "tap", "ile"]
          : ["tap", "ile", "tapbench"];

  for (const kind of tryKinds) {
    if (kind === "tap") {
      const { data } = await supabase
        .from("workspace_tap_sessions")
        .select("id, workspace_id, status")
        .eq("private_token_hash", tokenHash)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data?.id) {
        return {
          kind: "tap",
          linkId: data.id as string,
          sessionId: data.id as string,
          workspaceId: (data.workspace_id as string | null) ?? workspaceId,
        };
      }
    } else if (kind === "ile") {
      const { data } = await supabase
        .from("workspace_ile_links")
        .select("id, workspace_id, session_id, status")
        .eq("private_token_hash", tokenHash)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data?.id) {
        return {
          kind: "ile",
          linkId: data.id as string,
          sessionId: (data.session_id as string | null) ?? null,
          workspaceId: (data.workspace_id as string | null) ?? workspaceId,
        };
      }
    } else {
      // TAPBench: public_token is stored plain; also try private hash
      const { data: byPublic } = await supabase
        .from("workspace_tapbench_links")
        .select("id, workspace_id, public_token")
        .eq("workspace_id", workspaceId)
        .eq("public_token", token)
        .maybeSingle();
      if (byPublic?.id) {
        return {
          kind: "tapbench",
          linkId: byPublic.id as string,
          sessionId: byPublic.id as string,
          workspaceId: (byPublic.workspace_id as string | null) ?? workspaceId,
        };
      }
      const { data: byHash } = await supabase
        .from("workspace_tapbench_links")
        .select("id, workspace_id, public_token")
        .eq("workspace_id", workspaceId)
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (byHash?.id) {
        return {
          kind: "tapbench",
          linkId: byHash.id as string,
          sessionId: byHash.id as string,
          workspaceId: (byHash.workspace_id as string | null) ?? workspaceId,
        };
      }
    }
  }
  return null;
}

/**
 * GET — list workspace PoW with filters: userId, guestUserId, link, search, page, pageSize,
 *       invalidated (all|yes|no), sort, order
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = (req.nextUrl.searchParams.get("workspaceId") || "").trim();
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 25, 100);
    const search = (req.nextUrl.searchParams.get("search") || "").trim();
    const userId = (req.nextUrl.searchParams.get("userId") || "").trim();
    const guestUserId = (req.nextUrl.searchParams.get("guestUserId") || "").trim();
    const linkInput = (
      req.nextUrl.searchParams.get("link") ||
      req.nextUrl.searchParams.get("token") ||
      ""
    ).trim();
    const invalidatedFilter = (req.nextUrl.searchParams.get("invalidated") || "all")
      .trim()
      .toLowerCase();
    const sortColumn =
      (req.nextUrl.searchParams.get("sort") || "created_at").trim() || "created_at";
    const sortOrder = parseStudioSortDirection(req.nextUrl.searchParams.get("order"), "desc");

    let resolved: StudioResolvedSessionLink | null = null;
    if (linkInput) {
      const parsed = parseStudioSessionLinkInput(linkInput);
      if (!parsed) {
        return jsonError(400, "Could not parse session link or token", "invalid_link");
      }
      resolved = await resolveSessionLinkFromToken(
        auth.supabase,
        parsed.token,
        parsed.kind,
        workspaceId,
      );
      if (!resolved) {
        return jsonError(404, "No guest link found for that token in this workspace", "not_found");
      }
    }

    // In-memory filters (link match, free-text search, invalidated metadata) require a
    // candidate set; always load up to POW_CANDIDATE_LIMIT then filter + paginate.
    // Simple path without those filters uses count:exact + range for accurate totals.
    const needsCandidateScan =
      Boolean(resolved) ||
      Boolean(search) ||
      invalidatedFilter === "yes" ||
      invalidatedFilter === "true" ||
      invalidatedFilter === "no" ||
      invalidatedFilter === "false";

    const mapItem = (row: Record<string, unknown>) => {
      const details = mapProofOfWorkRow(
        row as Parameters<typeof mapProofOfWorkRow>[0],
        null,
      );
      return {
        ...details,
        userId: (row.user_id as string | null) ?? null,
        guestUserId: (row.guest_user_id as string | null) ?? null,
        summary: proofOfWorkSummary(details),
        invalidated: isInvalidatedPoWMetadata(row.metadata),
      };
    };

    if (!needsCandidateScan) {
      // DB-paginated browse: accurate totalCount beyond 500.
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = auth.supabase
        .from("workspace_proof_of_work")
        .select(ADMIN_POW_SELECT, { count: "exact" })
        .eq("workspace_id", workspaceId)
        .order(sortColumn === "timestamp_ms" ? "timestamp_ms" : "created_at", {
          ascending: sortOrder === "asc",
          nullsFirst: false,
        });
      if (userId) query = query.eq("user_id", userId);
      if (guestUserId) query = query.eq("guest_user_id", guestUserId);

      const { data, count, error } = await query.range(from, to);
      if (error) {
        console.error("[workspace/data-studio/pow] list range", error);
        return jsonError(500, "Failed to load proof of work");
      }

      let rows = (data || []) as Record<string, unknown>[];
      if (
        sortColumn !== "created_at" &&
        sortColumn !== "when" &&
        sortColumn !== "timestamp_ms"
      ) {
        rows = sortStudioRows(
          rows,
          { column: sortColumn, direction: sortOrder },
          (row, col) => {
            if (col === "type" || col === "proof_of_work_type") return row.proof_of_work_type;
            if (col === "file_name") return row.file_name;
            if (col === "tool_name") return row.tool_name;
            return row[col];
          },
        );
      }

      const total = count || 0;
      return NextResponse.json({
        workspace_id: workspaceId,
        items: rows.map(mapItem),
        totalCount: total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        link_resolve: null,
        sample_capped: false,
      });
    }

    // Candidate scan path (link / search / invalidated): load up to 500 recent rows.
    let query = auth.supabase
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(POW_CANDIDATE_LIMIT);

    if (userId) query = query.eq("user_id", userId);
    if (guestUserId) query = query.eq("guest_user_id", guestUserId);

    const { data, error } = await query;
    if (error) {
      console.error("[workspace/data-studio/pow] list candidates", error);
      return jsonError(500, "Failed to load proof of work");
    }

    let rows = (data || []) as Record<string, unknown>[];
    const sampleCapped = rows.length >= POW_CANDIDATE_LIMIT;

    if (resolved) {
      rows = rows.filter((row) =>
        matchesStudioPowToSessionLink(
          {
            session_id: (row.session_id as string | null) ?? null,
            metadata: (row.metadata as Record<string, unknown> | null) ?? null,
          },
          resolved!,
        ),
      );
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) => {
        const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const hay = [
          row.file_name,
          row.tool_name,
          row.tool_action,
          row.device_name,
          row.proof_of_work_type,
          row.id,
          row.user_id,
          row.guest_user_id,
          JSON.stringify(meta),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (invalidatedFilter === "yes" || invalidatedFilter === "true") {
      rows = rows.filter((r) => isInvalidatedPoWMetadata(r.metadata));
    } else if (invalidatedFilter === "no" || invalidatedFilter === "false") {
      rows = rows.filter((r) => !isInvalidatedPoWMetadata(r.metadata));
    }

    const sorted = sortStudioRows(rows, { column: sortColumn, direction: sortOrder }, (row, col) => {
      if (col === "created_at") return row.created_at;
      if (col === "type" || col === "proof_of_work_type") return row.proof_of_work_type;
      if (col === "file_name") return row.file_name;
      if (col === "tool_name") return row.tool_name;
      return (row as Record<string, unknown>)[col];
    });

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(Math.max(1, page), totalPages);
    const slice = sorted.slice((p - 1) * pageSize, p * pageSize);

    return NextResponse.json({
      workspace_id: workspaceId,
      items: slice.map(mapItem),
      totalCount: total,
      page: p,
      pageSize,
      totalPages,
      link_resolve: resolved,
      /** True when in-memory filters only considered the latest POW_CANDIDATE_LIMIT rows. */
      sample_capped: sampleCapped,
    });
  } catch (err) {
    console.error("[workspace/data-studio/pow] GET", err);
    return jsonError(500, "Internal server error");
  }
}

/**
 * PATCH — edit metadata / tool fields and/or invalidate a single PoW row.
 * Body: { workspaceId, id, metadata?, tool_name?, tool_action?, file_name?, invalidate?, clearInvalidated? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!workspaceId || !id) {
      return jsonError(400, "workspaceId and id are required");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    // Writes use service role: RLS only has owner SELECT+INSERT on workspace_proof_of_work.
    const admin = createAdminClient();

    const { data: existing, error: loadErr } = await admin
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (loadErr || !existing) {
      return jsonError(404, "Proof of work not found");
    }

    const patch = buildStudioPowPatch(existing.metadata, {
      metadata: body.metadata,
      invalidate: body.invalidate === true,
      clearInvalidated: body.clearInvalidated === true,
      invalidateOptions: {
        by: auth.user.id,
        reason: typeof body.reason === "string" ? body.reason : null,
      },
      tool_name: body.tool_name,
      tool_action: body.tool_action,
      file_name: body.file_name,
    });

    const { data: updated, error: upErr } = await admin
      .from("workspace_proof_of_work")
      .update(patch.fields)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select(ADMIN_POW_SELECT)
      .single();

    if (upErr || !updated) {
      console.error("[workspace/data-studio/pow] PATCH", upErr);
      return jsonError(500, "Failed to update proof of work");
    }

    const details = mapProofOfWorkRow(updated as Parameters<typeof mapProofOfWorkRow>[0], null);
    return NextResponse.json({
      item: {
        ...details,
        userId: (updated as { user_id?: string | null }).user_id ?? null,
        guestUserId: (updated as { guest_user_id?: string | null }).guest_user_id ?? null,
        summary: proofOfWorkSummary(details),
        invalidated: isInvalidatedPoWMetadata(updated.metadata),
      },
    });
  } catch (err) {
    console.error("[workspace/data-studio/pow] PATCH", err);
    return jsonError(500, "Internal server error");
  }
}

/**
 * POST — bulk invalidate (or bulk clear).
 * Body: { workspaceId, ids: string[], action?: "invalidate" | "clear", reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [];
    if (!workspaceId || ids.length === 0) {
      return jsonError(400, "workspaceId and non-empty ids are required");
    }
    if (ids.length > 100) {
      return jsonError(400, "At most 100 ids per bulk request");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    // Writes use service role: RLS only has owner SELECT+INSERT on workspace_proof_of_work.
    const admin = createAdminClient();

    const action = body.action === "clear" ? "clear" : "invalidate";
    const { data: rows, error } = await admin
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT)
      .eq("workspace_id", workspaceId)
      .in("id", ids);

    if (error) {
      console.error("[workspace/data-studio/pow] bulk load", error);
      return jsonError(500, "Failed to load proof of work");
    }

    const updatedIds: string[] = [];
    const failed: string[] = [];

    for (const row of rows || []) {
      const patch = buildStudioPowPatch(row.metadata, {
        invalidate: action === "invalidate",
        clearInvalidated: action === "clear",
        invalidateOptions: {
          by: auth.user.id,
          reason: typeof body.reason === "string" ? body.reason : "bulk",
        },
      });
      const { error: upErr } = await admin
        .from("workspace_proof_of_work")
        .update({ metadata: patch.metadata })
        .eq("id", row.id)
        .eq("workspace_id", workspaceId);
      if (upErr) failed.push(String(row.id));
      else updatedIds.push(String(row.id));
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      action,
      updated_ids: updatedIds,
      failed_ids: failed,
      updated_count: updatedIds.length,
    });
  } catch (err) {
    console.error("[workspace/data-studio/pow] POST bulk", err);
    return jsonError(500, "Internal server error");
  }
}
