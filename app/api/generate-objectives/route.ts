import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
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
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ayclToken = ayclTokenFromBody(body);
    const ileToken = ileTokenFromBody(body);
    if (ayclToken) {
      const aycl = await resolveAyclAccess(ayclToken);
      if ("error" in aycl) {
        return jsonError(aycl.status, aycl.error);
      }
    } else if (ileToken) {
      const ile = await resolveIleLinkAccess(ileToken);
      if ("error" in ile) {
        return jsonError(ile.status, ile.error);
      }
    } else {
      const auth = await requireAuthenticatedProductUser();
      if (!auth.ok) return auth.response;
    }
    const { problem } = body;

    if (!problem) {
      return jsonError(400, "Missing problem");
    }

    const promptOverrides = await getUserPrompts();
    const result = await generateObjectives(problem, promptOverrides);

    if (!result.success) {
      return jsonError(500, result.error || "Objectives generation failed");
    }

    return NextResponse.json({ objectives: result.objectives });
  } catch (error) {
    console.error("Generate objectives error:", error);
    return jsonError(500, "Internal server error");
  }
}