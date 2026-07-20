import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { callXaiJSON, callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import type { Message, MessageContent } from "@/lib/xai-client";
import { uploadFileToXAI, deleteFileFromXAI } from "@/lib/xai-files";
import { callXaiResponses, type ResponsesInputContent } from "@/lib/xai-client";
import { checkWorkspaceCreation, workspaceLimitErrorResponse } from "@/lib/workspace-limits";
import { resolveUserBilling } from "@/lib/organization/resolve-user-billing";
import {
  getInitialChaptersBand,
  resolveInitialChaptersFromBody,
} from "@/lib/initial-chapters";
import {
  composeWorkspacePlanGeneratePrompt,
  normalizeGeneratedPlanNodes,
} from "@/lib/workspace-spatial-create";
import {
  extractGeneratedPlanNodes,
  insertGeneratedWorkspaceBlocks,
} from "@/lib/insert-workspace-blocks";
import {
  blankWorkspaceCreateOutcome,
  composeDantesResourceContext,
  composeFilesGoalCreatePrompt,
  composeTemplateCreatePrompt,
  composeTemplateWorkspaceNotes,
  goalFieldsFromPrompt,
  parseWorkspaceCreateMode,
  type WorkspaceCreateMode,
} from "@/lib/workspace-create-modes";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_PLAN = 5;

interface AttachedFile {
  name: string;
  mimeType: string;
  data: string; // base64
}

interface NodeData {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next?: string[];
  position_x?: number;
  position_y?: number;
}

interface PlanData {
  title: string;
  nodes: NodeData[];
}

// xAI JSON schema for plan generation (used by Responses API)
const PLAN_JSON_SCHEMA = {
  name: "learning_plan",
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, catchy plan title (max 6 words)" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Short ID like 'a', 'b', 'c'" },
            title: { type: "string", description: "Node title (3-8 words)" },
            description: { type: "string", description: "1 sentence explaining the concept" },
            is_start: { type: "boolean" },
            next: { type: "array", items: { type: "string" } },
            position_x: { type: "integer", description: "Grid column (may be negative); start at 0" },
            position_y: { type: "integer", description: "Grid row (may be negative); start at 0" },
          },
          // Positions preferred but optional — normalize + radial backfill handle gaps.
          required: ["id", "title", "description", "is_start"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "nodes"],
    additionalProperties: false,
  },
};

// Result of processing one attached file
interface ProcessedFile {
  name: string;
  mimeType: string;
  size: number;
  xaiFileId: string | null;
  base64: string; // retained for image inlining (images go through chat completions image_url)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json();
    const { topic, days, image, files: rawFiles, goal: goalBody } = body;
    const createMode: WorkspaceCreateMode =
      parseWorkspaceCreateMode(body.createMode ?? body.create_mode) || "files_goal";
    const initialChapters = resolveInitialChaptersFromBody(body);
    const band = getInitialChaptersBand(initialChapters);

    // ── Blank: empty workspace, zero blocks ──────────────────────────
    if (createMode === "blank") {
      const blankOutcome = blankWorkspaceCreateOutcome();
      const billing = await resolveUserBilling(supabase, user.id);
      if ("error" in billing) {
        return NextResponse.json({ error: billing.error }, { status: 500 });
      }
      const workspaceCheck = await checkWorkspaceCreation(
        supabase,
        user.id,
        billing.userProfile,
      );
      if (!workspaceCheck.allowed) {
        return NextResponse.json(workspaceLimitErrorResponse(workspaceCheck), { status: 403 });
      }

      const { data: plan, error: planError } = await supabase
        .from("workspaces")
        .insert({
          user_id: user.id,
          title: "Blank workspace",
          root_topic: "Blank workspace",
          status: "active",
          source_type: "topic",
          notes: "",
        })
        .select()
        .single();

      if (planError || !plan) {
        return NextResponse.json({ error: "Failed to create blank workspace" }, { status: 500 });
      }

      return NextResponse.json({
        workspaceId: plan.id,
        title: plan.title,
        createMode: blankOutcome.mode,
        blockCount: blankOutcome.blocks.length,
      });
    }

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const billing = await resolveUserBilling(supabase, user.id);
    if ("error" in billing) {
      return NextResponse.json({ error: billing.error }, { status: 500 });
    }

    const workspaceCheck = await checkWorkspaceCreation(
      supabase,
      user.id,
      billing.userProfile
    );

    if (!workspaceCheck.allowed) {
      return NextResponse.json(workspaceLimitErrorResponse(workspaceCheck), { status: 403 });
    }

    const hasImage = image && typeof image.data === "string" && typeof image.mimeType === "string";

    // Validate and normalize attached files
    const attachedFiles: AttachedFile[] = [];
    if (Array.isArray(rawFiles)) {
      for (const f of rawFiles.slice(0, MAX_FILES_PER_PLAN)) {
        if (!f.name || !f.mimeType || !f.data) continue;
        if (!ALLOWED_MIME_TYPES.has(f.mimeType)) continue;
        const buf = Buffer.from(f.data, "base64");
        if (buf.length > MAX_FILE_SIZE) continue;
        attachedFiles.push({ name: f.name, mimeType: f.mimeType, data: f.data });
      }
    }

    // Upload all attached files to xAI in parallel
    const processedFiles: ProcessedFile[] = await Promise.all(
      attachedFiles.map(async (f): Promise<ProcessedFile> => {
        const buf = Buffer.from(f.data, "base64");
        let xaiFileId: string | null = null;
        try {
          const uploaded = await uploadFileToXAI(f.name, f.mimeType, f.data);
          xaiFileId = uploaded.file_id;
        } catch (err) {
          console.error(`[generate] xAI upload failed for "${f.name}":`, err);
        }
        return {
          name: f.name,
          mimeType: f.mimeType,
          size: buf.length,
          xaiFileId,
          base64: f.data,
        };
      })
    );

    const daysNum = typeof days === "number" ? days : 30;

    // Partition uploaded files into image-files (handled via chat completions multimodal)
    // vs document-files (handled via Responses API + input_file)
    const imageFiles = processedFiles.filter(pf => pf.mimeType.startsWith("image/"));
    const docFiles = processedFiles.filter(pf => !pf.mimeType.startsWith("image/") && pf.xaiFileId);

    const hasImageContent = hasImage || imageFiles.length > 0;
    const hasDocFiles = docFiles.length > 0;

    const imageContext = hasImageContent
      ? `\nThe user has provided an image. Analyze it and incorporate its content into the learning plan alongside the topic "${topic}".`
      : "";

    let fileContext = hasDocFiles
      ? `\nThe user has attached ${docFiles.length} document(s) as reference material. Search and analyze them, then incorporate their content into the plan alongside the topic "${topic}".`
      : "";

    // Template mode: selected resources as generation context (+ persisted notes later)
    let templateNotes: string | null = null;
    if (createMode === "template") {
      const dantesTopic =
        body.dantesTopic && typeof body.dantesTopic === "object"
          ? (body.dantesTopic as { name?: string; slug?: string; description?: string | null })
          : null;
      const dantesResources = Array.isArray(body.dantesResources) ? body.dantesResources : [];
      const topicName =
        (typeof dantesTopic?.name === "string" && dantesTopic.name) || topic;
      const resourceItems = dantesResources.map((r: Record<string, unknown>) => ({
        title: typeof r.title === "string" ? r.title : "Resource",
        type: typeof r.type === "string" ? r.type : undefined,
        url: typeof r.url === "string" ? r.url : undefined,
        description: typeof r.description === "string" ? r.description : null,
        difficulty: typeof r.difficulty === "string" ? r.difficulty : undefined,
      }));
      fileContext =
        composeDantesResourceContext(topicName, resourceItems) + (fileContext || "");
      templateNotes = composeTemplateWorkspaceNotes(topicName, resourceItems, {
        topicDescription:
          typeof dantesTopic?.description === "string" ? dantesTopic.description : null,
      });
    }

    const goalPromptText =
      typeof goalBody === "string" && goalBody.trim()
        ? goalBody.trim()
        : typeof topic === "string"
          ? topic.trim()
          : "";

    const promptBody =
      createMode === "files_goal"
        ? composeFilesGoalCreatePrompt({
            goalPrompt: goalPromptText,
            initialChapters,
            fileContext: `${imageContext}${fileContext}`,
            daysHint: daysNum,
          })
        : createMode === "template"
          ? composeTemplateCreatePrompt({
              topicName: topic,
              dantesContext: `${imageContext}${fileContext}`,
              initialChapters,
              daysHint: daysNum,
            })
          : composeWorkspacePlanGeneratePrompt({
              topic,
              initialChapters,
              imageContext,
              fileContext,
              daysHint: daysNum,
            });
    const maxTokens = Math.min(5000, 1600 + band.max * 140);

    let planData: PlanData | null = null;

    // ─────────────────────────────────────────────────────────────────
    // Path A: Documents attached → Responses API + input_file references.
    //         Grok auto-activates attachment_search and reads the docs.
    // ─────────────────────────────────────────────────────────────────
    if (hasDocFiles) {
      const content: ResponsesInputContent[] = [{ type: "input_text", text: promptBody }];
      for (const pf of docFiles) {
        content.push({ type: "input_file", file_id: pf.xaiFileId! });
      }
      // If the user also attached images, include them inline as input_image
      if (hasImage) {
        content.push({
          type: "input_image",
          image_url: `data:${image.mimeType};base64,${image.data}`,
        });
      }
      for (const img of imageFiles) {
        content.push({
          type: "input_image",
          image_url: `data:${img.mimeType};base64,${img.base64}`,
        });
      }

      const response = await callXaiResponses<PlanData>({
        model: DEFAULT_MODEL,
        input: [{ role: "user", content }],
        maxOutputTokens: maxTokens,
        temperature: 0.3,
        jsonSchema: PLAN_JSON_SCHEMA,
      });

      if (!response.success || !response.data) {
        console.error("[generate] Responses API error:", response.error, "text:", response.text?.slice(0, 500));
        await rollbackXaiUploads(processedFiles);
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }

      planData = response.data;
    }
    // ─────────────────────────────────────────────────────────────────
    // Path B: Image only (no docs) → Chat Completions with image_url.
    //         Use plain text response and extract JSON manually because
    //         response_format + multimodal can be flaky on some models.
    // ─────────────────────────────────────────────────────────────────
    else if (hasImageContent) {
      const contentParts: MessageContent[] = [{ type: "text", text: promptBody }];
      if (hasImage) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.data}` },
        });
      }
      for (const img of imageFiles) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }

      const messages: Message[] = [{ role: "user", content: contentParts }];
      const textResponse = await callXaiText(messages, {
        model: DEFAULT_MODEL,
        maxTokens,
        temperature: 0.3,
      });

      if (!textResponse.success || !textResponse.data) {
        console.error("[generate] Chat (image) error:", textResponse.error);
        await rollbackXaiUploads(processedFiles);
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }

      const raw = textResponse.data;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[0]) as PlanData;
        } catch {
          const cleaned = jsonMatch[0]
            .replace(/[\x00-\x1F\x7F]/g, " ")
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");
          try {
            planData = JSON.parse(cleaned) as PlanData;
          } catch {
            console.error("[generate] Failed to parse JSON from image response:", raw.substring(0, 500));
            await rollbackXaiUploads(processedFiles);
            return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
          }
        }
      } else {
        console.error("[generate] No JSON in image response:", raw.substring(0, 500));
        await rollbackXaiUploads(processedFiles);
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }
    }
    // ─────────────────────────────────────────────────────────────────
    // Path C: Plain text → Chat Completions JSON.
    // ─────────────────────────────────────────────────────────────────
    else {
      const response = await callXaiJSON<PlanData>([userMessage(promptBody)], {
        model: DEFAULT_MODEL,
        maxTokens,
        temperature: 0.3,
      });

      if (!response.success || !response.data) {
        console.error("[generate] Chat error:", response.error);
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }

      planData = response.data;
    }

    const rawNodes = extractGeneratedPlanNodes(planData);
    const nodeRefs = normalizeGeneratedPlanNodes(rawNodes);

    if (nodeRefs.length === 0) {
      console.error("[generate] LLM returned no usable nodes:", {
        hasNodes: Array.isArray((planData as PlanData | null)?.nodes),
        hasBlocks: Array.isArray((planData as { blocks?: unknown })?.blocks),
        title: (planData as PlanData | null)?.title,
      });
      await rollbackXaiUploads(processedFiles);
      return NextResponse.json({ error: "Invalid plan data format" }, { status: 500 });
    }

    const catchyTitle = (planData as PlanData | null)?.title || `Learning ${topic}`;

    // Files+Goal: persist prompt as Goal. Template: notes = linked resource list (selected cards).
    const goalFields =
      createMode === "files_goal"
        ? goalFieldsFromPrompt(goalPromptText)
        : createMode === "template"
          ? {
              root_topic: topic.slice(0, 160),
              notes: templateNotes || composeTemplateWorkspaceNotes(topic, []),
              workspace_goal: null as string | null,
            }
          : {
              root_topic: topic.slice(0, 160),
              notes: null as string | null,
              workspace_goal: null as string | null,
            };

    // Create workspace only after we have a valid node list
    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .insert({
        user_id: user.id,
        title: catchyTitle,
        root_topic: goalFields.root_topic || topic,
        status: "active",
        source_type: createMode === "template" ? "topic" : "topic",
        notes: goalFields.notes,
        workspace_goal: goalFields.workspace_goal,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      await rollbackXaiUploads(processedFiles);
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
    }

    try {
      await insertGeneratedWorkspaceBlocks(supabase, plan.id, nodeRefs);
    } catch (insertError) {
      console.error("[generate] Block insert failed; rolling back workspace:", insertError);
      await supabase.from("workspaces").delete().eq("id", plan.id);
      await rollbackXaiUploads(processedFiles);
      return NextResponse.json(
        {
          error:
            insertError instanceof Error
              ? insertError.message
              : "Failed to create workspace blocks",
        },
        { status: 500 },
      );
    }

    // Persist workspace_files records (already uploaded to xAI above)
    const fileStorageWarnings: string[] = [];
    for (const pf of processedFiles) {
      if (!pf.xaiFileId) {
        fileStorageWarnings.push(`${pf.name}: xAI upload failed`);
        continue;
      }
      const { error: insertError } = await supabase.from("workspace_files").insert({
        workspace_id: plan.id,
        user_id: user.id,
        file_name: pf.name,
        file_size: pf.size,
        mime_type: pf.mimeType,
        xai_file_id: pf.xaiFileId,
      });
      if (insertError) {
        console.error(`[generate] workspace_files insert error for "${pf.name}":`, insertError.message);
        fileStorageWarnings.push(`${pf.name}: ${insertError.message}`);
        await deleteFileFromXAI(pf.xaiFileId).catch(() => {});
      }
    }

    if (fileStorageWarnings.length > 0) {
      console.warn(`[generate] File storage warnings:`, fileStorageWarnings);
    }

    return NextResponse.json({
      workspaceId: plan.id,
      title: catchyTitle,
      ...(fileStorageWarnings.length > 0 ? { fileStorageWarnings } : {}),
    });
  } catch (error) {
    console.error("Generate plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Best-effort cleanup of xAI uploads when plan creation fails after files were uploaded.
 */
async function rollbackXaiUploads(processed: ProcessedFile[]): Promise<void> {
  await Promise.all(
    processed
      .filter(p => p.xaiFileId)
      .map(p => deleteFileFromXAI(p.xaiFileId!).catch(() => {}))
  );
}
