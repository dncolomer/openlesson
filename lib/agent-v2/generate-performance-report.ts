import type { ErrorCode } from "@/lib/agent-v2/types";
import { buildOpaquePerformanceReportInstructions } from "@/lib/agent-v2/opaque-evaluation";
import {
  buildPerformanceReportInstructions,
  PERFORMANCE_REPORT_SCHEMA,
  recoverPerformanceReportFromModelText,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-report";
import { callXaiResponsesWithFiles, type CallResponsesResult } from "@/lib/xai-client";

export interface GenerateWorkspacePerformanceReportInput {
  workspaceId: string;
  workspaceTitle: string | null;
  workspaceRootTopic: string | null;
  storedConversionGoal: string | null;
  fileIds: string[];
  blockId?: string | null;
  stylePrompt?: string | null;
  opaque?: boolean;
  goalRef?: string | null;
}

export interface GenerateWorkspacePerformanceReportResult {
  success: boolean;
  data?: PerformanceReport;
  error?: string;
  code?: ErrorCode;
  recovered?: boolean;
}

function performanceReportMaxOutputTokens(fileCount: number, attempt: number): number {
  const base = 2500 + fileCount * 400;
  const boosted = base + attempt * 2000;
  return Math.min(8192, boosted);
}

async function requestPerformanceReport(
  input: GenerateWorkspacePerformanceReportInput,
  attempt: number,
): Promise<CallResponsesResult<PerformanceReport>> {
  const {
    workspaceId,
    workspaceTitle,
    workspaceRootTopic,
    storedConversionGoal,
    fileIds,
    blockId,
    stylePrompt,
    opaque,
    goalRef,
  } = input;

  const prompt = opaque
    ? `Generate a structural-only opaque protocol report for workspace ${workspaceId}.`
    : `Generate a learning and gap analysis report for workspace "${workspaceTitle || workspaceRootTopic}".`;

  const instructions = opaque
    ? buildOpaquePerformanceReportInstructions(blockId, goalRef)
    : buildPerformanceReportInstructions(blockId, storedConversionGoal, stylePrompt);

  return callXaiResponsesWithFiles<PerformanceReport>(prompt, fileIds, {
    instructions,
    temperature: 0.35,
    maxOutputTokens: performanceReportMaxOutputTokens(fileIds.length, attempt),
    fetchTimeout: 120000,
    jsonSchema: PERFORMANCE_REPORT_SCHEMA,
    retries: attempt === 0 ? 3 : 2,
  });
}

export async function generateWorkspacePerformanceReport(
  input: GenerateWorkspacePerformanceReportInput,
): Promise<GenerateWorkspacePerformanceReportResult> {
  const maxAttempts = 2;
  let lastError = "Failed to generate performance report";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reportResult = await requestPerformanceReport(input, attempt);

    if (reportResult.success && reportResult.data) {
      return { success: true, data: reportResult.data };
    }

    const rawText = reportResult.text;
    if (rawText) {
      const recovered = recoverPerformanceReportFromModelText(rawText);
      if (recovered) {
        return { success: true, data: recovered, recovered: true };
      }
    }

    lastError = reportResult.error || lastError;
    console.error(
      `[generate-performance-report] attempt ${attempt + 1} failed for workspace ${input.workspaceId}:`,
      lastError,
      rawText ? `(raw ${rawText.length} chars)` : "",
    );
  }

  return {
    success: false,
    error: lastError,
    code: "performance_report_generation_failed",
  };
}