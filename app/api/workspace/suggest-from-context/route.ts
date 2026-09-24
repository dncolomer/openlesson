import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { assembleSuggestFromContextXaiMessages } from "@/lib/suggest-from-context";
import { normalizeSuggestFromKnowledgeResponse } from "@/lib/suggest-from-knowledge";
import { runSuggestFromKnowledgeModel } from "@/lib/run-suggest-from-knowledge-model";

/**
 * POST — Suggest from Context: xAI-backed author prompts grounded in
 * workspace Context materials (notes, file names, external resources).
 * Empty materials skip the model and return an error. No offline template.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_goal, description, notes")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }

    let files: Array<{ name: string; mime_type: string | null; excerpt: string | null }> =
      [];
    try {
      const { data: fileRows, error: fileError } = await supabase
        .from("workspace_files")
        .select("file_name, mime_type")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (fileError) {
        console.warn("suggest-from-context: files load failed", fileError);
      } else {
        files = (fileRows || []).map(
          (file: { file_name?: string | null; mime_type?: string | null }) => ({
            name: typeof file.file_name === "string" ? file.file_name : "",
            mime_type: file.mime_type ?? null,
            excerpt: null,
          }),
        );
      }
    } catch (err) {
      console.warn("suggest-from-context: files load failed", err);
      files = [];
    }

    let externalResources: Array<{
      title: string | null;
      url: string | null;
      description: string | null;
    }> = [];
    try {
      const { data: extRows, error: extError } = await supabase
        .from("workspace_external_resources")
        .select("title, url, description")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true })
        .limit(24);
      if (extError) {
        const msg = extError.message || "";
        if (!/schema cache|does not exist|workspace_external_resources/i.test(msg)) {
          console.warn("suggest-from-context: external resources load failed", extError);
        }
      } else {
        externalResources = (extRows || []).map(
          (row: {
            title?: string | null;
            url?: string | null;
            description?: string | null;
          }) => ({
            title: row.title ?? null,
            url: row.url ?? null,
            description: row.description ?? null,
          }),
        );
      }
    } catch (err) {
      console.warn("suggest-from-context: external resources load failed", err);
      externalResources = [];
    }

    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(Math.trunc(body.limit), 8))
        : 4;

    const assembled = assembleSuggestFromContextXaiMessages(
      {
        notes: (workspace as { notes?: string | null }).notes,
        files,
        externalResources,
      },
      {
        surface: body.surface,
        draftPrompt: body.draftPrompt ?? body.topic ?? body.prompt,
        workspaceTitle: workspace.title || workspace.root_topic,
        workspaceGoal:
          (workspace as { workspace_goal?: string | null }).workspace_goal ||
          workspace.description,
        limit,
      },
    );

    if (assembled.empty) {
      return jsonError(
        422,
        "No workspace context yet. Add notes, files, or links in Context.",
      );
    }

    const modelResult = await runSuggestFromKnowledgeModel(assembled, {
      model: typeof body.model === "string" ? body.model : undefined,
    });
    if (!modelResult.ok) {
      return jsonError(
        502,
        modelResult.error ||
          "Failed to generate context suggestions (xAI unavailable or empty response)",
      );
    }

    const suggestions = normalizeSuggestFromKnowledgeResponse(modelResult.data, {
      limit,
    });

    if (suggestions.length === 0) {
      return jsonError(502, "Model returned no usable author prompts");
    }

    return NextResponse.json({
      ok: true,
      suggestions,
    });
  } catch (err) {
    console.error("suggest-from-context", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
