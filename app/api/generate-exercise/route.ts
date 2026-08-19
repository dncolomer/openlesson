/**
 * LLM-author a concrete domain exercise for human TAP drills or ILE Project chapters.
 * Replaces pure topic-list template framing.
 *
 * When sessionId or workspaceId is provided, hydrates notes/files/blocks/local/unusable
 * from the DB so ILE SessionView and other thin clients still get full context.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
  requireAuthenticatedUser,
} from "@/lib/api/require-auth";
import {
  generateDomainExercise,
  type DomainExerciseSurface,
} from "@/lib/pow-api/tapbench-exercise-generate";
import {
  blockIdFromSessionMetadata,
  loadWorkspacePromptContext,
  workspaceIdFromSessionMetadata,
  type LoadedWorkspacePromptContext,
} from "@/lib/pow-api/load-workspace-prompt-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeSurface(raw: unknown): DomainExerciseSurface {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "tap_exercise" || s === "exercise" || s === "tap-exercise") {
    return "tap_exercise";
  }
  if (s === "ile_project" || s === "project" || s === "ile-project") {
    return "ile_project";
  }
  if (s === "tapbench") return "tapbench";
  return "ile_project";
}

async function hydrateFromSessionOrWorkspace(
  supabase: SupabaseClient,
  sessionId: string,
  workspaceIdBody: string,
  focusedBlockIdBody: string | null,
): Promise<LoadedWorkspacePromptContext | null> {
  let workspaceId = workspaceIdBody;
  let focusedBlockId = focusedBlockIdBody;

  if (sessionId && !workspaceId) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, problem, metadata")
      .eq("id", sessionId)
      .maybeSingle();
    const meta = (session?.metadata || {}) as Record<string, unknown>;
    workspaceId = workspaceIdFromSessionMetadata(meta) || "";
    if (!focusedBlockId) {
      focusedBlockId = blockIdFromSessionMetadata(meta);
    }
  }

  if (!workspaceId) return null;
  return loadWorkspacePromptContext(supabase, workspaceId, {
    focusedBlockId,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";

    let supabase: SupabaseClient | null = null;

    // Prefer session-scoped auth (ILE guest/owner); fall back to cookie user for workspace-only.
    if (sessionId) {
      const auth = await guardSessionRoute(sessionId, {
        ayclToken: ayclTokenFromBody(body),
        ileToken: ileTokenFromBody(body),
      });
      if (!auth.ok) return auth.response;
      supabase = auth.supabase;
    } else {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      supabase = auth.supabase;
    }

    const surface = normalizeSurface(body.surface);
    const durationSeconds =
      typeof body.durationSeconds === "number"
        ? body.durationSeconds
        : typeof body.duration_seconds === "number"
          ? body.duration_seconds
          : typeof body.minutes === "number"
            ? Number(body.minutes) * 60
            : null;

    const focusedBlockIdBody =
      typeof body.focusedBlockId === "string"
        ? body.focusedBlockId.trim()
        : typeof body.focused_block_id === "string"
          ? body.focused_block_id.trim()
          : typeof body.blockId === "string"
            ? body.blockId.trim()
            : typeof body.block_id === "string"
              ? body.block_id.trim()
              : null;

    // Hydrate inventory / notes / files / local / unusable from DB when possible.
    const hydrated = supabase
      ? await hydrateFromSessionOrWorkspace(
          supabase,
          sessionId,
          workspaceId,
          focusedBlockIdBody,
        )
      : null;

    const filesRaw = Array.isArray(body.files) ? body.files : [];
    const bodyFiles = filesRaw
      .map((f) => {
        if (!f || typeof f !== "object") return null;
        const rec = f as Record<string, unknown>;
        const name =
          typeof rec.name === "string"
            ? rec.name
            : typeof rec.file_name === "string"
              ? rec.file_name
              : "";
        if (!name.trim()) return null;
        return {
          name: name.trim(),
          excerpt:
            typeof rec.excerpt === "string"
              ? rec.excerpt
              : typeof rec.content_text === "string"
                ? rec.content_text
                : null,
        };
      })
      .filter((f): f is { name: string; excerpt: string | null } => Boolean(f));

    const bodyBlocks = Array.isArray(body.blocks) ? body.blocks : null;
    const bodyLocal =
      body.blockLocalContext && typeof body.blockLocalContext === "object"
        ? body.blockLocalContext
        : body.block_local_context && typeof body.block_local_context === "object"
          ? body.block_local_context
          : null;
    const bodyUnusable = Array.isArray(body.unusableCells)
      ? body.unusableCells
      : Array.isArray(body.unusable_cells)
        ? body.unusable_cells
        : null;

    const generated = await generateDomainExercise({
      surface,
      workspaceTitle:
        typeof body.workspaceTitle === "string"
          ? body.workspaceTitle
          : typeof body.workspace_title === "string"
            ? body.workspace_title
            : hydrated?.workspaceTitle ?? null,
      workspaceGoal:
        typeof body.workspaceGoal === "string"
          ? body.workspaceGoal
          : typeof body.workspace_goal === "string"
            ? body.workspace_goal
            : hydrated?.workspaceGoal ?? null,
      rootTopic:
        typeof body.rootTopic === "string"
          ? body.rootTopic
          : typeof body.root_topic === "string"
            ? body.root_topic
            : hydrated?.rootTopic ?? null,
      workspaceDescription:
        typeof body.workspaceDescription === "string"
          ? body.workspaceDescription
          : typeof body.workspace_description === "string"
            ? body.workspace_description
            : hydrated?.workspaceDescription ?? null,
      notes:
        typeof body.notes === "string"
          ? body.notes
          : hydrated?.notes ?? null,
      blockTitle:
        typeof body.blockTitle === "string"
          ? body.blockTitle
          : typeof body.block_title === "string"
            ? body.block_title
            : hydrated?.focusedBlockTitle ?? null,
      blockDescription:
        typeof body.blockDescription === "string"
          ? body.blockDescription
          : typeof body.block_description === "string"
            ? body.block_description
            : hydrated?.focusedBlockDescription ?? null,
      chapterDescription:
        typeof body.chapterDescription === "string"
          ? body.chapterDescription
          : typeof body.chapter_description === "string"
            ? body.chapter_description
            : typeof body.description === "string"
              ? body.description
              : null,
      exerciseText:
        typeof body.exerciseText === "string"
          ? body.exerciseText
          : typeof body.exercise === "string"
            ? body.exercise
            : typeof body.seed === "string"
              ? body.seed
              : null,
      files: bodyFiles.length > 0 ? bodyFiles : hydrated?.files ?? [],
      // JIT URL bias: hydrate from loadWorkspacePromptContext (external resources).
      externalResources: hydrated?.externalResources ?? null,
      blocks: bodyBlocks ?? hydrated?.blocks ?? null,
      focusedBlockId: focusedBlockIdBody ?? hydrated?.focusedBlockId ?? null,
      blockLocalContext:
        (bodyLocal as import("@/lib/prompt-workspace-context").BlockLocalContextInput | null) ??
        hydrated?.blockLocalContext ??
        null,
      unusableCells: bodyUnusable ?? hydrated?.unusableCells ?? null,
      durationSeconds,
    });

    return NextResponse.json({
      exercise: generated.exercise,
      source: generated.source,
      surface,
      workspace_id: hydrated?.workspaceId || workspaceId || null,
      session_id: sessionId || null,
    });
  } catch (error) {
    console.error("[generate-exercise] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to generate exercise");
  }
}
