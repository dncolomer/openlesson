import type { InterruptionContext } from "@/lib/pow-api/predictive-interruption";

/** Expected-free-energy interruption is not attached to proof-of-work responses. */
export function resolvePowInterruptionContext(_input: {
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
  return null;
}
