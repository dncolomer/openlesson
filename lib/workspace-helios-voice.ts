/**
 * Helios Learning Map builder voice: browser SpeechRecognition transcript.
 * Reuses the TAP live-recognition helpers; this is authoring talk-to-Helios,
 * not session Helios.
 */

import type { SpeechRecognitionEventLike } from "@/lib/useSessionThoughtInterface";

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function heliosSpeechUtteranceFromEvent(
  event: SpeechRecognitionEventLike,
): { finals: string; interim: string } {
  const finals: string[] = [];
  let interim = "";
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    const transcript = normalize(result[0]?.transcript || "");
    if (!transcript) continue;
    if (result.isFinal) finals.push(transcript);
    else if (i >= event.resultIndex) {
      interim = normalize(`${interim} ${transcript}`);
    }
  }
  return { finals: normalize(finals.join(" ")), interim };
}

/** New final speech since the last submitted utterance. */
export function heliosSpeechFinalDelta(
  finals: string,
  alreadySent: string,
): string {
  const next = normalize(finals);
  const prev = normalize(alreadySent);
  if (!next) return "";
  if (!prev) return next;
  if (next === prev) return "";
  if (next.startsWith(prev)) return normalize(next.slice(prev.length));
  return next;
}
