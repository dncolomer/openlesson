/**
 * CRUD for workspace external Context resources (Dantes / add-link).
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  guardWorkspaceRoute,
  requireAuthenticatedUser,
} from "@/lib/api/require-auth";
import {
  normalizeExternalResourceCreate,
  normalizeExternalResourceList,
  normalizeExternalResourceRow,
  type ExternalResourceCreateInput,
} from "@/lib/workspace-external-resources";


export const runtime = "nodejs";

/**
 * List external sources. Read: owner, AYCL token, or public workspace (mirrors files GET).
 * Writes stay owner/AYCL via guardWorkspaceRoute.
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    // AYCL / owner path via guard (token or ownership)
    if (ayclToken) {
      const auth = await guardWorkspaceRoute(workspaceId, { ayclToken });
      if (!auth.ok) return auth.response;
      const { data, error } = await auth.supabase
        .from("workspace_external_resources")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[external-resources] list", error);
        // Migration not applied yet — empty list so Context UI still works.
        if (/schema cache|does not exist|workspace_external_resources/i.test(error.message || "")) {
          return NextResponse.json({
            resources: [],
            warning: "workspace_external_resources table missing — run npm run db:migrate",
          });
        }
        return jsonError(500, error.message);
      }
      return NextResponse.json({
        resources: normalizeExternalResourceList(data || []),
      });
    }

    // Cookie session: owner OR public workspace (same gate as files list).
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: plan } = await supabase
      .from("workspaces")
      .select("user_id, is_public")
      .eq("id", workspaceId)
      .single();

    if (!plan) {
      return jsonError(404, "Workspace not found");
    }
    if (plan.user_id !== user.id && !plan.is_public) {
      return jsonError(403, "Forbidden");
    }

    const { data, error } = await supabase
      .from("workspace_external_resources")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[external-resources] list", error);
      if (/schema cache|does not exist|workspace_external_resources/i.test(error.message || "")) {
        return NextResponse.json({
          resources: [],
          warning: "workspace_external_resources table missing — run npm run db:migrate",
        });
      }
      return jsonError(500, error.message);
    }

    return NextResponse.json({
      resources: normalizeExternalResourceList(data || []),
    });
  } catch (err) {
    console.error("[external-resources] GET", err);
    return jsonError(500, "Internal error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    // Batch create (create-flow / multi Dantes pick)
    const batch = Array.isArray(body.resources) ? body.resources : null;
    if (batch) {
      const rows = [];
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        if (!item || typeof item !== "object") continue;
        const normalized = normalizeExternalResourceCreate(
          item as ExternalResourceCreateInput,
        );
        if (!normalized) continue;
        rows.push({
          workspace_id: workspaceId,
          user_id: auth.persistUserId,
          ...normalized,
          sort_order: normalized.sort_order || i,
        });
      }
      if (rows.length === 0) {
        return jsonError(400, "No valid resources to create");
      }
      const { data, error } = await auth.supabase
        .from("workspace_external_resources")
        .insert(rows)
        .select("*");
      if (error) {
        console.error("[external-resources] batch insert", error);
        return jsonError(500, error.message);
      }
      return NextResponse.json({
        resources: normalizeExternalResourceList(data || []),
      });
    }

    const normalized = normalizeExternalResourceCreate({
      title: body.title as string | undefined,
      url: body.url as string | undefined,
      resource_type: (body.resource_type ?? body.resourceType ?? body.type) as
        | string
        | undefined,
      description: body.description as string | undefined,
      source: body.source as string | undefined,
      dantes_topic_slug: (body.dantes_topic_slug ?? body.dantesTopicSlug) as
        | string
        | undefined,
      meta: body.meta as Record<string, unknown> | undefined,
      sort_order: body.sort_order as number | undefined,
    });
    if (!normalized) {
      return jsonError(400, "Valid https URL is required");
    }

    const { data, error } = await auth.supabase
      .from("workspace_external_resources")
      .insert({
        workspace_id: workspaceId,
        user_id: auth.persistUserId,
        ...normalized,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[external-resources] insert", error);
      return jsonError(500, error.message);
    }

    return NextResponse.json({
      resource: normalizeExternalResourceRow(data),
    });
  } catch (err) {
    console.error("[external-resources] POST", err);
    return jsonError(500, "Internal error");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const resourceId =
      typeof body.resourceId === "string"
        ? body.resourceId.trim()
        : typeof body.id === "string"
          ? body.id.trim()
          : "";
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    if (!resourceId || !workspaceId) {
      return jsonError(400, "workspaceId and resourceId are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 240);
    if (typeof body.url === "string") {
      const url = body.url.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return jsonError(400, "Invalid URL");
      }
      patch.url = url.slice(0, 2048);
    }
    if (body.description !== undefined) {
      patch.description =
        typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
    }
    if (body.resource_type !== undefined || body.resourceType !== undefined) {
      const t = (body.resource_type ?? body.resourceType) as string | null;
      patch.resource_type =
        typeof t === "string" && t.trim() ? t.trim().slice(0, 64) : null;
    }
    if (body.meta && typeof body.meta === "object") patch.meta = body.meta;
    if (typeof body.sort_order === "number") patch.sort_order = Math.floor(body.sort_order);

    const { data, error } = await auth.supabase
      .from("workspace_external_resources")
      .update(patch)
      .eq("id", resourceId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error) {
      console.error("[external-resources] update", error);
      return jsonError(500, error.message);
    }

    return NextResponse.json({
      resource: normalizeExternalResourceRow(data),
    });
  } catch (err) {
    console.error("[external-resources] PATCH", err);
    return jsonError(500, "Internal error");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const resourceId =
      req.nextUrl.searchParams.get("resourceId")?.trim() ||
      req.nextUrl.searchParams.get("id")?.trim() ||
      "";
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!resourceId || !workspaceId) {
      return jsonError(400, "workspaceId and resourceId are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: req.nextUrl.searchParams.get("ayclToken"),
    });
    if (!auth.ok) return auth.response;

    const { error } = await auth.supabase
      .from("workspace_external_resources")
      .delete()
      .eq("id", resourceId)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("[external-resources] delete", error);
      return jsonError(500, error.message);
    }

    return NextResponse.json({ ok: true, deletedId: resourceId });
  } catch (err) {
    console.error("[external-resources] DELETE", err);
    return jsonError(500, "Internal error");
  }
}
