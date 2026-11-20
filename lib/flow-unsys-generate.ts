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
import { unsysSeedFromRequestBody } from "@/lib/unsys-tree-spec";
import { parseProductFlowKind } from "@/lib/product-flow";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  flowOpeningCanvasGenerateProblem,
  flowOpeningCanvasHasContent,
  parseFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import type { AuthorUnsysGenerateDeps } from "@/lib/author-unsys-generate";

export function productFlowUnsysGenerateInput(body: Record<string, unknown>): {
  kind: NonNullable<ReturnType<typeof parseProductFlowKind>> | "solve";
  name: string;
  problem: string;
  artifacts: ReturnType<typeof parseFlowArtifacts>;
  guidance: string | null;
  openingCanvasScene: ReturnType<typeof parseFlowOpeningCanvasScene>;
  fromPreparedCanvas: boolean;
} {
  const kind = parseProductFlowKind(body.kind) ?? "solve";
  const openingCanvasScene = parseFlowOpeningCanvasScene(
    body.openingCanvasScene ?? body.opening_canvas_scene,
  );
  const fromPreparedCanvas = flowOpeningCanvasHasContent(openingCanvasScene);
  const leftoverProblem = String(body.problem || body.topic || body.goal || "").trim();
  const name = String(body.name || "").trim();
  const problem = fromPreparedCanvas
    ? flowOpeningCanvasGenerateProblem(openingCanvasScene) || leftoverProblem || name
    : leftoverProblem;
  const artifacts = fromPreparedCanvas ? [] : parseFlowArtifacts(body.artifacts);
  const guidance = String(body.guidance || body.prompt || body.unsys_guidance || "").trim();
  return {
    kind,
    name,
    problem,
    artifacts,
    guidance: guidance || null,
    openingCanvasScene,
    fromPreparedCanvas,
  };
}

export async function runProductFlowUnsysGenerate(
  body: Record<string, unknown>,
  deps: AuthorUnsysGenerateDeps = {},
): Promise<
  | { ok: true; model: SessionBranchModel }
  | { ok: false; error: string }
> {
  const parsed = productFlowUnsysGenerateInput(body);
  if (!parsed.problem && !parsed.name) return { ok: false, error: "A problem is required." };
  const parentId = String(body.parentId || body.parent_id || "").trim();
  const seedModel = normalizeAuthorUnsysModel(body.seedModel ?? body.seed_model ?? body.model);
  const input = {
    kind: parsed.kind,
    chapterTitle: parsed.name || parsed.problem,
    chapterBrief: parsed.problem,
    problem: parsed.problem,
    artifacts: parsed.artifacts,
    guidance: parsed.guidance,
    openingCanvasScene: parsed.openingCanvasScene,
  };
  const result =
    parentId && seedModel
      ? await expandAuthorUnsysSessionNode(
          {
            ...input,
            model: seedModel,
            parentId,
          },
          deps,
        )
      : await generateAuthorUnsysSessionField(input, deps);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, model: result.model };
}

export async function generateFlowUnsysSeedFromBody(
  body: Record<string, unknown>,
): Promise<AuthorUnsysModelSeed | null> {
  const existing = parseFlowUnsysSeed(
    unsysSeedFromRequestBody(body) ?? body.answers_model_seed ?? body.answersModelSeed,
  );
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
