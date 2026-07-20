import type { ErrorCode } from "@/lib/pow-api/types";
import { buildOpaqueVerticalScoreInstructions } from "@/lib/pow-api/opaque-evaluation";
import {
  buildVerticalScoreInstructions,
  buildVerticalScoreReportSchema,
  recoverVerticalScoreReportFromModelText,
  type ScoreVertical,
  type VerticalScoreReport,
} from "@/lib/pow-api/performance-report";
import { callXaiResponsesWithFiles, type CallResponsesResult } from "@/lib/xai-client";

export interface GenerateWorkspacePerformanceReportInput {
  workspaceId: string;
  workspaceTitle: string | null;
  workspaceRootTopic: string | null;
  storedWorkspaceGoal: string | null;
  fileIds: string[];
  vertical: ScoreVertical;
  blockId?: string | null;
  stylePrompt?: string | null;
  opaque?: boolean;
  goalRef?: string | null;
}

export interface GenerateWorkspacePerformanceReportResult {
  success: boolean;
  data?: VerticalScoreReport;
  error?: string;
  code?: ErrorCode;
  recovered?: boolean;
}

function performanceReportMaxOutputTokens(fileCount: number, attempt: number): number {
  const base = 2500 + fileCount * 400;
  const boosted = base + attempt * 2000;
  return Math.min(8192, boosted);
}

async function requestVerticalScoreReport(
  input: GenerateWorkspacePerformanceReportInput,
  attempt: number
): Promise<CallResponsesResult<VerticalScoreReport>> {
  const {
    workspaceId,
    workspaceTitle,
    workspaceRootTopic,
    fileIds,
    blockId,
    stylePrompt,
    opaque,
    goalRef,
    vertical,
    storedWorkspaceGoal,
  } = input;

  const prompt = opaque
    ? `Generate a structural-only opaque ${vertical} score report for workspace ${workspaceId}.`
    : `Generate a ${vertical} score report for workspace "${workspaceTitle || workspaceRootTopic}".`;

  const instructions = opaque
    ? buildOpaqueVerticalScoreInstructions(vertical, blockId, goalRef)
    : buildVerticalScoreInstructions(vertical, blockId, storedWorkspaceGoal, stylePrompt);

  const schema = buildVerticalScoreReportSchema(vertical);

  return callXaiResponsesWithFiles<VerticalScoreReport>(prompt, fileIds, {
    instructions,
    temperature: 0.35,
    maxOutputTokens: performanceReportMaxOutputTokens(fileIds.length, attempt),
    fetchTimeout: 120000,
    jsonSchema: schema,
    retries: attempt === 0 ? 3 : 2,
  });
}

export async function generateWorkspaceVerticalScoreReport(
  input: GenerateWorkspacePerformanceReportInput
): Promise<GenerateWorkspacePerformanceReportResult> {
  const maxAttempts = 2;
  let lastError = `Failed to generate ${input.vertical} score report`;
  const vertical = input.vertical;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reportResult = await requestVerticalScoreReport(input, attempt);

    if (reportResult.success && reportResult.data) {
      return {
        success: true,
        data: {
          ...reportResult.data,
          vertical,
        },
      };
    }

    const rawText = reportResult.text;
    if (rawText) {
      const recovered = recoverVerticalScoreReportFromModelText(rawText, vertical);
      if (recovered) {
        return { success: true, data: recovered, recovered: true };
      }
    }

    lastError = reportResult.error || lastError;
    console.error(
      `[generate-performance-report] ${vertical} attempt ${attempt + 1} failed for workspace ${input.workspaceId}:`,
      lastError,
      rawText ? `(raw ${rawText.length} chars)` : ""
    );
  }

  return {
    success: false,
    error: lastError,
    code: "performance_report_generation_failed",
  };
}

/** Defaults to verification vertical when vertical omitted (TAP / legacy callers). */
export async function generateWorkspacePerformanceReport(
  input: Omit<GenerateWorkspacePerformanceReportInput, "vertical"> & {
    vertical?: ScoreVertical;
  }
): Promise<GenerateWorkspacePerformanceReportResult> {
  return generateWorkspaceVerticalScoreReport({
    ...input,
    vertical: input.vertical ?? "verification",
  });
}
