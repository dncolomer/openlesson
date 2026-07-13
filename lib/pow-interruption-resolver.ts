import type { InterruptionContext, ProofOfWorkApiEndpoint } from "@/lib/agent-v2/predictive-interruption";
import { ILE_CHAT_TOOL_NAME, ILE_IDLE_TOOL_NAME, ILE_SPEECH_TOOL_NAME, ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";
import { TAP_CHAT_TOOL_NAME, TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";
import { TAP_IDLE_TOOL_NAME } from "@/lib/tap-idle-proof-of-work";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";

export function resolvePowInterruptionContext(input: {
  workspaceId: string;
  blockId?: string | null;
  toolName?: string | null;
  toolAction?: string | null;
  proofOfWorkCount: number;
  artifact_summary?: string | null;
  artifact_metadata?: Record<string, unknown> | null;
  idle_duration_ms?: number | null;
  speech_transcript?: string | null;
}): InterruptionContext | null {
  const toolName = input.toolName || "";
  const toolAction = input.toolAction || "";

  let endpoint: ProofOfWorkApiEndpoint | null = null;
  let tapAction: string | null = null;

  if (toolName === TAP_TRACE_TOOL_NAME || toolName === ILE_TRACE_TOOL_NAME) {
    endpoint = toolName === ILE_TRACE_TOOL_NAME ? "upload_ile_trace" : "upload_tap_trace";
    tapAction = toolAction || null;
  } else if (toolName === TAP_CHAT_TOOL_NAME || toolName === ILE_CHAT_TOOL_NAME) {
    endpoint = toolName === ILE_CHAT_TOOL_NAME ? "upload_ile_chat" : "upload_tap_chat";
  } else if (toolName === TAP_IDLE_TOOL_NAME || toolName === ILE_IDLE_TOOL_NAME) {
    endpoint = toolName === ILE_IDLE_TOOL_NAME ? "upload_ile_idle" : "upload_tap_idle";
  } else if (toolName === TAP_SPEECH_TOOL_NAME || toolName === ILE_SPEECH_TOOL_NAME) {
    endpoint = toolName === ILE_SPEECH_TOOL_NAME ? "upload_ile_speech" : "upload_tap_speech";
    tapAction = toolAction || null;
  }

  if (!endpoint) return null;

  return {
    endpoint,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    proof_of_work_artifacts: input.proofOfWorkCount,
    tool_name: toolName || null,
    tap_action: tapAction,
    artifact_summary: input.artifact_summary ?? null,
    artifact_metadata: input.artifact_metadata ?? null,
    idle_duration_ms: input.idle_duration_ms ?? null,
    speech_transcript: input.speech_transcript ?? null,
  };
}