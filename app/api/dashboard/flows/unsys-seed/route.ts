/**
 * Generate or deepen an Unsys seed during slow flow create.
 * Dashboard wizard has no workspace yet; owner auth is enough.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  expandAuthorUnsysSessionNode,
  generateAuthorUnsysSessionField,
} from "@/lib/author-unsys-generate";
import { normalizeAuthorUnsysModel } from "@/lib/author-unsys-model";
import { parseFlowArtifacts } from "@/lib/flow-artifacts";
import { parseProductFlowKind } from "@/lib/product-flow";
import { FLOW_UNSYS_SEED_PATH } from "@/lib/flow-unsys-seed";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind) ?? "solve";
    const problem = String(body.problem || body.topic || body.goal || "").trim();
    const name = String(body.name || "").trim();
    if (!problem && !name) return jsonError(400, "A problem is required.");
    const artifacts = parseFlowArtifacts(body.artifacts);
    const guidance = String(body.guidance || body.prompt || "").trim();
    const parentId = String(body.parentId || "").trim();
    const seedModel = normalizeAuthorUnsysModel(body.seedModel ?? body.model);
    const input = {
      kind,
      chapterTitle: name || problem,
      chapterBrief: problem,
      problem,
      artifacts,
      guidance: guidance || null,
    };
    const result = parentId && seedModel
      ? await expandAuthorUnsysSessionNode({
          ...input,
          model: seedModel,
          parentId,
        })
      : await generateAuthorUnsysSessionField(input);
    if (!result.ok) return jsonError(502, result.error);
    return NextResponse.json({
      path: FLOW_UNSYS_SEED_PATH,
      model: result.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The unsys field could not be generated.";
    return jsonError(500, message);
  }
}
