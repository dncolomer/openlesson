/**
 * Browser fetch that projects one spoken Calibrate gap onto nearby frozen branches.
 * Tests never call this module.
 */

import {
  soundingVoiceInferEvents,
  soundingVoiceSubmissionFromReply,
  type SoundingProofCandidate,
  type SoundingVoiceSubmission,
} from "@/lib/calibrate-sounding";
import { requestSessionPolicyReply } from "@/lib/session-policy-infer-client";

export async function inferSoundingVoiceStep(input: {
  prepare: Record<string, unknown>;
  stillText: string;
  transcript: string;
  candidates: readonly SoundingProofCandidate[];
}): Promise<
  { ok: true; submission: SoundingVoiceSubmission } | { ok: false; error: string }
> {
  const transcript = input.transcript.trim();
  if (!transcript) return { ok: true, submission: { transcript: "", skip: true } };
  const reply = await requestSessionPolicyReply({
    ...input.prepare,
    phase: "project",
    nodeTitle: input.stillText,
    candidates: input.candidates,
    events: soundingVoiceInferEvents({ stillText: input.stillText, transcript }),
  });
  if (!reply) {
    return { ok: false, error: "The check could not be read. Speak again and submit." };
  }
  return {
    ok: true,
    submission: soundingVoiceSubmissionFromReply({
      transcript,
      reply,
      allowedIds: input.candidates.map((row) => row.id),
    }),
  };
}
