/**
 * Calibrate sounding: a rabbit-hole of stills. Tap every question you would
 * not trust yourself to answer. The tree zooms, stays, or stops from the
 * tap count. Classification is coverage depth plus persistence. Coverage
 * or a marked gap then gets one spoken forage step, projected onto nearby
 * frozen branches. Cards show the generated question on each still.
 * Tree and pool construction live in calibrate-sounding-tree.
 */

import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";
import {
  sessionBranchById,
  type SessionBranch,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import {
  SOUNDING_MAX_SCREENS_PER_ROUND,
  SOUNDING_ROUND_COUNT,
  SOUNDING_SCREEN_SIZE,
  byId,
  childrenOf,
  mergeSoundingStills,
  padCandidates,
  pickFollowUpScreen,
  pickScreen,
  shuffleSoundingItems,
  soundingRng,
  stillsAtDepth,
  unusedOf,
  type SoundingRng,
  type SoundingScreen,
  type SoundingStill,
} from "@/lib/calibrate-sounding-tree";

export {
  SOUNDING_MAX_SCREENS_PER_ROUND,
  SOUNDING_POOL_COUNT,
  SOUNDING_ROUND_COUNT,
  SOUNDING_SCREEN_SIZE,
  createSoundingTree,
  shuffleSoundingItems,
  soundingRng,
  soundingStillCardText,
  soundingStillsFromBranchModel,
  soundingStillsFromQuestions,
  soundingTreeIsTravelable,
} from "@/lib/calibrate-sounding-tree";
export type { SoundingRng, SoundingScreen, SoundingStill } from "@/lib/calibrate-sounding-tree";

export const SOUNDING_CANT_TELL = "cant-tell";
export const SOUNDING_PERSISTENCE_MIN = 0.34;
export const SOUNDING_COVERAGE_GRAIN = 2;
/** Winner must be at least this sure before coverage holds. */
export const SOUNDING_POLICY_MIN_CONFIDENCE = 0.4;
export const SOUNDING_CARD_MIN_WORDS = 8;
export const SOUNDING_GAP_NONE = "none";

export const SOUNDING_INSTRUCTION =
  "Tap every question you would not trust yourself to answer.";
export const SOUNDING_PASS_HINT =
  "Continue brings another set, drawn from the cards you just marked.";
export const SOUNDING_PROOF_PROMPT =
  "This is a gap you marked. Say what is uncertain, and how you would look next to fill it.";
export const SOUNDING_TRUSTED_PROOF_PROMPT =
  "You did not mark this question as uncertain. Say how you would work it.";
export const SOUNDING_CANT_TELL_LABEL = "I can't tell";
export const SOUNDING_CONTINUE_LABEL = "Continue";

export const SOUNDING_BANDS = ["unranked", "lost", "localized", "coverage"] as const;
export type SoundingBand = (typeof SOUNDING_BANDS)[number];

export type SoundingRule = "zoom-finer" | "rabbit-hole" | "stay-grain" | "stop-deeper";

export type SoundingTap = {
  round: number;
  grain: number;
  stillIds: string[];
  tappedIds: string[];
  rule: SoundingRule;
};

export type SoundingProofCandidate = {
  id: string;
  title: string;
  observation: string;
};

export type SoundingProofKind = "gap" | "trusted";

export type SoundingProof = {
  stillId: string;
  prompt: string;
  stillText: string;
  candidates: SoundingProofCandidate[];
  kind: SoundingProofKind;
};

export type SoundingProofChoice = "hit" | "miss" | "cant-tell";

export type SoundingVoiceSubmission = {
  transcript?: string | null;
  candidateId?: string | null;
  confidence?: number | null;
  skip?: boolean;
};

export type SoundingClassification = {
  band: SoundingBand;
  coverageDepth: number;
  reliability: "high" | "low";
  persistentTerritories: string[];
  falseCoverage: boolean;
};

export type SoundingPhase = "sounding" | "expert-proof" | "complete";

export type SoundingState = {
  stills: SoundingStill[];
  shownIds: string[];
  taps: SoundingTap[];
  round: number;
  current: SoundingScreen | null;
  phase: SoundingPhase;
  classification: SoundingClassification | null;
  proof: SoundingProof | null;
  proofChoice: SoundingProofChoice | null;
  proofTranscript: string | null;
  proofInferredAction: string | null;
  proofConfidence: number | null;
  model: SessionBranchModel | null;
  seed: string;
};

export function soundingRuleForTapCount(count: number): SoundingRule {
  if (count <= 0) return "zoom-finer";
  if (count === 1) return "rabbit-hole";
  if (count === 2) return "stay-grain";
  return "stop-deeper";
}

function trimText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function absorbSoundingStills(
  state: SoundingState,
  extra: readonly SoundingStill[],
  model?: SessionBranchModel | null,
): SoundingState {
  if (state.phase === "complete" || state.phase === "expert-proof") return state;
  const merged = mergeSoundingStills(state.stills, extra);
  const nextModel =
    model && (!state.model || model.branches.length >= state.model.branches.length)
      ? model
      : state.model;
  if (merged.length === state.stills.length && nextModel === state.model) return state;
  return { ...state, stills: merged, model: nextModel };
}

export function createSoundingState(
  stills: readonly SoundingStill[],
  seed = "sounding",
  model: SessionBranchModel | null = null,
): SoundingState {
  const rnd = soundingRng(seed);
  const depths = stills.map((still) => still.depth);
  const minDepth = depths.length ? Math.min(...depths) : 1;
  const opening = pickScreen(stillsAtDepth(stills, minDepth), rnd);
  return {
    stills: [...stills],
    shownIds: opening ? opening.stills.map((still) => still.id) : [],
    taps: [],
    round: 1,
    current: opening,
    phase: opening ? "sounding" : "complete",
    classification: opening ? null : emptyClassification("unranked"),
    proof: null,
    proofChoice: null,
    proofTranscript: null,
    proofInferredAction: null,
    proofConfidence: null,
    model,
    seed,
  };
}

function emptyClassification(band: SoundingBand): SoundingClassification {
  return {
    band,
    coverageDepth: 0,
    reliability: band === "unranked" ? "low" : "high",
    persistentTerritories: [],
    falseCoverage: false,
  };
}

function screensInRound(state: SoundingState, round: number): number {
  return state.taps.filter((tap) => tap.round === round).length;
}

function nextFromRule(
  state: SoundingState,
  rule: SoundingRule,
  shown: readonly SoundingStill[],
  tapped: readonly SoundingStill[],
  rnd: SoundingRng,
): SoundingScreen | null {
  const unused = unusedOf(state.stills, state.shownIds);
  const grain = shown[0]?.depth ?? 1;
  if (rule === "stop-deeper") return null;
  if (rule === "zoom-finer") {
    const kids = unusedOf(childrenOf(state.stills, shown.map((still) => still.id)), state.shownIds);
    return (
      pickFollowUpScreen(padCandidates(kids, stillsAtDepth(unused, grain + 1)), rnd) ??
      pickFollowUpScreen(unused, rnd)
    );
  }
  if (rule === "rabbit-hole") {
    const pin = tapped[0];
    if (!pin) return pickFollowUpScreen(unused, rnd);
    const kids = unusedOf(childrenOf(state.stills, [pin.id]), state.shownIds);
    return (
      pickFollowUpScreen(padCandidates(kids, stillsAtDepth(unused, pin.depth + 1)), rnd) ??
      pickFollowUpScreen(unused, rnd)
    );
  }
  const parents = tapped.map((still) => still.id);
  const sameGrain = unused.filter(
    (still) => still.depth === grain && (parents.includes(still.parentId || "") || parents.includes(still.territory)),
  );
  return (
    pickFollowUpScreen(padCandidates(sameGrain, stillsAtDepth(unused, grain)), rnd) ??
    pickFollowUpScreen(unused, rnd)
  );
}

function screenFromStills(stills: readonly SoundingStill[]): SoundingScreen | null {
  if (stills.length < 1) return null;
  const picked = stills.slice(0, SOUNDING_SCREEN_SIZE);
  if (!picked.length) return null;
  const grain = Math.min(...picked.map((still) => still.depth));
  return { stills: picked, grain };
}

function roundTwoScreen(state: SoundingState, rnd: SoundingRng): SoundingScreen | null {
  const unused = unusedOf(state.stills, state.shownIds);
  const last = state.taps[state.taps.length - 1];
  const oneTaps = state.taps.filter((tap) => tap.tappedIds.length === 1);
  const lastOne = oneTaps[oneTaps.length - 1];
  if (lastOne) {
    const pin = byId(state.stills).get(lastOne.tappedIds[0] || "");
    if (pin) {
      const kids = unusedOf(childrenOf(state.stills, [pin.id]), state.shownIds);
      const same = unused.filter((still) => still.territory === pin.territory);
      const fromPin = padCandidates(kids, same);
      const skip = shuffleSoundingItems(
        unused.filter((still) => still.territory !== pin.territory),
        rnd,
      );
      const mixed = [...fromPin.slice(0, 2), ...skip.slice(0, 1), ...fromPin.slice(2), ...skip.slice(1)];
      const forced = screenFromStills(mixed);
      if (forced) return forced;
      return pickFollowUpScreen(unused, rnd);
    }
  }
  if (last?.rule === "zoom-finer") {
    return (
      pickFollowUpScreen(stillsAtDepth(unused, (last.grain || 1) + 1), rnd) ??
      pickFollowUpScreen(unused, rnd)
    );
  }
  if (last?.rule === "stop-deeper") {
    return (
      pickFollowUpScreen(stillsAtDepth(unused, last.grain || 1), rnd) ??
      pickFollowUpScreen(unused, rnd)
    );
  }
  return pickFollowUpScreen(unused, rnd);
}

function territoryOf(state: SoundingState, stillId: string): string {
  const still = byId(state.stills).get(stillId);
  return still?.territory || stillId;
}

function tappedTerritoriesForRound(
  state: SoundingState,
  round: number,
  uniqueOnly = false,
): Set<string> {
  const set = new Set<string>();
  for (const tap of state.taps) {
    if (tap.round !== round) continue;
    if (uniqueOnly && tap.tappedIds.length !== 1) continue;
    for (const id of tap.tappedIds) set.add(territoryOf(state, id));
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function classifySounding(state: SoundingState): SoundingClassification {
  const rounds = new Set(state.taps.map((tap) => tap.round));
  const roundList = [...rounds].sort((a, b) => a - b);
  const zeroTrunkDepth = Math.max(
    0,
    ...state.taps.filter((tap) => tap.tappedIds.length === 0).map((tap) => tap.grain),
  );
  const localizedDepth = Math.max(
    0,
    ...state.taps.filter((tap) => tap.tappedIds.length === 1).map((tap) => tap.grain),
  );
  const first = state.taps[0];
  const unlocalizedOpen = (first?.tappedIds.length ?? 0) >= SOUNDING_SCREEN_SIZE;
  const openedWithZero = (first?.tappedIds.length ?? -1) === 0;
  const zeroOnly = state.taps.length > 0 && state.taps.every((tap) => tap.tappedIds.length === 0);
  let persistence = 0;
  if (roundList.length >= 2) {
    persistence = Math.max(
      jaccard(
        tappedTerritoriesForRound(state, roundList[0]!),
        tappedTerritoriesForRound(state, roundList[1]!),
      ),
      jaccard(
        tappedTerritoriesForRound(state, roundList[0]!, true),
        tappedTerritoriesForRound(state, roundList[1]!, true),
      ),
    );
  } else if (zeroOnly) {
    persistence = 1;
  } else if (roundList.length === 1 && unlocalizedOpen) {
    persistence = 1;
  }
  const reliability: "high" | "low" =
    zeroOnly || unlocalizedOpen || persistence + 1e-9 >= SOUNDING_PERSISTENCE_MIN
      ? "high"
      : "low";
  const firstRoundPins = tappedTerritoriesForRound(state, roundList[0] || 1, true);
  const laterPins =
    roundList.length < 2 ? firstRoundPins : tappedTerritoriesForRound(state, roundList[1]!, true);
  const persistentTerritories = [...firstRoundPins].filter((id) => laterPins.has(id));
  const coverageDepth = Math.max(zeroTrunkDepth, reliability === "high" ? localizedDepth : 0);
  if (unlocalizedOpen && localizedDepth <= 1) {
    return {
      band: "lost",
      coverageDepth,
      reliability: "high",
      persistentTerritories,
      falseCoverage: false,
    };
  }
  if (reliability === "low" && !zeroOnly) {
    return {
      band: "unranked",
      coverageDepth,
      reliability,
      persistentTerritories: [],
      falseCoverage: false,
    };
  }
  if (openedWithZero && zeroTrunkDepth >= SOUNDING_COVERAGE_GRAIN) {
    return {
      band: "coverage",
      coverageDepth: Math.max(zeroTrunkDepth, coverageDepth),
      reliability: "high",
      persistentTerritories,
      falseCoverage: false,
    };
  }
  if (localizedDepth >= 1) {
    return {
      band: "localized",
      coverageDepth,
      reliability: "high",
      persistentTerritories,
      falseCoverage: false,
    };
  }
  return {
    band: "lost",
    coverageDepth,
    reliability: "high",
    persistentTerritories,
    falseCoverage: false,
  };
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function soundingLocalCandidates(
  model: SessionBranchModel,
  stillId: string,
): SoundingProofCandidate[] {
  const focus = sessionBranchById(model, stillId);
  if (!focus) return [];
  const seen = new Set<string>([stillId]);
  const out: SoundingProofCandidate[] = [];
  const push = (branch: SessionBranch | null | undefined) => {
    if (!branch || seen.has(branch.id) || branch.parentId == null) return;
    const title =
      trimText(branch.question) || trimText(branch.title) || trimText(branch.observation);
    if (!title) return;
    seen.add(branch.id);
    out.push({
      id: branch.id,
      title,
      observation: trimText(branch.observation) || title,
    });
  };
  for (const branch of model.branches) {
    if (branch.parentId === stillId) push(branch);
  }
  for (const branch of model.branches) {
    if (branch.territory === focus.territory && branch.depth > focus.depth) push(branch);
  }
  for (const branch of model.branches) {
    if (branch.parentId === focus.parentId && branch.id !== stillId) push(branch);
  }
  return out.slice(0, 6);
}

export function soundingVoiceStepMatches(input: {
  allowedIds: readonly string[];
  candidateId?: string | null;
  confidence?: number | null;
  transcript?: string | null;
  skip?: boolean;
}): boolean {
  if (input.skip) return false;
  if (!trimText(input.transcript)) return false;
  const candidateId = trimText(input.candidateId);
  if (!candidateId || candidateId === SOUNDING_GAP_NONE) return false;
  if (!input.allowedIds.includes(candidateId)) return false;
  return (input.confidence ?? 0) + 1e-9 >= SOUNDING_POLICY_MIN_CONFIDENCE;
}

export function soundingVoiceInferEvents(input: {
  stillText: string;
  transcript: string;
}): { action: string; prompt: string }[] {
  return [
    { action: "gap", prompt: trimText(input.stillText) },
    { action: "speech", prompt: trimText(input.transcript) },
  ].filter((event) => event.prompt);
}

export function parseSoundingGapReply(
  raw: string,
  allowedIds: readonly string[],
): { candidateId: string; confidence: number } | null {
  const packed = extractJsonObject(raw.trim());
  if (!packed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(packed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as { candidateId?: unknown; confidence?: unknown };
  const candidateId = trimText(row.candidateId);
  if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence)) return null;
  const scale = row.confidence > 1 ? 100 : 1;
  const confidence = row.confidence / scale;
  if (confidence < 0 || confidence > 1) return null;
  if (candidateId === SOUNDING_GAP_NONE) return { candidateId, confidence };
  if (!allowedIds.includes(candidateId)) return null;
  return { candidateId, confidence };
}

export function soundingVoiceSubmissionFromReply(input: {
  transcript: string;
  reply: string | null;
  allowedIds: readonly string[];
}): SoundingVoiceSubmission {
  const transcript = trimText(input.transcript);
  if (!transcript) return { transcript: "", skip: true };
  const parsed = input.reply ? parseSoundingGapReply(input.reply, input.allowedIds) : null;
  if (!parsed) return { transcript, candidateId: null, confidence: null };
  return {
    transcript,
    candidateId: parsed.candidateId,
    confidence: parsed.confidence,
  };
}

function proofFromStill(
  model: SessionBranchModel,
  still: SoundingStill,
  kind: SoundingProofKind,
): SoundingProof | null {
  const candidates = soundingLocalCandidates(model, still.id);
  if (candidates.length < 2) return null;
  return {
    stillId: still.id,
    prompt: still.text,
    stillText: still.text,
    candidates,
    kind,
  };
}

export function buildSoundingProof(state: SoundingState): SoundingProof | null {
  const model = state.model;
  if (!model) return null;
  const lookup = byId(state.stills);
  const counts = new Map<string, number>();
  for (const tap of state.taps) {
    for (const id of tap.tappedIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rankedGaps = [...counts.entries()]
    .map(([id, count]) => ({ still: lookup.get(id), count }))
    .filter((row): row is { still: SoundingStill; count: number } => Boolean(row.still))
    .sort(
      (a, b) =>
        b.count - a.count || b.still.depth - a.still.depth || a.still.id.localeCompare(b.still.id),
    );
  for (const { still } of rankedGaps) {
    const proof = proofFromStill(model, still, "gap");
    if (proof) return proof;
  }
  const trusted = state.shownIds
    .map((id) => lookup.get(id))
    .filter((still): still is SoundingStill => Boolean(still))
    .sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
  for (const still of trusted) {
    const proof = proofFromStill(model, still, "trusted");
    if (proof) return proof;
  }
  return null;
}

function closeSounding(state: SoundingState): SoundingState {
  const classification = classifySounding(state);
  const mayCheck = classification.band === "coverage" || classification.band === "localized";
  const proof = mayCheck ? buildSoundingProof(state) : null;
  if (proof) {
    return {
      ...state,
      current: null,
      phase: "expert-proof",
      classification,
      proof,
    };
  }
  const unconfirmed =
    classification.band === "coverage" && !state.model
      ? { ...classification, band: "lost" as const, falseCoverage: true }
      : classification;
  return {
    ...state,
    current: null,
    phase: "complete",
    classification: unconfirmed,
    proof: null,
  };
}

function startNextRound(state: SoundingState): SoundingState {
  const rnd = soundingRng(`${state.seed}:r${state.round + 1}:${state.taps.length}`);
  const screen = roundTwoScreen(state, rnd);
  if (!screen) return closeSounding(state);
  return {
    ...state,
    round: state.round + 1,
    current: screen,
    shownIds: [...state.shownIds, ...screen.stills.map((still) => still.id)],
  };
}

export function commitSoundingTaps(
  state: SoundingState,
  tappedIds: readonly string[],
): SoundingState {
  if (state.phase !== "sounding" || !state.current) return state;
  const shown = state.current.stills;
  const allowed = new Set(shown.map((still) => still.id));
  const tapped = [...new Set(tappedIds.filter((id) => allowed.has(id)))];
  const rule = soundingRuleForTapCount(tapped.length);
  const tap: SoundingTap = {
    round: state.round,
    grain: state.current.grain,
    stillIds: shown.map((still) => still.id),
    tappedIds: tapped,
    rule,
  };
  const nextTaps = [...state.taps, tap];
  const withTap: SoundingState = { ...state, taps: nextTaps };
  const roundFull = screensInRound(withTap, state.round) >= SOUNDING_MAX_SCREENS_PER_ROUND;
  if (rule === "stop-deeper" || roundFull) {
    if (state.round >= SOUNDING_ROUND_COUNT) return closeSounding(withTap);
    return startNextRound(withTap);
  }
  const rnd = soundingRng(`${state.seed}:s${nextTaps.length}`);
  const screen = nextFromRule(
    withTap,
    rule,
    shown,
    shown.filter((still) => tapped.includes(still.id)),
    rnd,
  );
  if (!screen) {
    if (state.round >= SOUNDING_ROUND_COUNT) return closeSounding(withTap);
    return startNextRound(withTap);
  }
  return {
    ...withTap,
    current: screen,
    shownIds: [...state.shownIds, ...screen.stills.map((still) => still.id)],
  };
}

export function submitSoundingProof(
  state: SoundingState,
  submission: SoundingVoiceSubmission | string = {},
): SoundingState {
  if (state.phase !== "expert-proof" || !state.proof || !state.classification) return state;
  const payload: SoundingVoiceSubmission =
    typeof submission === "string"
      ? submission === SOUNDING_CANT_TELL || !submission.trim()
        ? { transcript: "", skip: true }
        : { transcript: submission }
      : submission;
  const allowedIds = state.proof.candidates.map((row) => row.id);
  const hit = soundingVoiceStepMatches({
    allowedIds,
    candidateId: payload.candidateId,
    confidence: payload.confidence,
    transcript: payload.transcript,
    skip: payload.skip,
  });
  const transcript = trimText(payload.transcript);
  const choice: SoundingProofChoice = payload.skip || !transcript ? "cant-tell" : hit ? "hit" : "miss";
  if (hit) {
    return {
      ...state,
      phase: "complete",
      proofChoice: choice,
      proofTranscript: transcript || null,
      proofInferredAction: payload.candidateId ?? null,
      proofConfidence: payload.confidence ?? null,
      classification: { ...state.classification, falseCoverage: false },
    };
  }
  const hadPin = state.taps.some((tap) => tap.tappedIds.length === 1);
  const demoted =
    state.classification.band === "coverage" ? (hadPin ? "localized" : "lost") : state.classification.band;
  return {
    ...state,
    phase: "complete",
    proofChoice: choice,
    proofTranscript: transcript || null,
    proofInferredAction: payload.candidateId ?? null,
    proofConfidence: payload.confidence ?? null,
    classification: {
      ...state.classification,
      band: demoted,
      falseCoverage: true,
    },
  };
}

export function finishSounding(state: SoundingState, allowProof = true): SoundingState {
  if (state.phase === "complete") return state;
  if (state.phase === "expert-proof") {
    if (allowProof) return state;
    return submitSoundingProof(state, { skip: true });
  }
  const closed = closeSounding({ ...state, current: null });
  if (!allowProof && closed.phase === "expert-proof") {
    return submitSoundingProof(closed, { skip: true });
  }
  return closed;
}

export function soundingBandCopy(band: SoundingBand): { title: string; body: string } {
  if (band === "coverage") {
    return {
      title: "The questions stayed precise",
      body: "You kept tapping into finer questions. Those taps are saved for later Learn sessions.",
    };
  }
  if (band === "localized") {
    return {
      title: "One set of questions stayed uncertain",
      body: "The same part of the topic kept coming back. Those taps are saved for later Learn sessions.",
    };
  }
  if (band === "lost") {
    return {
      title: "The opening questions did not split",
      body: "The first questions did not separate into ones you trusted and ones you did not. Those taps are saved for later Learn sessions.",
    };
  }
  return {
    title: "The uncertain questions were spread out",
    body: "You marked questions from more than one part of the topic, so no single set stood out. Those taps are saved for later Learn sessions.",
  };
}

export function soundingProgress(state: SoundingState): {
  pass: number;
  passes: number;
  set: number;
  label: string;
  hint: string;
} {
  if (state.phase === "expert-proof") {
    return {
      pass: Math.max(1, state.round),
      passes: SOUNDING_ROUND_COUNT,
      set: 0,
      label: "One more check",
      hint:
        state.proof?.kind === "trusted"
          ? SOUNDING_TRUSTED_PROOF_PROMPT
          : SOUNDING_PROOF_PROMPT,
    };
  }
  const pass = Math.max(1, state.round);
  const set = screensInRound(state, state.round) + (state.current ? 1 : 0);
  const opening = pass === 1 && set <= 1;
  return {
    pass,
    passes: SOUNDING_ROUND_COUNT,
    set: Math.max(1, set),
    label: `Pass ${pass} of ${SOUNDING_ROUND_COUNT}`,
    hint: opening ? SOUNDING_INSTRUCTION : SOUNDING_PASS_HINT,
  };
}

export function soundingResultPresentation(
  classification: SoundingClassification | null | undefined,
): {
  kicker: string;
  title: string;
  body: string;
  depthLabel: string | null;
  note: string | null;
} | null {
  if (!classification) return null;
  const copy = soundingBandCopy(classification.band);
  return {
    kicker: "Calibrate",
    title: copy.title,
    body: copy.body,
    depthLabel:
      classification.coverageDepth > 0
        ? `Reached finer questions · ${classification.coverageDepth}`
        : null,
    note: classification.falseCoverage
      ? "A later check did not match a nearby question."
      : null,
  };
}

export function soundingProofMetadata(state: SoundingState): Record<string, unknown> {
  const classification = state.classification ?? classifySounding(state);
  return {
    sounding: true,
    calibrate_session: true,
    verification_run: false,
    sounding_band: classification.band,
    sounding_coverage_depth: classification.coverageDepth,
    sounding_reliability: classification.reliability,
    sounding_false_coverage: classification.falseCoverage,
    sounding_persistent_territories: classification.persistentTerritories,
    sounding_taps: state.taps,
    sounding_proof_still: state.proof?.stillId ?? null,
    sounding_proof_choice: state.proofChoice,
    sounding_proof_candidates: state.proof?.candidates.map((row) => row.id) ?? [],
    sounding_proof_inferred_action: state.proofInferredAction,
    sounding_proof_confidence: state.proofConfidence,
    sounding_proof_transcript: state.proofTranscript,
  };
}

export function soundingProofEvent(state: SoundingState): {
  type: "sounding";
  questionId: string;
  text: string;
  source: "typed";
} {
  const classification = state.classification ?? classifySounding(state);
  return {
    type: "sounding",
    questionId: classification.band,
    text: JSON.stringify(soundingProofMetadata(state)),
    source: "typed",
  };
}

export function soundingProofUploadItem(state: SoundingState): IleProofOfWorkUploadItem {
  const metadata = soundingProofMetadata(state);
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: "calibrate-sounding.json",
    payload: JSON.stringify(metadata),
    timestampMs: 1,
    toolName: "probe",
    toolAction: "sounding",
    metadata,
  };
}

export function soundingCompleteTranscript(input: {
  seedText: string;
  state: SoundingState;
}): Array<{ role: "assistant" | "user"; text: string; at: string }> {
  const at = new Date().toISOString();
  const classification = input.state.classification ?? classifySounding(input.state);
  const copy = soundingBandCopy(classification.band);
  return [
    { role: "assistant", text: trimText(input.seedText) || "Topic", at },
    {
      role: "user",
      text: `${copy.title}. ${copy.body} Depth ${classification.coverageDepth}.`,
      at,
    },
  ];
}
