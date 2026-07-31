/**
 * LLM-author a concrete domain exercise for human TAP drills or ILE Project chapters.
 * Replaces pure topic-list template framing.
 */

import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";

    // Prefer session-scoped auth (ILE guest/owner); fall back to cookie user for workspace-only.
    if (sessionId) {
      const auth = await guardSessionRoute(sessionId, {
        ayclToken: ayclTokenFromBody(body),
        ileToken: ileTokenFromBody(body),
      });
      if (!auth.ok) return auth.response;
    } else {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
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

    const filesRaw = Array.isArray(body.files) ? body.files : [];
    const files = filesRaw
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

    const generated = await generateDomainExercise({
      surface,
      workspaceTitle:
        typeof body.workspaceTitle === "string"
          ? body.workspaceTitle
          : typeof body.workspace_title === "string"
            ? body.workspace_title
            : null,
      workspaceGoal:
        typeof body.workspaceGoal === "string"
          ? body.workspaceGoal
          : typeof body.workspace_goal === "string"
            ? body.workspace_goal
            : null,
      rootTopic:
        typeof body.rootTopic === "string"
          ? body.rootTopic
          : typeof body.root_topic === "string"
            ? body.root_topic
            : null,
      workspaceDescription:
        typeof body.workspaceDescription === "string"
          ? body.workspaceDescription
          : typeof body.workspace_description === "string"
            ? body.workspace_description
            : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      blockTitle:
        typeof body.blockTitle === "string"
          ? body.blockTitle
          : typeof body.block_title === "string"
            ? body.block_title
            : null,
      blockDescription:
        typeof body.blockDescription === "string"
          ? body.blockDescription
          : typeof body.block_description === "string"
            ? body.block_description
            : null,
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
      files,
      durationSeconds,
    });

    return NextResponse.json({
      exercise: generated.exercise,
      source: generated.source,
      surface,
      workspace_id: workspaceId || null,
      session_id: sessionId || null,
    });
  } catch (error) {
    console.error("[generate-exercise] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate exercise" },
      { status: 500 },
    );
  }
}
