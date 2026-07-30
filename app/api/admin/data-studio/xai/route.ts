import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { parsePositiveInt } from "@/lib/admin/data-studio";
import {
  getTeamApiKeyUsage,
  isXaiManagementConfigured,
} from "@/lib/xai-management";
import {
  ORG_LIST_SELECT,
  ORG_LIST_SELECT_NO_LOGO,
  isMissingLogoUrlColumn,
} from "@/lib/organization/org-select";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/xai
 * Org-linked xAI resource inventory (keys, collections, optional usage).
 *
 * Query:
 *   page, pageSize
 *   includeUsage=1 — fetch Management API usage for ready keys (slower)
 *   periodDays=30
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const page = parsePositiveInt(params.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(params.get("pageSize"), 50, 100);
    const includeUsage = params.get("includeUsage") === "1" || params.get("includeUsage") === "true";
    const periodDays = parsePositiveInt(params.get("periodDays"), 30, 366);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let orgs: Array<Record<string, unknown>> | null = null;
    let count: number | null = null;

    {
      const first = await adminClient
        .from("organizations")
        .select(ORG_LIST_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (first.error && isMissingLogoUrlColumn(first.error)) {
        const retry = await adminClient
          .from("organizations")
          .select(ORG_LIST_SELECT_NO_LOGO, { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);
        if (retry.error) {
          console.error("[admin/data-studio/xai]", retry.error);
          return NextResponse.json({ error: "Failed to load organization xAI data" }, { status: 500 });
        }
        orgs = (retry.data || []) as Array<Record<string, unknown>>;
        count = retry.count;
      } else if (first.error) {
        console.error("[admin/data-studio/xai]", first.error);
        return NextResponse.json({ error: "Failed to load organization xAI data" }, { status: 500 });
      } else {
        orgs = (first.data || []) as Array<Record<string, unknown>>;
        count = first.count;
      }
    }

    const managementConfigured = isXaiManagementConfigured();
    const end = new Date();
    const start = new Date(end.getTime() - periodDays * 86400000);

    const items = await Promise.all(
      (orgs || []).map(async (org) => {
        const str = (key: string) =>
          typeof org[key] === "string" ? (org[key] as string) : null;
        const base = {
          id: String(org.id),
          name: String(org.name ?? ""),
          slug: str("slug"),
          plan: str("plan"),
          billing_mode: str("billing_mode"),
          xai_api_key_id: str("xai_api_key_id"),
          xai_api_key_name: str("xai_api_key_name"),
          xai_api_key_status: str("xai_api_key_status"),
          xai_collection_id: str("xai_collection_id"),
          xai_collection_status: str("xai_collection_status"),
          usage: null as null | {
            available: boolean;
            totalUsd?: number;
            periodStart?: string;
            periodEnd?: string;
            error?: string;
          },
        };

        if (
          includeUsage &&
          managementConfigured &&
          base.xai_api_key_status === "ready" &&
          base.xai_api_key_id
        ) {
          try {
            const usage = await getTeamApiKeyUsage({
              apiKeyId: base.xai_api_key_id,
              start,
              end,
            });
            base.usage = {
              available: true,
              totalUsd: usage.totalUsd,
              periodStart: usage.periodStart,
              periodEnd: usage.periodEnd,
            };
          } catch (err) {
            base.usage = {
              available: false,
              error: err instanceof Error ? err.message : "Usage fetch failed",
            };
          }
        }

        return base;
      }),
    );

    // PoW rows with xAI file ids (sample of linked resources)
    const { data: powWithFiles, count: powFileCount } = await adminClient
      .from("workspace_proof_of_work")
      .select("id, workspace_id, xai_file_id, proof_of_work_type, file_name, created_at", {
        count: "exact",
      })
      .not("xai_file_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    const total = count || 0;
    return NextResponse.json({
      managementConfigured,
      items,
      page,
      pageSize,
      totalCount: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      periodDays,
      powWithXaiFiles: {
        total: powFileCount || 0,
        sample: powWithFiles || [],
      },
    });
  } catch (error) {
    console.error("[admin/data-studio/xai]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
