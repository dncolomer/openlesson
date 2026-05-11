import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import type { Message, MessageContent } from "@/lib/xai-client";
import { uploadFileToXAI, deleteFileFromXAI } from "@/lib/xai-files";
import { callXaiResponses, type ResponsesInputContent } from "@/lib/xai-client";

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
}

interface PlanData {
  title: string;
  nodes: NodeData[];
}

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

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
          },
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic, days, image, files: rawFiles } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
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
    const nodeConstraints = DAYS_TO_NODES[daysNum] || DAYS_TO_NODES[30];

    // Partition uploaded files into image-files (handled via chat completions multimodal)
    // vs document-files (handled via Responses API + input_file)
    const imageFiles = processedFiles.filter(pf => pf.mimeType.startsWith("image/"));
    const docFiles = processedFiles.filter(pf => !pf.mimeType.startsWith("image/") && pf.xaiFileId);

    const hasImageContent = hasImage || imageFiles.length > 0;
    const hasDocFiles = docFiles.length > 0;

    const imageContext = hasImageContent
      ? `\nThe user has provided an image. Analyze it and incorporate its content into the learning plan alongside the topic "${topic}".`
      : "";

    const fileContext = hasDocFiles
      ? `\nThe user has attached ${docFiles.length} document(s) as reference material. Search and analyze them, then incorporate their content into the plan alongside the topic "${topic}".`
      : "";

    const promptBody = `Generate a learning plan for "${topic}" as a directed graph where each node is a session.${imageContext}${fileContext}

Return JSON with this structure:
{
  "title": "A short, catchy, social-media-friendly title for this plan (max 6 words, creative and engaging — NOT just the topic name)",
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "is_start": true/false, "next": ["b", "c"] }
  ]
}

IMPORTANT: The plan should span approximately "${daysNum} days".
- Include ${nodeConstraints.min} to ${nodeConstraints.max} nodes total
- Each node represents one learning session
- Create a realistic learning path that fits within this timeframe

Rules:
- The top-level "title" must be a catchy, memorable name for the plan (like a course name or book title). NOT just "Learning X". Be creative.
- Each node is a distinct learning session
- Use single-letter or short IDs for referencing
- is_start: true for nodes that can begin a learning path
- next: array of node IDs that follow this node (can be empty or have 1-3 entries)
- Create branching paths (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept`;

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
        maxOutputTokens: 4000,
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
        maxTokens: 2000,
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
        maxTokens: 2000,
        temperature: 0.3,
      });

      if (!response.success || !response.data) {
        console.error("[generate] Chat error:", response.error);
        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
      }

      planData = response.data;
    }

    if (!planData || !planData.nodes || !Array.isArray(planData.nodes)) {
      await rollbackXaiUploads(processedFiles);
      return NextResponse.json({ error: "Invalid plan data format" }, { status: 500 });
    }

    const catchyTitle = planData.title || `Learning ${topic}`;

    // Create the learning plan
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: user.id,
        title: catchyTitle,
        root_topic: topic,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      await rollbackXaiUploads(processedFiles);
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
    }

    // Create nodes (two passes for ID resolution)
    const nodeIdMap = new Map<string, string>();
    const nodeRefs = planData.nodes;

    for (const nodeData of nodeRefs) {
      const { data: node, error: nodeError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: plan.id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (nodeError || !node) {
        console.error("Failed to create node:", nodeError);
        continue;
      }
      nodeIdMap.set(nodeData.id, node.id);
    }

    for (const nodeData of nodeRefs) {
      const currentNodeId = nodeIdMap.get(nodeData.id);
      if (!currentNodeId) continue;

      const nextIds: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextId of nodeData.next) {
          const targetId = nodeIdMap.get(nextId);
          if (targetId) nextIds.push(targetId);
        }
      }

      await supabase.from("plan_nodes").update({ next_node_ids: nextIds }).eq("id", currentNodeId);
    }

    // Persist plan_files records (already uploaded to xAI above)
    const fileStorageWarnings: string[] = [];
    for (const pf of processedFiles) {
      if (!pf.xaiFileId) {
        fileStorageWarnings.push(`${pf.name}: xAI upload failed`);
        continue;
      }
      const { error: insertError } = await supabase.from("plan_files").insert({
        plan_id: plan.id,
        user_id: user.id,
        file_name: pf.name,
        file_size: pf.size,
        mime_type: pf.mimeType,
        xai_file_id: pf.xaiFileId,
      });
      if (insertError) {
        console.error(`[generate] plan_files insert error for "${pf.name}":`, insertError.message);
        fileStorageWarnings.push(`${pf.name}: ${insertError.message}`);
        await deleteFileFromXAI(pf.xaiFileId).catch(() => {});
      }
    }

    if (fileStorageWarnings.length > 0) {
      console.warn(`[generate] File storage warnings:`, fileStorageWarnings);
    }

    return NextResponse.json({
      planId: plan.id,
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
