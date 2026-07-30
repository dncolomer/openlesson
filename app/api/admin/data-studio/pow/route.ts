import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  ADMIN_POW_SELECT,
  mapProofOfWorkRow,
  proofOfWorkSummary,
} from "@/lib/admin/proof-of-work";
import { parsePositiveInt } from "@/lib/admin/data-studio";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/pow
 * Platform-wide proof-of-work browse (admin service role).
 *
 * Query: page, pageSize, workspaceId, type, search
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

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = adminClient
      .from("workspace_proof_of_work")
      .select(ADMIN_POW_SELECT, { count: "exact" })
      .order("created_at", { ascending: false });

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

    const workspaceIds = [
      ...new Set((data || []).map((r) => r.workspace_id).filter(Boolean) as string[]),
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

    const items = (data || []).map((row) => {
      const details = mapProofOfWorkRow(
        row,
        row.workspace_id ? titleMap.get(row.workspace_id) || null : null,
      );
      return {
        ...details,
        xaiFileId: (row as { xai_file_id?: string | null }).xai_file_id ?? null,
        userId: (row as { user_id?: string | null }).user_id ?? null,
        summary: proofOfWorkSummary(details),
      };
    });

    const total = count || 0;
    return NextResponse.json({
      items,
      page,
      pageSize,
      totalCount: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("[admin/data-studio/pow]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
