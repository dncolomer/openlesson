/**
 * Workspace TAPBench links — mint + list (always-visible share URLs).
 * Used by Knowledge Regions tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  listTapbenchLinksPersisted,
  mintTapbenchLinkPersisted,
} from "@/lib/pow-api/tapbench-store";
import { normalizeTapbenchDurationSeconds } from "@/lib/pow-api/tapbench";
import { generateTapbenchExercise } from "@/lib/pow-api/tapbench-exercise-generate";
import { loadWorkspacePromptContext } from "@/lib/pow-api/load-workspace-prompt-context";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    const links = await listTapbenchLinksPersisted(
      auth.supabase,
      workspaceId,
      baseUrl(req),
    );

    return NextResponse.json({
      workspace_id: workspaceId,
      tapbench_links: links,
    });
  } catch (error) {
    console.error("[workspace/tapbench-links] GET failed:", error);
    return NextResponse.json({ error: "Failed to list TAPBench links" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const blockId =
      typeof body.blockId === "string"
        ? body.blockId.trim()
        : typeof body.block_id === "string"
          ? body.block_id.trim()
          : "";

    const rawDuration =
      body.duration_seconds ??
      body.durationSeconds ??
      (body.minutes != null ? Number(body.minutes) * 60 : undefined);
    const durationSeconds = normalizeTapbenchDurationSeconds(rawDuration);

    // Load full workspace prompt context (inventory, topology, local, unusable).
    // Primary TAPBench mint path must feed the shared assembler — not titles alone.
    const promptCtx = await loadWorkspacePromptContext(auth.supabase, workspaceId, {
      focusedBlockId: blockId || null,
    });

    if (!promptCtx) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // organization_id still needed for mint; load workspace ownership fields.
    const { data: workspace } = await auth.supabase
      .from("workspaces")
      .select("id, organization_id, title, workspace_goal, root_topic")
      .eq("id", workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (blockId && !promptCtx.blocks.some((b) => b.id === blockId)) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const blockTitle = promptCtx.focusedBlockTitle;
    const blockDescription = promptCtx.focusedBlockDescription;

    const explicitExercise =
      typeof body.exercise === "string"
        ? body.exercise
        : typeof body.exerciseText === "string"
          ? body.exerciseText
          : typeof body.exercise_text === "string"
            ? body.exercise_text
            : null;

    // Author a real problem (LLM). Never mint the old topic-list template as the exercise.
    const generated = await generateTapbenchExercise({
      workspaceTitle: promptCtx.workspaceTitle ?? workspace.title,
      workspaceGoal: promptCtx.workspaceGoal ?? workspace.workspace_goal,
      rootTopic: promptCtx.rootTopic ?? workspace.root_topic,
      workspaceDescription: promptCtx.workspaceDescription,
      notes: promptCtx.notes,
      blockTitle,
      blockDescription,
      exerciseText: explicitExercise,
      files: promptCtx.files,
      blocks: promptCtx.blocks,
      focusedBlockId: promptCtx.focusedBlockId,
      blockLocalContext: promptCtx.blockLocalContext,
      unusableCells: promptCtx.unusableCells,
      durationSeconds,
    });
    const exerciseText = generated.exercise;

    const minted = await mintTapbenchLinkPersisted({
      supabase: auth.supabase,
      baseUrl: baseUrl(req),
      organizationId: workspace.organization_id ?? null,
      input: {
        workspaceId,
        blockId: blockId || null,
        durationSeconds,
        workspaceTitle: workspace.title,
        workspaceGoal: workspace.workspace_goal,
        rootTopic: workspace.root_topic,
        blockTitle,
        blockDescription,
        exerciseText,
        createdBy: auth.user.id,
      },
    });

    return NextResponse.json(
      {
        workspace_id: workspaceId,
        tapbench_link: {
          id: minted.link.id,
          workspace_id: minted.link.workspace_id,
          block_id: minted.link.block_id,
          status: minted.link.status,
          exercise: minted.exercise,
          duration_seconds: minted.duration_seconds,
          expires_at: minted.expires_at,
          remaining_ms: minted.remaining_ms,
          created_at: minted.link.created_at,
          public_token: minted.session_token,
          url: minted.url,
          session_token: minted.session_token,
          guest_user_id: minted.link.guest_user_id,
        },
        exercise_source: generated.source,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[workspace/tapbench-links] POST failed:", error);
    return NextResponse.json({ error: "Failed to create TAPBench link" }, { status: 500 });
  }
}
