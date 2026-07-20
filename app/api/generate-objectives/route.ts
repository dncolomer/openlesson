import { NextRequest, NextResponse } from "next/server";
import { generateObjectives } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  requireAuthenticatedProductUser,
} from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { resolveIleLinkAccess } from "@/lib/ile-link-auth";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ayclToken = ayclTokenFromBody(body);
    const ileToken = ileTokenFromBody(body);
    if (ayclToken) {
      const aycl = await resolveAyclAccess(ayclToken);
      if ("error" in aycl) {
        return NextResponse.json({ error: aycl.error }, { status: aycl.status });
      }
    } else if (ileToken) {
      const ile = await resolveIleLinkAccess(ileToken);
      if ("error" in ile) {
        return NextResponse.json({ error: ile.error }, { status: ile.status });
      }
    } else {
      const auth = await requireAuthenticatedProductUser();
      if (!auth.ok) return auth.response;
    }
    const { problem } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const promptOverrides = await getUserPrompts();
    const result = await generateObjectives(problem, promptOverrides);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Objectives generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ objectives: result.objectives });
  } catch (error) {
    console.error("Generate objectives error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}