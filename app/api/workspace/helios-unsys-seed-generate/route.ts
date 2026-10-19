import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  expandAuthorUnsysSessionNode,
  generateAuthorUnsysSessionField,
} from "@/lib/author-unsys-generate";
import { normalizeAuthorUnsysModel } from "@/lib/author-unsys-model";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");

    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const chapterTitle = String(body.blockTitle || body.chapterTitle || "").trim();
    const chapterBrief = String(
      body.blockDescription || body.chapterBrief || "",
    ).trim();
    const parentId = String(body.parentId || "").trim();
    const working = parentId ? normalizeAuthorUnsysModel(body.seedModel ?? body.model) : null;
    const prepared = parentId
      ? working
        ? await expandAuthorUnsysSessionNode({
            chapterTitle,
            chapterBrief,
            model: working,
            parentId,
          })
        : { ok: false as const, error: "A working unsys model is required." }
      : await generateAuthorUnsysSessionField({
          chapterTitle,
          chapterBrief,
        });
    if (!prepared.ok) return jsonError(502, prepared.error);
    return NextResponse.json({ model: prepared.model });
  } catch (err) {
    console.error("[helios-unsys-seed-generate]", err);
    return jsonError(500, "The unsys field could not be generated.");
  }
}
