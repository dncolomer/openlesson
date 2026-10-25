import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  callXaiJSON,
  callXaiResponses,
  capXaiFileAttachments,
  DEFAULT_MODEL,
  parseJsonLoose,
  systemMessage,
  userMessage,
  type ResponsesInputContent,
} from "@/lib/xai-client";
import { buildHeliosMapBuilderSystemPrompt } from "@/lib/prompt-kernel";
import {
  formatHeliosMapSnapshotForPrompt,
  heliosMapSnapshotFromBlocks,
  heliosMapSnapshotFromUnknown,
  parseHeliosMapChatModelTurn,
  type HeliosMapBlock,
} from "@/lib/workspace-helios-tools";
import {
  formatHeliosMapSelectionForPrompt,
  heliosMapSelectionFromUnknown,
} from "@/lib/workspace-helios-selection";
import {
  formatHeliosWorkspaceMapTypesForPrompt,
  heliosWorkspaceMapTypesFromUnknown,
} from "@/lib/workspace-helios-expertise";
import {
  capHeliosAttachedFiles,
  formatHeliosFilesForPrompt,
  heliosFileIsImage,
  parseHeliosAttachedFiles,
  parseHeliosWorkspaceFileNames,
} from "@/lib/workspace-helios-files";
import {
  organizationIdFromWorkspace,
  resolveOrgXaiApiKey,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";
import { parseLearnerMapNotes } from "@/lib/learner-map-notes";
import { parseAnnotationLayers } from "@/lib/map-annotation-layers";

type HeliosMapChatBody = {
  reply: string;
  toolCalls?: unknown;
  tool_calls?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "").trim();
    const userPrompt = String(body.userPrompt || body.prompt || "").trim();
    if (!workspaceId || !userPrompt) {
      return jsonError(400, "workspaceId and userPrompt are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const { data: nodes } = await supabase
      .from("blocks")
      .select(
        "id,title,description,position_x,position_y,span_w,span_h,shape_cells,next_block_ids,lock_until_block_ids,creator_effects,planning_prompt",
      )
      .eq("workspace_id", workspaceId);

    const { data: plan } = await supabase
      .from("workspaces")
      .select("unusable_cells,title,root_topic")
      .eq("id", workspaceId)
      .maybeSingle();

    const live = heliosMapSnapshotFromUnknown(body.snapshot);
    const snapshot =
      live ||
      heliosMapSnapshotFromBlocks({
        blocks: ((nodes || []) as HeliosMapBlock[]).filter(
          (n) => n && n.id && n.position_x != null && n.position_y != null,
        ),
        unusableCells: Array.isArray(plan?.unusable_cells)
          ? (plan.unusable_cells as Array<{ row: number; col: number }>)
          : [],
        notes: parseLearnerMapNotes(body.notes),
        annotationLayers: parseAnnotationLayers(body.annotationLayers),
      });

    const history = Array.isArray(body.messages)
      ? (body.messages as Array<{ role?: string; content?: string }>)
          .map((m) => `${m.role === "assistant" ? "Helios" : "Author"}: ${String(m.content || "")}`)
          .join("\n")
      : "";

    const capped = capHeliosAttachedFiles(
      parseHeliosAttachedFiles(body.files),
      parseHeliosWorkspaceFileNames(
        body.workspaceFileNames ?? body.workspace_file_names,
      ),
    );
    let organizationId: string | null = null;
    const fileIds: string[] = [];
    const images: Array<{ mimeType: string; data: string }> = [];
    if (capped.workspace.length > 0) {
      const fileRows: Array<{ file_name?: string | null; xai_file_id?: string | null }> = [];
      const wanted = new Set(capped.workspace);
      for (const row of fileRows || []) {
        const name = String(row.file_name || "").trim();
        if (!wanted.has(name)) continue;
        const xaiId = String(row.xai_file_id || "").trim();
        if (xaiId) fileIds.push(xaiId);
      }
    }
    for (const file of capped.local) {
      if (heliosFileIsImage(file.mimeType)) {
        images.push({ mimeType: file.mimeType, data: file.data });
        continue;
      }
      if (!organizationId) {
        organizationId = await organizationIdFromWorkspace(supabase, workspaceId);
      }
      try {
        const uploaded = await uploadOrgScopedXaiFile(
          file.name,
          file.mimeType,
          file.data,
          {
            organizationId,
            collectionFields: {
              workspace_id: workspaceId,
              user_id: auth.persistUserId,
            },
          },
        );
        if (uploaded.file_id) fileIds.push(uploaded.file_id);
      } catch (err) {
        console.error(`[helios-map-chat] xAI upload failed for "${file.name}":`, err);
      }
    }

    const user = [
      `Workspace: ${String(plan?.title || plan?.root_topic || workspaceId)}`,
      formatHeliosMapSelectionForPrompt(
        heliosMapSelectionFromUnknown(body.selection),
        snapshot,
      ),
      formatHeliosWorkspaceMapTypesForPrompt(
        heliosWorkspaceMapTypesFromUnknown(body.mapTypes ?? body.map_types),
      ),
      capped.local.length > 0 || capped.workspace.length > 0
        ? formatHeliosFilesForPrompt({
            attached: capped.local,
            workspaceNames: capped.workspace,
          })
        : "",
      formatHeliosMapSnapshotForPrompt(snapshot),
      history ? `CONVERSATION:\n${history}` : "",
      `Author: ${userPrompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const system = buildHeliosMapBuilderSystemPrompt();
    const model = String(body.model || DEFAULT_MODEL);
    let parsedSource: unknown = null;
    if (fileIds.length > 0 || images.length > 0) {
      if (!organizationId) {
        organizationId = await organizationIdFromWorkspace(supabase, workspaceId);
      }
      const orgApiKey = await resolveOrgXaiApiKey(organizationId);
      const content: ResponsesInputContent[] = [{ type: "input_text", text: user }];
      for (const fileId of capXaiFileAttachments(fileIds)) {
        content.push({ type: "input_file", file_id: fileId });
      }
      for (const image of images) {
        content.push({
          type: "input_image",
          image_url: `data:${image.mimeType};base64,${image.data}`,
        });
      }
      const ai = await callXaiResponses<HeliosMapChatBody>({
        model,
        instructions: system,
        input: [{ role: "user", content }],
        maxOutputTokens: 4000,
        temperature: 0.3,
        ...(orgApiKey ? { apiKey: orgApiKey } : {}),
      });
      if (!ai.success) {
        return jsonError(502, ai.error || "Helios map chat failed");
      }
      const loose = parseJsonLoose<HeliosMapChatBody>(ai.text || "");
      parsedSource = loose.ok ? loose.data : { reply: ai.text || "" };
    } else {
      const ai = await callXaiJSON<HeliosMapChatBody>(
        [systemMessage(system), userMessage(user)],
        {
          model,
          maxTokens: 4000,
          temperature: 0.3,
        },
      );
      if (!ai.success || !ai.data) {
        return jsonError(502, ai.error || "Helios map chat failed");
      }
      parsedSource = ai.data;
    }

    const parsed = parseHeliosMapChatModelTurn(parsedSource);
    return NextResponse.json({
      reply: parsed.reply || "Done.",
      toolCalls: parsed.toolCalls,
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Helios map chat failed",
    );
  }
}
