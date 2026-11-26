/**
 * Write a learner Problem from flow artifacts when a learner opens.
 */

import {
  getDocumentContext,
  mergeDocumentContextPrompt,
  type DocumentTurn,
} from "@/lib/ai/document-context";
import {
  flowArtifactFileIds,
  flowProblemFromUnknown,
  parseFlowArtifacts,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import { DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH } from "@/lib/product-flow";

export { DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH };
import { composePrompt } from "@/lib/prompt-kernel/compose";
import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import {
  callXai,
  callXaiResponsesWithFiles,
  systemMessage,
  userMessage,
  type JsonSchema,
} from "@/lib/xai-client";

export function flowCanGenerateProblemFromArtifacts(artifacts: unknown): boolean {
  return parseFlowArtifacts(artifacts).length > 0;
}

export type FlowProblemGenerateInput = {
  name: string;
  problem: string;
  artifacts: FlowArtifact[];
};

export function flowProblemGenerateInput(body: Record<string, unknown>): FlowProblemGenerateInput {
  return {
    name: String(body.name || "").trim(),
    problem: flowProblemFromUnknown(body),
    artifacts: parseFlowArtifacts(body.artifacts),
  };
}

const SCHEMA: JsonSchema = {
  name: "flow_problem_from_artifacts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["problem"],
    properties: {
      problem: { type: "string" },
    },
  },
};

const SYSTEM = composePrompt({
  ontology: "none",
  surface: TUTOR_CANVAS_VOICE,
  task: `Write one Problem a learner will work from the attached files.
Reply as JSON with problem: a concrete task in two to six sentences.
Ground it in the files. Do not summarize the files. Do not mention files, artifacts, or product terms.
Do not wrap the flow name into a stock sentence. Leave room to begin.`,
});

export type FlowProblemGenerateDeps = {
  call?: typeof callXai;
  callWithFiles?: typeof callXaiResponsesWithFiles;
  forTurn?: (fileIds: string[]) => Promise<DocumentTurn>;
};

export async function generateFlowProblemFromArtifacts(
  body: Record<string, unknown> | FlowProblemGenerateInput,
  deps: FlowProblemGenerateDeps = {},
): Promise<{ ok: true; problem: string } | { ok: false; error: string }> {
  const parsed = flowProblemGenerateInput(body as Record<string, unknown>);
  if (!parsed.artifacts.length) {
    return { ok: false, error: "Attach at least one artifact." };
  }
  const fileIds = flowArtifactFileIds(parsed.artifacts);
  const named = parsed.artifacts.map((item) => `- ${item.name} (${item.xaiFileId})`).join("\n");
  const user = [
    parsed.name ? `Flow name: ${parsed.name}` : "",
    parsed.problem ? `Author notes:\n${parsed.problem}` : "",
    `Attached files:\n${named}`,
    "Write one Problem the learner will work.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const forTurn = deps.forTurn ?? ((ids: string[]) => getDocumentContext().forTurn(ids));
  const docs = await forTurn(fileIds);
  const userPrompt = mergeDocumentContextPrompt(user, docs.extraPrompt);
  const callWithFiles = deps.callWithFiles ?? callXaiResponsesWithFiles;
  const call = deps.call ?? callXai;
  const response = docs.responsesFiles?.length
    ? await callWithFiles<{ problem?: unknown }>(userPrompt, docs.responsesFiles, {
        instructions: SYSTEM,
        maxOutputTokens: 800,
        temperature: 0.5,
        jsonSchema: SCHEMA,
        reasoningEffort: "low",
        fetchTimeout: 90_000,
        retries: 2,
      })
    : await call<{ problem?: unknown }>([systemMessage(SYSTEM), userMessage(userPrompt)], {
        maxTokens: 800,
        temperature: 0.5,
        responseFormat: "json_schema",
        jsonSchema: SCHEMA,
        reasoningEffort: "low",
        fetchTimeout: 90_000,
        retries: 2,
      });
  const problem =
    response.success && response.data && typeof response.data === "object"
      ? String((response.data as { problem?: unknown }).problem || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  if (!problem) {
    return { ok: false, error: response.error || "The problem could not be generated." };
  }
  return { ok: true, problem };
}

export async function openingWorkFromArtifactProblem(
  input: {
    generateProblemOnOpen: boolean;
    exactProblemOnCanvas?: boolean;
    artifacts?: FlowArtifact[] | null;
    name?: string | null;
    problem?: string | null;
  },
  deps: FlowProblemGenerateDeps = {},
): Promise<{ openingWork: string; openingWorkExact: boolean } | null> {
  if (!input.generateProblemOnOpen) return null;
  const artifacts = parseFlowArtifacts(input.artifacts);
  if (!artifacts.length) return null;
  const generated = await generateFlowProblemFromArtifacts(
    {
      name: String(input.name || "").trim(),
      problem: String(input.problem || "").trim(),
      artifacts,
    },
    deps,
  );
  if (generated.ok) {
    return {
      openingWork: generated.problem,
      openingWorkExact: false,
    };
  }
  const fallback = String(input.problem || "").replace(/\s+/g, " ").trim();
  if (!fallback) return { openingWork: "", openingWorkExact: false };
  return {
    openingWork: fallback,
    openingWorkExact: false,
  };
}
