/**
 * Generate or deepen a flow Unsys seed (wizard model step).
 * Shared by cookie dashboard and public agent REST/MCP.
 */

import {
  expandAuthorUnsysSessionNode,
  generateAuthorUnsysSessionField,
} from "@/lib/author-unsys-generate";
import { normalizeAuthorUnsysModel } from "@/lib/author-unsys-model";
import { parseFlowArtifacts } from "@/lib/flow-artifacts";
import { flowUnsysSeedFromModel, parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { parseProductFlowKind } from "@/lib/product-flow";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export async function runProductFlowUnsysGenerate(
  body: Record<string, unknown>,
): Promise<
  | { ok: true; model: SessionBranchModel }
  | { ok: false; error: string }
> {
  const kind = parseProductFlowKind(body.kind) ?? "solve";
  const problem = String(body.problem || body.topic || body.goal || "").trim();
  const name = String(body.name || "").trim();
  if (!problem && !name) return { ok: false, error: "A problem is required." };
  const artifacts = parseFlowArtifacts(body.artifacts);
  const guidance = String(body.guidance || body.prompt || body.unsys_guidance || "").trim();
  const parentId = String(body.parentId || body.parent_id || "").trim();
  const seedModel = normalizeAuthorUnsysModel(body.seedModel ?? body.seed_model ?? body.model);
  const input = {
    kind,
    chapterTitle: name || problem,
    chapterBrief: problem,
    problem,
    artifacts,
    guidance: guidance || null,
  };
  const result =
    parentId && seedModel
      ? await expandAuthorUnsysSessionNode({
          ...input,
          model: seedModel,
          parentId,
        })
      : await generateAuthorUnsysSessionField(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, model: result.model };
}

export async function generateFlowUnsysSeedFromBody(
  body: Record<string, unknown>,
): Promise<AuthorUnsysModelSeed | null> {
  const existing = parseFlowUnsysSeed(body.answers_model_seed ?? body.answersModelSeed);
  const generate =
    body.generate_unsys === true ||
    body.generateUnsys === true ||
    String(body.generate_unsys ?? body.generateUnsys ?? "")
      .trim()
      .toLowerCase() === "true";
  if (!generate) return existing;
  const generated = await runProductFlowUnsysGenerate(body);
  if (!generated.ok) return existing;
  return flowUnsysSeedFromModel(generated.model) ?? existing;
}
