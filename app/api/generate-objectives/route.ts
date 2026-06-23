import { NextRequest, NextResponse } from "next/server";
import { generateObjectives } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
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