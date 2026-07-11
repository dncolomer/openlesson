import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import { filterResolvableXaiFileIds, isXaiFileId, uploadFileToXAI } from "@/lib/xai-files";
import { proofOfWorkQueryForAuth } from "./workspace-proof-of-work";

const MAX_ARTIFACT_FILE_REFS = 19;

export interface PerformanceConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type {
  PerformanceGapAnalysis,
  PerformanceGapItem,
  PerformanceMarkerScore,
  PerformanceNextSteps,
  PerformanceReport,
  PerformanceReportContract,
} from "./performance-report";

import {
  buildPerformanceReportInstructions,
  buildPerformanceStyleSection,
  emptyPerformanceReport,
  EXAMPLE_PERFORMANCE_REPORT,
  normalizePerformanceGapAnalysis,
  normalizePerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
} from "./performance-report";

export {
  buildPerformanceReportInstructions,
  buildPerformanceStyleSection,
  emptyPerformanceReport,
  EXAMPLE_PERFORMANCE_REPORT,
  normalizePerformanceGapAnalysis,
  normalizePerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
};

export interface PerformanceContextPayload {
  workspace: {
    id: string;
    title: string | null;
    root_topic: string | null;
    description: string | null;
    notes: string | null;
    conversion_goal: string | null;
  };
  focus_block_id: string | null;
  generated_at: string;
  blocks: Array<{
    id: string;
    title: string | null;
    description: string | null;
    status: string | null;
    is_start: boolean | null;
    session_id: string | null;
  }>;
  proof_of_work: Array<{
    id: string;
    type: string;
    block_id: string | null;
    session_id: string | null;
    file_name: string;
    mime_type: string;
    xai_file_id: string;
    timestamp_ms: number;
    tool_name: string | null;
    tool_action: string | null;
    device_name: string | null;
    sample_count: number | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  workspace_files: Array<{
    id: string;
    file_name: string;
    mime_type: string;
    xai_file_id: string;
    created_at: string;
  }>;
  linked_sessions: Array<Record<string, unknown>>;
  counts: {
    blocks: number;
    proof_of_work_artifacts: number;
    linked_sessions: number;
    workspace_files: number;
  };
}

interface BuildContextOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  blockId?: string | null;
}

export async function buildWorkspacePerformanceContext({
  supabase,
  auth,
  workspaceId,
  blockId,
}: BuildContextOptions) {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, description, notes, conversion_goal, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) throw new Error("Workspace not found");

  let blocksQuery = supabase
    .from("blocks")
    .select("id, title, description, status, is_start, session_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (blockId) blocksQuery = blocksQuery.eq("id", blockId);

  const [{ data: blocks }, { data: workspaceFiles }] = await Promise.all([
    blocksQuery,
    supabase
      .from("workspace_files")
      .select("id, file_name, mime_type, xai_file_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  const evidenceFilter = proofOfWorkQueryForAuth(auth);
  let proofOfWorkQuery = supabase
    .from("workspace_proof_of_work")
    .select(
      "id, block_id, session_id, proof_of_work_type, file_name, mime_type, xai_file_id, timestamp_ms, chunk_index, metadata, tool_name, tool_action, device_name, sample_count, created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (blockId) proofOfWorkQuery = proofOfWorkQuery.eq("block_id", blockId);
  if (evidenceFilter.restrictToGuest && evidenceFilter.guestUserId) {
    proofOfWorkQuery = proofOfWorkQuery.eq("guest_user_id", evidenceFilter.guestUserId);
  } else if (evidenceFilter.restrictToUser && evidenceFilter.userId) {
    proofOfWorkQuery = proofOfWorkQuery.eq("user_id", evidenceFilter.userId);
  }

  const { data: proofOfWorkRows } = await proofOfWorkQuery;

  const sessionIds = Array.from(
    new Set(
      [
        ...(blocks || []).map((block) => block.session_id).filter(Boolean),
        ...(proofOfWorkRows || []).map((row) => row.session_id).filter(Boolean),
      ] as string[]
    )
  );

  const { data: sessions } = sessionIds.length
    ? await supabase
        .from("sessions")
        .select("id, problem, status, duration_ms, report, created_at, user_id")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const payload: PerformanceContextPayload = {
    workspace: {
      id: workspace.id,
      title: workspace.title,
      root_topic: workspace.root_topic,
      description: workspace.description,
      notes: workspace.notes,
      conversion_goal: workspace.conversion_goal,
    },
    focus_block_id: blockId || null,
    generated_at: new Date().toISOString(),
    blocks: (blocks || []).map((block) => ({
      id: block.id,
      title: block.title,
      description: block.description,
      status: block.status,
      is_start: block.is_start,
      session_id: block.session_id,
    })),
    proof_of_work: (proofOfWorkRows || []).map((row) => ({
      id: row.id,
      type: row.proof_of_work_type,
      block_id: row.block_id,
      session_id: row.session_id,
      file_name: row.file_name,
      mime_type: row.mime_type,
      xai_file_id: row.xai_file_id,
      timestamp_ms: row.timestamp_ms,
      tool_name: row.tool_name,
      tool_action: row.tool_action,
      device_name: row.device_name,
      sample_count: row.sample_count,
      metadata: row.metadata,
      created_at: row.created_at,
    })),
    workspace_files: (workspaceFiles || []).map((file) => ({
      id: file.id,
      file_name: file.file_name,
      mime_type: file.mime_type,
      xai_file_id: file.xai_file_id,
      created_at: file.created_at,
    })),
    linked_sessions: (sessions || []).map((session) => ({
      id: session.id,
      problem: session.problem,
      status: session.status,
      duration_minutes: Math.round((session.duration_ms || 0) / 60000),
      report: session.report,
      created_at: session.created_at,
    })),
    counts: {
      blocks: blocks?.length || 0,
      proof_of_work_artifacts: proofOfWorkRows?.length || 0,
      linked_sessions: sessions?.length || 0,
      workspace_files: workspaceFiles?.length || 0,
    },
  };

  const dataJson = JSON.stringify(payload, null, 2);
  const summaryUpload = await uploadFileToXAI(
    `workspace-performance-${workspaceId}-${Date.now()}.json`,
    "application/json",
    Buffer.from(dataJson).toString("base64")
  );

  const candidateArtifactIds = Array.from(
    new Set(
      [
        ...(proofOfWorkRows || []).map((row) => row.xai_file_id),
        ...(workspaceFiles || []).map((file) => file.xai_file_id),
      ].filter(isXaiFileId)
    )
  ).slice(0, MAX_ARTIFACT_FILE_REFS);

  const artifactFileIds = await filterResolvableXaiFileIds(candidateArtifactIds);

  const fileIds = [summaryUpload.file_id, ...artifactFileIds];

  return { payload, fileIds, summaryFileId: summaryUpload.file_id };
}

export function buildPerformanceChatInstructions(
  blockId?: string | null,
  stylePrompt?: string | null
): string {
  const scope = blockId
    ? "You are analyzing one performance block inside a workspace."
    : "You are analyzing an entire Verification Workspace.";

  return `${scope}

You are an OpenLesson performance analyst. Use the attached workspace JSON summary plus any artifact files (tool usage logs, screenshots, video, EEG, Think Aloud Protocol (TAP) results, ILE practice traces, session reports, and uploaded files).

When answering:
1. Ground claims in specific proof of work from the attachments.
2. Separate demonstrated strengths from emerging gaps.
3. Be constructive and actionable.
4. Format responses in markdown.
5. When recommending next actions, use product- and workflow-specific language only — never suggest Think Aloud Protocol (TAP) sessions, completing workspace blocks, ILE practice, or other OpenLesson platform mechanics.

If proof of work is sparse, say what product/tool proof of work is missing and what observable actions to collect next.${buildPerformanceStyleSection(stylePrompt)}`;
}

