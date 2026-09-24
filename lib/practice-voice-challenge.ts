/**
 * Speak-aloud gate for ILE and scored TAP / Prepare, plus the ILE silence lock.
 * Pure: the UI speaks the script, feeds transcripts here, and starts or unlocks
 * only when these functions allow it.
 */

export const PRACTICE_VOICE_CHALLENGE_SCRIPT =
  "You will now speak your thinking out loud the whole time. That spoken thinking is a raw thinking signal and a baseline attention increase.";

/** Regular TAP: what the session expects, read after the speak-aloud lines. */
export const TAP_VOICE_CHALLENGE_SENTENCE_TWO =
  "In this session I will think out loud the whole time, read each question out loud, and press I'm done answering when I finish a chain of thought.";
export const TAP_VOICE_CHALLENGE_SCRIPT = `${PRACTICE_VOICE_CHALLENGE_SCRIPT} ${TAP_VOICE_CHALLENGE_SENTENCE_TWO}`;

/** ILE reads two sentences. The second is the session goal, with a sample card under it. */
export const ILE_VOICE_CHALLENGE_SENTENCE_ONE =
  "You will now speak your thinking out loud the whole time, which gives a raw thinking signal and a baseline attention increase.";
export const ILE_VOICE_CHALLENGE_SENTENCE_TWO =
  "In this session I will work to craft insights by working on the different areas of the map.";
export const ILE_VOICE_CHALLENGE_SCRIPT = `${ILE_VOICE_CHALLENGE_SENTENCE_ONE} ${ILE_VOICE_CHALLENGE_SENTENCE_TWO}`;
export const ILE_SAMPLE_INSIGHT_LABEL = "Sample insight";

export const PREPARE_VOICE_CHALLENGE_SENTENCE_TWO =
  "In this session I will map questions only, to see where my curiosity pulls before I work.";
export const DRILL_VOICE_CHALLENGE_SENTENCE_TWO =
  "In this session I will practice the topic out loud and keep answering until the drill is done.";
export const PREPARE_VOICE_CHALLENGE_SCRIPT = `${ILE_VOICE_CHALLENGE_SENTENCE_ONE} ${PREPARE_VOICE_CHALLENGE_SENTENCE_TWO}`;
export const DRILL_VOICE_CHALLENGE_SCRIPT = `${ILE_VOICE_CHALLENGE_SENTENCE_ONE} ${DRILL_VOICE_CHALLENGE_SENTENCE_TWO}`;

/** Share of each sentence that must be heard. Mic and browser misses stay under this. */
export const VOICE_CHALLENGE_PASS_RATIO = 0.8;
export const VOICE_CHALLENGE_START_DELAY_MS = 1100;

export const PRACTICE_VOICE_CHALLENGE_RETRY = "Try again";
export const PRACTICE_VOICE_CHALLENGE_READ_CUE = "Read this aloud to start";
export const PRACTICE_VOICE_CHALLENGE_READ_CUE_REST = "Read this aloud to continue";
export const PRACTICE_VOICE_CHALLENGE_READ_NOTE =
  "The session starts only when you read the lines below out loud. You will speak your thinking out loud the whole time. That is a raw thinking signal and a baseline attention increase.";

export const ILE_SILENCE_LOCK_MINUTES_MIN = 1;
export const ILE_SILENCE_LOCK_MINUTES_MAX = 30;
export const ILE_SILENCE_LOCK_MINUTES_DEFAULT = 5;

export const ILE_SILENCE_REST_TITLE = "Taking a rest";
export const ILE_SILENCE_REST_BODY =
  "The session is locked while you rest. Read the lines aloud to continue, or save and leave.";
export const ILE_SILENCE_REST_SAVE_AND_LEAVE = "Save and leave";

export const ILE_SESSION_IMPURITY_KICKER = "Session impurity";
export const ILE_SESSION_IMPURITY_TITLE = "Lost progress";
export const ILE_SESSION_IMPURITY_BODY = "It is ok to take a break.";
export const ILE_SESSION_IMPURITY_SAVE = "Save";
export const ILE_SESSION_IMPURITY_LOG_OFF = "Log off";

export const ILE_SILENCE_LOCK_MINUTES_LABEL = "Silence before a rest";
export const ILE_SILENCE_LOCK_MINUTES_DESC =
  "Minutes of silence before the session locks. This cannot be turned off.";

const SPEAK_OUT_LOUD = /speak(?:ing)? (?:your|my|their) thinking out loud/;
const WHOLE_TIME = /(?:the )?whole time|all the time/;
const RAW_SIGNAL = /raw thinking signal/;
const BASELINE_ATTENTION = /baseline attention/;

function normalizeChallengeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VoiceChallengeVariant = "tap" | "ile" | "prepare" | "drill";

export function voiceChallengeScriptFor(variant: VoiceChallengeVariant = "tap"): string {
  if (variant === "ile") return ILE_VOICE_CHALLENGE_SCRIPT;
  if (variant === "prepare") return PREPARE_VOICE_CHALLENGE_SCRIPT;
  if (variant === "drill") return DRILL_VOICE_CHALLENGE_SCRIPT;
  return TAP_VOICE_CHALLENGE_SCRIPT;
}

function sentenceWordRatios(script: string, transcript: string): number[] {
  const marks = voiceChallengeReadMarks({ script, transcript });
  const ratios: number[] = [];
  let words = 0;
  let heard = 0;
  const flush = () => {
    if (words > 0) ratios.push(heard / words);
    words = 0;
    heard = 0;
  };
  for (const mark of marks) {
    if (mark.kind === "word") {
      words += 1;
      if (mark.heard) heard += 1;
    }
    if (mark.kind === "punct" && mark.text.includes(".")) flush();
  }
  flush();
  return ratios;
}

/** Each sentence must be heard at the threshold. A weak sentence does not pass. */
export function voiceChallengeSentencesPass(
  script: string,
  transcript: string,
  ratio: number = VOICE_CHALLENGE_PASS_RATIO,
): boolean {
  const ratios = sentenceWordRatios(script, transcript);
  if (ratios.length === 0) return false;
  return ratios.every((heard) => heard + 1e-9 >= ratio);
}

/** Both points: speaking thinking out loud the whole time, and the why. */
export function practiceVoiceChallengeTranscriptPasses(transcript: string): boolean {
  return voiceChallengeSentencesPass(PRACTICE_VOICE_CHALLENGE_SCRIPT, transcript);
}

/** ILE also requires the second sentence about crafting insights. */
export function ileVoiceChallengeTranscriptPasses(transcript: string): boolean {
  return voiceChallengeSentencesPass(ILE_VOICE_CHALLENGE_SCRIPT, transcript);
}

/**
 * Keep text from earlier recognition sessions and append only this session's
 * result list. A restart must not drop the first sentence.
 */
export function mergeVoiceChallengeHeard(input: {
  committedText: string;
  sessionResults: readonly string[];
}): string {
  const session = input.sessionResults
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return [String(input.committedText ?? "").trim(), session]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One pass starts the workspace. A later matching transcript does not. */
export function latchVoiceChallengePass(input: {
  alreadyPassed: boolean;
  transcript: string;
  /** When true, the insight sentence is required as well as the speak-aloud lines. */
  ile?: boolean;
  variant?: VoiceChallengeVariant;
}): { passed: boolean; shouldStart: boolean } {
  if (input.alreadyPassed) return { passed: true, shouldStart: false };
  const variant = input.variant ?? (input.ile ? "ile" : "tap");
  const passes = voiceChallengeSentencesPass(voiceChallengeScriptFor(variant), input.transcript);
  if (!passes) return { passed: false, shouldStart: false };
  return { passed: true, shouldStart: true };
}

/**
 * Clear a partial read so the learner can speak the lines again.
 * Retry never starts the session. A finished pass is not cleared.
 */
export function retryVoiceChallenge(input: { alreadyPassed: boolean }): {
  reset: boolean;
  shouldStart: boolean;
} {
  if (input.alreadyPassed) return { reset: false, shouldStart: false };
  return { reset: true, shouldStart: false };
}

/** Hold the start latch after success. Release it only when start failed. */
export function releaseVoiceChallengeStartLatch(input: {
  startSucceeded: boolean;
}): { release: boolean } {
  return { release: input.startSucceeded !== true };
}

export type VoiceChallengeMark = {
  text: string;
  heard: boolean;
  kind: "word" | "space" | "punct";
};

/** Mark script words in order as the learner reads them aloud. */
export function voiceChallengeReadMarks(input: {
  script: string;
  transcript: string;
}): VoiceChallengeMark[] {
  const heardWords = normalizeChallengeTranscript(input.transcript).split(" ").filter(Boolean);
  let cursor = 0;
  const marks: VoiceChallengeMark[] = [];
  for (const part of input.script.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      marks.push({ text: part, heard: false, kind: "space" });
      continue;
    }
    const chunks = part.match(/[A-Za-z0-9']+|[^A-Za-z0-9'\s]+/g) ?? [part];
    for (const chunk of chunks) {
      const key = chunk.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key) {
        marks.push({ text: chunk, heard: false, kind: "punct" });
        continue;
      }
      const found = heardWords.indexOf(key, cursor);
      const heard = found !== -1;
      if (heard) cursor = found + 1;
      marks.push({ text: chunk, heard, kind: "word" });
    }
  }
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark || mark.kind !== "punct") continue;
    let prevHeard = false;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = marks[j];
      if (!prev || prev.kind !== "word") continue;
      prevHeard = prev.heard;
      break;
    }
    if (prevHeard) marks[i] = { ...mark, heard: true };
  }
  return marks;
}

export function voiceChallengeFillRatio(marks: readonly VoiceChallengeMark[]): number {
  const words = marks.filter((mark) => mark.kind === "word");
  if (words.length === 0) return 0;
  return words.filter((mark) => mark.heard).length / words.length;
}

export function voiceChallengeStartSucceeded(result: unknown): boolean {
  return Boolean(
    result &&
      typeof result === "object" &&
      "ok" in result &&
      (result as { ok?: unknown }).ok === true,
  );
}

export function clampIleSilenceLockMinutes(value: unknown): number {
  if (
    value === false ||
    value === "off" ||
    value === "Off" ||
    value === "OFF" ||
    value === 0 ||
    value === "0"
  ) {
    return ILE_SILENCE_LOCK_MINUTES_MIN;
  }
  if (value === undefined || value === null || value === "") {
    return ILE_SILENCE_LOCK_MINUTES_DEFAULT;
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return ILE_SILENCE_LOCK_MINUTES_MIN;
  return Math.min(
    ILE_SILENCE_LOCK_MINUTES_MAX,
    Math.max(ILE_SILENCE_LOCK_MINUTES_MIN, Math.round(n)),
  );
}

/** A muted, missing, or ended mic is silence — it must not look like speech. */
export function ileMicCountsAsSilence(input: {
  muted: boolean;
  hasStream: boolean;
  audioTracks: readonly { muted: boolean; enabled: boolean; readyState: string }[];
}): boolean {
  if (input.muted || !input.hasStream || input.audioTracks.length === 0) return true;
  return input.audioTracks.every(
    (track) => track.muted || !track.enabled || track.readyState === "ended",
  );
}

export function ileSilenceShouldLock(input: {
  silenceMs: number;
  minutes: unknown;
}): boolean {
  const minutes = clampIleSilenceLockMinutes(input.minutes);
  if (!Number.isFinite(input.silenceMs) || input.silenceMs < 0) return false;
  return input.silenceMs >= minutes * 60_000;
}

export type IleSilenceLockOutcome = "continue" | "rest" | "impurity";

/** Locks 1 and 2 are a rest. The third lock is impurity and does not return to work. */
export function ileSilenceLockOutcome(lockCount: number): IleSilenceLockOutcome {
  if (lockCount >= 3) return "impurity";
  if (lockCount >= 1) return "rest";
  return "continue";
}

export function nextIleSilenceLock(input: {
  lockCount: number;
  silenceMs: number;
  minutes: unknown;
  alreadyLatched: boolean;
}): { lockCount: number; latched: boolean; outcome: IleSilenceLockOutcome } {
  if (input.alreadyLatched) {
    return {
      lockCount: input.lockCount,
      latched: true,
      outcome: ileSilenceLockOutcome(input.lockCount),
    };
  }
  if (!ileSilenceShouldLock({ silenceMs: input.silenceMs, minutes: input.minutes })) {
    return { lockCount: input.lockCount, latched: false, outcome: "continue" };
  }
  const lockCount = Math.max(0, input.lockCount) + 1;
  return {
    lockCount,
    latched: true,
    outcome: ileSilenceLockOutcome(lockCount),
  };
}

/**
 * New non-empty heard text is speech and restarts the quiet clock.
 * The same text, or an empty bar, does not.
 */
export function ileSilenceSpeechMark(input: {
  previous: string;
  next: string;
}): { mark: string; restart: boolean } {
  const next = input.next.trim();
  const previous = input.previous.trim();
  if (!next || next === previous) return { mark: previous, restart: false };
  return { mark: next, restart: true };
}

/**
 * One tick of the ILE silence clock.
 * A muted mic cannot be kept alive by leftover transcript text.
 * Loudness is not speech: only a changed transcript restarts the clock.
 */
export function advanceIleSilenceClock(input: {
  now: number;
  lastSoundAt: number;
  lockCount: number;
  minutes: unknown;
  holding: boolean;
  micSilent: boolean;
  previousSpeech: string;
  speechText: string;
}): {
  lastSoundAt: number;
  lockCount: number;
  holding: boolean;
  speech: string;
  outcome: IleSilenceLockOutcome;
} {
  let lastSoundAt = input.lastSoundAt;
  let speech = input.previousSpeech;
  if (!input.micSilent) {
    const heard = ileSilenceSpeechMark({ previous: speech, next: input.speechText });
    speech = heard.mark;
    if (heard.restart) lastSoundAt = input.now;
  }
  if (input.holding) {
    return {
      lastSoundAt,
      lockCount: input.lockCount,
      holding: true,
      speech,
      outcome: ileSilenceLockOutcome(input.lockCount),
    };
  }
  const step = nextIleSilenceLock({
    lockCount: input.lockCount,
    silenceMs: input.now - lastSoundAt,
    minutes: input.minutes,
    alreadyLatched: false,
  });
  const latched = step.lockCount !== input.lockCount;
  return {
    lastSoundAt,
    lockCount: step.lockCount,
    holding: latched,
    speech,
    outcome: latched ? step.outcome : "continue",
  };
}

/** A rest unlocks only when the voice challenge passes. Impurity never unlocks. */
export function ileRestUnlock(input: {
  challengePassed: boolean;
  lockCount: number;
}): { locked: boolean } {
  if (ileSilenceLockOutcome(input.lockCount) === "impurity") return { locked: true };
  if (!input.challengePassed) return { locked: true };
  return { locked: false };
}

export function ileWorkspaceStartAllowed(challengePassed: boolean): boolean {
  return challengePassed === true;
}

export type ScoredTapBriefingChoice = "topic" | "practice" | null;

/** Topic or practice is chosen first. The voice challenge is second. Live is third. */
export function scoredTapBriefingStep(input: {
  choice: ScoredTapBriefingChoice;
  challengePassed: boolean;
}): "pick" | "challenge" | "live" {
  if (input.choice !== "topic" && input.choice !== "practice") return "pick";
  if (!input.challengePassed) return "challenge";
  return "live";
}

/** Prepare confirms start, then the same voice challenge, then live. */
export function prepareBriefingStep(input: {
  startConfirmed: boolean;
  challengePassed: boolean;
}): "confirm" | "challenge" | "live" {
  if (!input.startConfirmed) return "confirm";
  if (!input.challengePassed) return "challenge";
  return "live";
}

export function ileImpurityExitPlan(action: "save" | "logoff"): {
  persistSession: boolean;
  leave: boolean;
} {
  if (action === "save") return { persistSession: true, leave: true };
  return { persistSession: true, leave: true };
}
