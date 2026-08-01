import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/require-admin";
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

async function resolveSessionLinkFromToken(
  adminClient: SupabaseClient,
  token: string,
  preferredKind: StudioSessionLinkKind | null,
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
      const { data } = await adminClient
        .from("workspace_tap_sessions")
        .select("id, workspace_id, status")
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (data?.id) {
        return {
          kind: "tap",
          linkId: data.id as string,
          // TAP guest links use the link row id as the session identity on PoW.
          sessionId: data.id as string,
          workspaceId: (data.workspace_id as string | null) ?? null,
        };
      }
    } else if (kind === "ile") {
      const { data } = await adminClient
        .from("workspace_ile_links")
        .select("id, workspace_id, session_id, status")
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (data?.id) {
        return {
          kind: "ile",
          linkId: data.id as string,
          sessionId: (data.session_id as string | null) ?? null,
          workspaceId: (data.workspace_id as string | null) ?? null,
        };
      }
    } else {
      const { data: byPublic } = await adminClient
        .from("workspace_tapbench_links")
        .select("id, workspace_id, public_token")
        .eq("public_token", token)
        .maybeSingle();
      if (byPublic?.id) {
        return {
          kind: "tapbench",
          linkId: byPublic.id as string,
          sessionId: byPublic.id as string,
          workspaceId: (byPublic.workspace_id as string | null) ?? null,
        };
      }
      const { data: byHash } = await adminClient
        .from("workspace_tapbench_links")
        .select("id, workspace_id, public_token")
        .eq("private_token_hash", tokenHash)
        .maybeSingle();
      if (byHash?.id) {
        return {
          kind: "tapbench",
          linkId: byHash.id as string,
          sessionId: byHash.id as string,
          workspaceId: (byHash.workspace_id as string | null) ?? null,
        };
      }
    }
  }
  return null;
}

async function fetchPowByMetadata(
  adminClient: SupabaseClient,
  workspaceId: string | null,
  contains: Record<string, string>,
) {
  let q = adminClient
    .from("workspace_proof_of_work")
    .select(ADMIN_POW_SELECT)
    .contains("metadata", contains)
    .order("created_at", { ascending: false })
    .limit(500);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data } = await q;
  return data || [];
}

/**
 * GET /api/admin/data-studio/pow
 * Platform-wide proof-of-work browse (admin service role).
 *
 * Query: page, pageSize, workspaceId, type, search, link (TAP/ILE URL or token),
 *        sort, order (asc|desc)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(params.get("pageSize"), 25, 100);
    const workspaceId = (params.get("workspaceId") || "").trim();
    const type = (params.get("type") || "").trim();
    const search = (params.get("search") || "").trim();
    const linkInput = (params.get("link") || params.get("token") || "").trim();
    const sortColumn = (params.get("sort") || "created_at").trim() || "created_at";
    const sortOrder = parseStudioSortDirection(params.get("order"), "desc");

    let resolved: StudioResolvedSessionLink | null = null;
    if (linkInput) {
      const parsed = parseStudioSessionLinkInput(linkInput);
      if (!parsed) {
        return NextResponse.json(
          { error: "Could not parse TAP/ILE session link or token", code: "invalid_link" },
          { status: 400 },
        );
      }
      resolved = await resolveSessionLinkFromToken(adminClient, parsed.token, parsed.kind);
      if (!resolved) {
        return NextResponse.json(
          { error: "No TAP or ILE guest link found for that token", code: "not_found" },
          { status: 404 },
        );
      }
    }

    // When filtering by link, fetch a larger candidate set then match + paginate in memory
    // (metadata JSON filters are incomplete for legacy stamps).
    if (resolved) {
      const candidateLimit = 500;
      let query = adminClient
        .from("workspace_proof_of_work")
        .select(ADMIN_POW_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(candidateLimit);

      if (resolved.workspaceId) {
        query = query.eq("workspace_id", resolved.workspaceId);
      }
      if (type) query = query.eq("proof_of_work_type", type);

      // Prefer session_id / link id when present to shrink the candidate set.
      const orParts: string[] = [];
      if (resolved.sessionId) {
        orParts.push(`session_id.eq.${resolved.sessionId}`);
      }
      if (resolved.linkId && resolved.linkId !== resolved.sessionId) {
        orParts.push(`session_id.eq.${resolved.linkId}`);
      }
      if (orParts.length > 0) {
        query = query.or(orParts.join(","));
      }

      const { data, error } = await query;
      if (error) {
        console.error("[admin/data-studio/pow] link query", error);
        return NextResponse.json({ error: "Failed to load proof of work" }, { status: 500 });
      }

      // Also pull rows matched only via metadata (source_link_id / legacy stamps).
      const metaRows = resolved.linkId
        ? [
            ...(await fetchPowByMetadata(adminClient, resolved.workspaceId, {
              source_link_id: resolved.linkId,
            })),
            ...(resolved.kind === "tap"
              ? await fetchPowByMetadata(adminClient, resolved.workspaceId, {
                  tap_session_id: resolved.linkId,
                })
              : await fetchPowByMetadata(adminClient, resolved.workspaceId, {
                  ile_link_id: resolved.linkId,
                })),
          ]
        : [];

      const byId = new Map<string, Record<string, unknown>>();
      for (const row of [...(data || []), ...metaRows]) {
        if (row && typeof row === "object" && "id" in row && row.id) {
          byId.set(String(row.id), row as Record<string, unknown>);
        }
      }

      const matched = Array.from(byId.values()).filter((row) =>
        matchesStudioPowToSessionLink(
          {
            session_id: (row.session_id as string | null) ?? null,
            metadata: (row.metadata as Record<string, unknown> | null) ?? null,
          },
          resolved!,
        ),
      );

      const filtered = matched.filter((row) => {
        if (search) {
          const q = search.toLowerCase();
          const hay = [row.file_name, row.tool_name, row.device_name, row.proof_of_work_type]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const sorted = sortStudioRows(
        filtered,
        { column: sortColumn, direction: sortOrder },
        (row, col) => {
          switch (col) {
            case "created_at":
            case "when":
              return row.created_at;
            case "type":
            case "proof_of_work_type":
              return row.proof_of_work_type;
            case "file_name":
            case "summary":
              return row.file_name;
            case "workspace_id":
              return row.workspace_id;
            case "timestamp_ms":
              return row.timestamp_ms;
            default:
              return row[col];
          }
        },
      );

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const from = (safePage - 1) * pageSize;
      const pageRows = sorted.slice(from, from + pageSize);

      const workspaceIds = [
        ...new Set(
          pageRows
            .map((r) => r.workspace_id)
            .filter((id): id is string => typeof id === "string" && Boolean(id)),
        ),
      ];
      const titleMap = new Map<string, string>();
      if (workspaceIds.length > 0) {
        const { data: workspaces } = await adminClient
          .from("workspaces")
          .select("id, title, root_topic")
          .in("id", workspaceIds);
        for (const ws of workspaces || []) {
          titleMap.set(ws.id, (ws.title || ws.root_topic || ws.id) as string);
        }
      }

      const items = pageRows.map((row) => {
        const details = mapProofOfWorkRow(
          row as Parameters<typeof mapProofOfWorkRow>[0],
          typeof row.workspace_id === "string"
            ? titleMap.get(row.workspace_id) || null
            : null,
        );
        return {
          ...details,
          xaiFileId: (row.xai_file_id as string | null | undefined) ?? null,
          userId: (row.user_id as string | null | undefined) ?? null,
          guestUserId: (row.guest_user_id as string | null | undefined) ?? null,
          summary: proofOfWorkSummary(details),
          invalidated: isInvalidatedPoWMetadata(row.metadata),
        };
      });

      return NextResponse.json({
        items,
        page: safePage,
        pageSize,
        totalCount: total,
        totalPages,
        link_resolve: {
          kind: resolved.kind,
          link_id: resolved.linkId,
          session_id: resolved.sessionId,
          workspace_id: resolved.workspaceId,
        },
      });
    }

    // Default browse path (no link filter)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = adminClient
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT, { count: "exact" })
      .order(sortColumn === "timestamp_ms" ? "timestamp_ms" : "created_at", {
        ascending: sortOrder === "asc",
        nullsFirst: false,
      });

    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (type) query = query.eq("proof_of_work_type", type);
    if (search) {
      query = query.or(
        `file_name.ilike.%${search}%,tool_name.ilike.%${search}%,device_name.ilike.%${search}%`,
      );
    }

    const { data, count, error } = await query.range(from, to);
    if (error) {
      console.error("[admin/data-studio/pow]", error);
      return NextResponse.json({ error: "Failed to load proof of work" }, { status: 500 });
    }

    let rows = data || [];
    // Client-friendly secondary sort for type/summary when requested (current page)
    if (sortColumn !== "created_at" && sortColumn !== "when" && sortColumn !== "timestamp_ms") {
      rows = sortStudioRows(rows, { column: sortColumn, direction: sortOrder }, (row, col) => {
        switch (col) {
          case "type":
          case "proof_of_work_type":
            return row.proof_of_work_type;
          case "file_name":
          case "summary":
            return row.file_name;
          case "workspace_id":
            return row.workspace_id;
          default:
            return (row as Record<string, unknown>)[col];
        }
      });
    }

    const workspaceIds = [
      ...new Set(rows.map((r) => r.workspace_id).filter(Boolean) as string[]),
    ];
    const titleMap = new Map<string, string>();
    if (workspaceIds.length > 0) {
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id, title, root_topic")
        .in("id", workspaceIds);
      for (const ws of workspaces || []) {
        titleMap.set(ws.id, (ws.title || ws.root_topic || ws.id) as string);
      }
    }

    const items = rows.map((row) => {
      const details = mapProofOfWorkRow(
        row as Parameters<typeof mapProofOfWorkRow>[0],
        row.workspace_id ? titleMap.get(row.workspace_id as string) || null : null,
      );
      return {
        ...details,
        xaiFileId: (row as { xai_file_id?: string | null }).xai_file_id ?? null,
        userId: (row as { user_id?: string | null }).user_id ?? null,
        guestUserId: (row as { guest_user_id?: string | null }).guest_user_id ?? null,
        summary: proofOfWorkSummary(details),
        invalidated: isInvalidatedPoWMetadata(row.metadata),
      };
    });

    const total = count || 0;
    return NextResponse.json({
      items,
      page,
      pageSize,
      totalCount: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      link_resolve: null,
    });
  } catch (error) {
    console.error("[admin/data-studio/pow]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH — edit metadata / tool fields and/or invalidate a single PoW row (admin).
 * Body: { id, metadata?, tool_name?, tool_action?, file_name?, invalidate?, clearInvalidated?, reason? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: existing, error: loadErr } = await adminClient
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !existing) {
      return NextResponse.json({ error: "Proof of work not found" }, { status: 404 });
    }

    const patch = buildStudioPowPatch(existing.metadata, {
      metadata: body.metadata,
      invalidate: body.invalidate === true,
      clearInvalidated: body.clearInvalidated === true,
      invalidateOptions: {
        by: user?.id ?? "admin",
        reason: typeof body.reason === "string" ? body.reason : null,
      },
      tool_name: body.tool_name,
      tool_action: body.tool_action,
      file_name: body.file_name,
    });

    const { data: updated, error: upErr } = await adminClient
      .from("workspace_proof_of_work")
      .update(patch.fields)
      .eq("id", id)
      .select(ADMIN_POW_SELECT)
      .single();

    if (upErr || !updated) {
      console.error("[admin/data-studio/pow] PATCH", upErr);
      return NextResponse.json({ error: "Failed to update proof of work" }, { status: 500 });
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
  } catch (error) {
    console.error("[admin/data-studio/pow] PATCH", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — bulk invalidate / clear (admin).
 * Body: { ids: string[], action?: "invalidate" | "clear", reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: "At most 200 ids per bulk request" }, { status: 400 });
    }

    const action = body.action === "clear" ? "clear" : "invalidate";
    const { data: rows, error } = await adminClient
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT)
      .in("id", ids);

    if (error) {
      console.error("[admin/data-studio/pow] bulk load", error);
      return NextResponse.json({ error: "Failed to load proof of work" }, { status: 500 });
    }

    const updatedIds: string[] = [];
    const failed: string[] = [];

    for (const row of rows || []) {
      const patch = buildStudioPowPatch(row.metadata, {
        invalidate: action === "invalidate",
        clearInvalidated: action === "clear",
        invalidateOptions: {
          by: user?.id ?? "admin",
          reason: typeof body.reason === "string" ? body.reason : "bulk",
        },
      });
      const { error: upErr } = await adminClient
        .from("workspace_proof_of_work")
        .update({ metadata: patch.metadata })
        .eq("id", row.id);
      if (upErr) failed.push(String(row.id));
      else updatedIds.push(String(row.id));
    }

    return NextResponse.json({
      action,
      updated_ids: updatedIds,
      failed_ids: failed,
      updated_count: updatedIds.length,
    });
  } catch (error) {
    console.error("[admin/data-studio/pow] POST bulk", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
