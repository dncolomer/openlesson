import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CalibrateSoundingSurface } from "@/components/calibrate/calibrate-sounding-surface";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import {
  SessionSoundingResult,
  SoundingFinishedStage,
} from "@/components/session-view/session-sounding-result";
import {
  SOUNDING_INSTRUCTION,
  SOUNDING_PASS_HINT,
  SOUNDING_POLICY_MIN_CONFIDENCE,
  SOUNDING_PROOF_PROMPT,
  SOUNDING_TRUSTED_PROOF_PROMPT,
  SOUNDING_SCREEN_SIZE,
  absorbSoundingStills,
  buildSoundingProof,
  classifySounding,
  commitSoundingTaps,
  createSoundingState,
  createSoundingTree,
  finishSounding,
  parseSoundingGapReply,
  soundingLocalCandidates,
  soundingProgress,
  soundingResultPresentation,
  soundingRuleForTapCount,
  soundingStillCardText,
  soundingStillsFromBranchModel,
  soundingStillsFromQuestions,
  soundingVoiceSubmissionFromReply,
  submitSoundingProof,
  type SoundingStill,
} from "@/lib/calibrate-sounding";
import {
  SESSION_BRANCH_ACTION_ORDER,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import type { SessionMarkButtonId } from "@/lib/session-marks";
import {
  PREPARE_VOICE_CHALLENGE_SCRIPT,
  PREPARE_VOICE_CHALLENGE_SENTENCE_ONE,
  PREPARE_VOICE_CHALLENGE_SENTENCE_TWO,
  judgeVoiceChallengeReading,
} from "@/lib/practice-voice-challenge";

const ROOT = join(__dirname, "../..");

function still(
  id: string,
  depth: number,
  parentId: string | null,
  territory: string,
): SoundingStill {
  return {
    id,
    text: `Question ${id}`,
    observation: `Observation ${id} names a hidden cause.`,
    parentId,
    depth,
    territory,
  };
}

function pricedActions(cheap: SessionMarkButtonId = "hold") {
  return SESSION_BRANCH_ACTION_ORDER.map((id) => ({
    id,
    price: id === cheap ? 10 : id === "insight" ? 90 : 40,
    leads: `${id} leads`,
    observation: `${id} observation`,
  }));
}

function fixtureModel(stills: SoundingStill[] = fixtureTree()): SessionBranchModel {
  return {
    chapterTitle: "SQL",
    rootId: "root",
    focusId: stills[0]?.id ?? "root",
    step: 0,
    catalogSize: 4,
    boardNotes: [],
    branches: [
      {
        id: "root",
        parentId: null,
        title: "SQL",
        question: "What would you not trust yourself to answer about SQL?",
        territory: "SQL",
        observation: "The topic is open.",
        depth: 0,
        status: "open",
        actions: pricedActions("try"),
      },
      ...stills.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        title: row.text,
        question: `Would you trust yourself to answer ${row.id}?`,
        territory: row.territory,
        observation: row.observation,
        depth: row.depth,
        status: (row.depth === 1 ? "open" : "latent") as "open" | "latent",
        actions: pricedActions("hold"),
      })),
    ],
  };
}

/** Three territories, three grains. */
function fixtureTree(): SoundingStill[] {
  const stills: SoundingStill[] = [];
  for (const region of ["r1", "r2", "r3", "r4"]) {
    stills.push(still(region, 1, "root", region));
    for (const avenue of ["a1", "a2", "a3"]) {
      const avenueId = `${region}-${avenue}`;
      stills.push(still(avenueId, 2, region, region));
      for (const inquiry of ["q1", "q2", "q3"]) {
        stills.push(still(`${avenueId}-${inquiry}`, 3, avenueId, region));
      }
    }
  }
  return stills;
}

function tapAll(state: ReturnType<typeof createSoundingState>) {
  const ids = state.current?.stills.map((row) => row.id) ?? [];
  return commitSoundingTaps(state, ids);
}

function tapNone(state: ReturnType<typeof createSoundingState>) {
  return commitSoundingTaps(state, []);
}

function tapOne(state: ReturnType<typeof createSoundingState>, index = 0) {
  const id = state.current?.stills[index]?.id;
  return commitSoundingTaps(state, id ? [id] : []);
}

function tapGapUntilClosed(seed: string) {
  let state = createSoundingState(fixtureTree(), seed, fixtureModel());
  const pin = state.current!.stills[0]!;
  state = commitSoundingTaps(state, [pin.id]);
  while (state.phase === "sounding") {
    const match = state.current?.stills.find((row) => row.territory === pin.territory);
    state = match ? commitSoundingTaps(state, [match.id]) : tapOne(state, 0);
  }
  return state;
}

describe("sounding fork rule", () => {
  it("maps tap counts onto zoom, hole, stay, and stop", () => {
    expect(soundingRuleForTapCount(0)).toBe("zoom-finer");
    expect(soundingRuleForTapCount(1)).toBe("rabbit-hole");
    expect(soundingRuleForTapCount(2)).toBe("stay-grain");
    expect(soundingRuleForTapCount(3)).toBe("stop-deeper");
    expect(soundingRuleForTapCount(4)).toBe("stop-deeper");
  });

  it("zooms finer on zero taps and stops deeper on three", () => {
    const opened = createSoundingState(fixtureTree(), "fork");
    expect(opened.current?.stills).toHaveLength(SOUNDING_SCREEN_SIZE);
    const grain1 = opened.current!.grain;
    const finer = tapNone(opened);
    expect(finer.current?.grain).toBeGreaterThan(grain1);
    const lost = tapAll(opened);
    expect(lost.taps[0]?.rule).toBe("stop-deeper");
    expect(lost.round === 2 || lost.phase !== "sounding").toBe(true);
  });

  it("rabbit-holes into the tapped child", () => {
    const opened = createSoundingState(fixtureTree(), "hole");
    const pin = opened.current!.stills[0]!;
    const next = tapOne(opened, 0);
    expect(next.taps[0]?.rule).toBe("rabbit-hole");
    expect(next.current).not.toBeNull();
    expect(next.current!.stills.every((row) => row.parentId === pin.id || row.depth > pin.depth)).toBe(
      true,
    );
  });
});

describe("sounding spectrum", () => {
  it("classifies a shallow unlocalized path as lost", () => {
    let state = createSoundingState(fixtureTree(), "lost");
    state = tapAll(state);
    if (state.phase === "sounding") state = tapAll(state);
    if (state.phase === "sounding") state = finishSounding(state, false);
    const closed = state.phase === "complete" ? state : finishSounding(state, false);
    expect(closed.classification?.band).toBe("lost");
  });

  it("keeps a persistent one-tap corridor as localized, not coverage", () => {
    let state = createSoundingState(fixtureTree(), "pin");
    const pin = state.current!.stills[0]!;
    state = commitSoundingTaps(state, [pin.id]);
    while (state.phase === "sounding" && state.round === 1) {
      const match = state.current?.stills.find((row) => row.territory === pin.territory);
      state = match ? commitSoundingTaps(state, [match.id]) : tapOne(state, 0);
    }
    while (state.phase === "sounding") {
      const match = state.current?.stills.find((row) => row.territory === pin.territory);
      state = match ? commitSoundingTaps(state, [match.id]) : tapOne(state, 0);
    }
    const closed = state.phase === "complete" ? state : finishSounding(state, false);
    expect(closed.classification?.band).toBe("localized");
    expect(closed.classification?.band).not.toBe("coverage");
  });

  it("marks hopping one-taps as unranked", () => {
    let state = createSoundingState(fixtureTree(), "noise");
    const first = state.current!.stills[0]!;
    state = commitSoundingTaps(state, [first.id]);
    while (state.phase === "sounding" && state.round === 1) {
      state = tapOne(state, 0);
    }
    while (state.phase === "sounding") {
      const other = state.current?.stills.find((row) => row.territory !== first.territory);
      state = other ? commitSoundingTaps(state, [other.id]) : tapOne(state, 1);
    }
    const closed = state.phase === "complete" ? state : finishSounding(state, false);
    expect(closed.classification?.band).toBe("unranked");
  });

  it("phrases short field titles as questions without putting the observation on the card", () => {
    const generated = soundingStillCardText({
      question: "When does a left join duplicate rows?",
      title: "Left join",
      territory: "This region covers how joins multiply rows.",
    });
    expect(generated).toBe("When does a left join duplicate rows?");
    expect(generated).not.toMatch(/What would you need to settle about/i);
    expect(generated).not.toMatch(/in This region/i);
    expect(
      soundingStillCardText({
        title: "Left join",
        territory: "This region covers how joins multiply rows.",
      }),
    ).toBe("Left join");
    expect(
      soundingStillCardText({
        title: "Left join?",
        territory: "This region covers how joins multiply rows.",
      }),
    ).toBe("Left join?");
    expect(soundingStillCardText({ title: "What happens to unmatched right rows in a left join?", territory: "SQL" })).toBe(
      "What happens to unmatched right rows in a left join?",
    );
    const fromField = soundingStillsFromBranchModel(fixtureModel());
    expect(fromField.length).toBeGreaterThan(0);
    expect(fromField.every((row) => row.text.includes("?"))).toBe(true);
    expect(fromField.every((row) => !/What would you need to settle about/i.test(row.text))).toBe(true);
    expect(fromField.every((row) => !row.text.includes(row.observation) || row.observation.includes("?"))).toBe(
      true,
    );
  });

  it("treats a zero trunk as coverage and still asks a trusted question", () => {
    let state = createSoundingState(fixtureTree(), "expert", fixtureModel());
    while (state.phase === "sounding") state = tapNone(state);
    expect(state.phase).toBe("expert-proof");
    expect(state.classification?.band).toBe("coverage");
    expect(state.proof?.kind).toBe("trusted");
    expect(state.proof?.stillText).toBeTruthy();
    expect(state.taps.every((tap) => tap.tappedIds.length === 0)).toBe(true);
    expect(state.taps.some((tap) => tap.tappedIds.includes(state.proof!.stillId))).toBe(false);
    expect(soundingProgress(state).hint).toBe(SOUNDING_TRUSTED_PROOF_PROMPT);
  });

  it("asks a marked gap how they would forage, then projects onto local branches", () => {
    const state = tapGapUntilClosed("gap");
    expect(state.phase).toBe("expert-proof");
    expect(state.classification?.band).toBe("localized");
    expect(state.proof).not.toBeNull();
    expect(state.proof!.kind).toBe("gap");
    expect(state.proof!.candidates.length).toBeGreaterThanOrEqual(2);
    expect(state.taps.some((tap) => tap.tappedIds.includes(state.proof!.stillId))).toBe(true);
    const local = soundingLocalCandidates(fixtureModel(), state.proof!.stillId);
    expect(local.length).toBeGreaterThanOrEqual(2);
    expect(local.map((row) => row.id)).toEqual(state.proof!.candidates.map((row) => row.id));
    expect(local[0]?.id.startsWith(`${state.proof!.stillId}-`) || local[0]?.id !== state.proof!.stillId).toBe(
      true,
    );
  });

  it("demotes a failed gap projection as false coverage", () => {
    const state = tapGapUntilClosed("fake");
    const miss = submitSoundingProof(state, {
      transcript: "I would google the definition.",
      candidateId: "none",
      confidence: 0.9,
    });
    expect(miss.phase).toBe("complete");
    expect(miss.classification?.falseCoverage).toBe(true);
    const told = submitSoundingProof(state, { skip: true });
    expect(told.classification?.falseCoverage).toBe(true);
    const weak = submitSoundingProof(state, {
      transcript: "Look at the child of this hole.",
      candidateId: state.proof!.candidates[0]!.id,
      confidence: SOUNDING_POLICY_MIN_CONFIDENCE - 0.2,
    });
    expect(weak.classification?.falseCoverage).toBe(true);
    const hit = submitSoundingProof(state, {
      transcript: "I would open the child that names the hidden cause.",
      candidateId: state.proof!.candidates[0]!.id,
      confidence: 0.82,
    });
    expect(hit.classification?.falseCoverage).toBe(false);
    expect(hit.proofInferredAction).toBe(state.proof!.candidates[0]!.id);
  });

  it("reads a gap projection reply into a spoken submission", () => {
    const allowed = ["r1-a1", "r1-a2"];
    const skip = soundingVoiceSubmissionFromReply({ transcript: "  ", reply: null, allowedIds: allowed });
    expect(skip.skip).toBe(true);
    const unread = soundingVoiceSubmissionFromReply({
      transcript: "Open the unmatched rows.",
      reply: null,
      allowedIds: allowed,
    });
    expect(unread.candidateId).toBeNull();
    const hit = soundingVoiceSubmissionFromReply({
      transcript: "Open the unmatched rows.",
      reply: JSON.stringify({ candidateId: "r1-a1", confidence: 0.8 }),
      allowedIds: allowed,
    });
    expect(hit.candidateId).toBe("r1-a1");
    expect(hit.confidence).toBeCloseTo(0.8);
    expect(parseSoundingGapReply(JSON.stringify({ candidateId: "none", confidence: 0.7 }), allowed)).toEqual({
      candidateId: "none",
      confidence: 0.7,
    });
    expect(parseSoundingGapReply(JSON.stringify({ candidateId: "nope", confidence: 0.9 }), allowed)).toBeNull();
    expect(parseSoundingGapReply(JSON.stringify({ candidateId: "r1-a1", confidence: 80 }), allowed)?.confidence).toBeCloseTo(
      0.8,
    );
  });

  it("cannot build a gap check without a field or a marked still", () => {
    let state = createSoundingState(fixtureTree(), "no-field");
    while (state.phase === "sounding") state = tapNone(state);
    expect(buildSoundingProof(state)).toBeNull();
    expect(state.phase).toBe("complete");
    expect(state.classification?.band).not.toBe("coverage");
  });

  it("does not let a three-tap opening look like coverage", () => {
    let state = createSoundingState(fixtureTree(), "trick");
    state = tapAll(state);
    while (state.phase === "sounding") state = tapNone(state);
    const closed = state.phase === "complete" ? state : finishSounding(state, false);
    expect(closed.classification?.band).not.toBe("coverage");
  });
});

describe("sounding tree freeze", () => {
  it("prefers the branch model and falls back to a question tree that cannot prove coverage", () => {
    const questions = soundingStillsFromQuestions([
      { id: "a", text: "What is a left join?" },
      { id: "b", text: "What is an inner join?" },
      { id: "c", text: "What is a cross join?" },
      { id: "d", text: "Why did rows duplicate?" },
      { id: "e", text: "What does NULL do in a key?" },
    ]);
    expect(questions.length).toBeGreaterThanOrEqual(SOUNDING_SCREEN_SIZE);
    let state = createSoundingState(questions, "flat");
    while (state.phase === "sounding") state = tapNone(state);
    const closed = state.phase === "expert-proof" ? finishSounding(state, false) : state;
    expect(buildSoundingProof(createSoundingState(questions, "flat"))).toBeNull();
    expect(closed.classification?.band).not.toBe("coverage");
  });

  it("builds a tree from a branch model with hidden depths", () => {
    const tree = createSoundingTree({
      model: {
        chapterTitle: "Limits",
        rootId: "root",
        focusId: "root",
        step: 0,
        catalogSize: 4,
        boardNotes: [],
        branches: [
          {
            id: "root",
            parentId: null,
            title: "Limits",
            question: "What still has to be true of a limit for the value to exist?",
            territory: "Limits",
            observation: "Limits",
            depth: 0,
            status: "open",
            actions: [],
          },
          {
            id: "r1",
            parentId: "root",
            title: "Algebraic 0/0",
            question: "After factoring, which factor is still allowed to be zero?",
            territory: "r1",
            observation: "Factor before naming the form.",
            depth: 1,
            status: "open",
            actions: [],
          },
          {
            id: "r2",
            parentId: "root",
            title: "sin x / x",
            question: "Why does sin x / x approach 1 as x approaches 0?",
            territory: "r2",
            observation: "The standard trig limit is 1.",
            depth: 1,
            status: "open",
            actions: [],
          },
          {
            id: "r3",
            parentId: "root",
            title: "Continuity vs derivative",
            question: "Can a function be continuous at a point and still fail to have a derivative there?",
            territory: "r3",
            observation: "Matching values do not give a derivative.",
            depth: 1,
            status: "open",
            actions: [],
          },
        ],
      },
    });
    expect(tree.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
    expect(tree.map((row) => row.text)).toEqual([
      "After factoring, which factor is still allowed to be zero?",
      "Why does sin x / x approach 1 as x approaches 0?",
      "Can a function be continuous at a point and still fail to have a derivative there?",
    ]);
    expect(tree.every((row) => row.observation !== row.text)).toBe(true);
  });

  it("keeps sounding after one tap on a thin opening field plus a short question pool", () => {
    const questions = [
      { id: "a", text: "What is a left join?" },
      { id: "b", text: "What is an inner join?" },
      { id: "c", text: "What is a cross join?" },
      { id: "d", text: "Why did rows duplicate?" },
      { id: "e", text: "What does NULL do in a key?" },
    ];
    const tree = createSoundingTree({
      model: {
        chapterTitle: "SQL",
        rootId: "root",
        focusId: "root",
        step: 0,
        catalogSize: 4,
        boardNotes: [],
        branches: [
          {
            id: "root",
            parentId: null,
            title: "SQL",
            question: "What would you not trust yourself to answer about SQL yet?",
            territory: "SQL",
            observation: "SQL",
            depth: 0,
            status: "open",
            actions: [],
          },
          {
            id: "r1",
            parentId: "root",
            title: "Joins",
            question: "When do joins multiply rows instead of matching them one-to-one?",
            territory: "r1",
            observation: "Joins multiply rows when keys repeat.",
            depth: 1,
            status: "open",
            actions: [],
          },
        ],
      },
      questions,
    });
    expect(tree.length).toBeGreaterThan(SOUNDING_SCREEN_SIZE);
    let state = createSoundingState(tree, "thin");
    expect(state.phase).toBe("sounding");
    expect(state.current?.stills).toHaveLength(SOUNDING_SCREEN_SIZE);
    const pin = state.current!.stills[0]!;
    state = commitSoundingTaps(state, [pin.id]);
    expect(state.phase).toBe("sounding");
    expect(state.current).not.toBeNull();
    expect(state.current!.stills.some((row) => row.id === pin.id)).toBe(false);

    const grown = absorbSoundingStills(state, [
      still("r1-a1", 2, "r1", "r1"),
      still("r1-a2", 2, "r1", "r1"),
      still("r1-a3", 2, "r1", "r1"),
    ]);
    expect(grown.stills.some((row) => row.id === "r1-a1")).toBe(true);
    expect(grown.current?.stills.map((row) => row.id)).toEqual(state.current?.stills.map((row) => row.id));
  });
});

describe("sounding copy", () => {
  it("names an unranked path as spread-out uncertainty and hides depth zero", () => {
    const opened = createSoundingState(fixtureTree(), "copy");
    const progress = soundingProgress(opened);
    expect(progress.label).toBe("Pass 1 of 2");
    expect(progress.hint).toBe(SOUNDING_INSTRUCTION);
    const unranked = soundingResultPresentation({
      band: "unranked",
      coverageDepth: 0,
      reliability: "low",
      persistentTerritories: [],
      falseCoverage: false,
    });
    expect(unranked?.title).toBe("The uncertain questions were spread out");
    expect(unranked?.depthLabel).toBeNull();
    expect(unranked?.body).toMatch(/more than one part of the topic/i);
    expect(unranked?.body).toMatch(/no single set stood out/i);
    expect(unranked?.body).not.toMatch(/too short or too mixed/i);
    expect(unranked?.body).not.toMatch(/prior/i);
    const deep = soundingResultPresentation({
      band: "coverage",
      coverageDepth: 2,
      reliability: "high",
      persistentTerritories: [],
      falseCoverage: false,
    });
    expect(deep?.title).toBe("The questions stayed precise");
    expect(deep?.body).toMatch(/finer questions/i);
    expect(deep?.body).not.toMatch(/prior/i);
    expect(deep?.depthLabel).toBe("Reached finer questions · 2");
    const result = renderToStaticMarkup(
      createElement(SessionSoundingResult, {
        classification: {
          band: "unranked",
          coverageDepth: 0,
          reliability: "low",
          persistentTerritories: [],
          falseCoverage: false,
        },
      }),
    );
    expect(result).not.toContain("01");
    expect(result).not.toContain("Depth 0");
    expect(result).not.toContain("Insufficient signal");
    const coverage = renderToStaticMarkup(
      createElement(SessionSoundingResult, {
        classification: {
          band: "coverage",
          coverageDepth: 3,
          reliability: "high",
          persistentTerritories: [],
          falseCoverage: false,
        },
      }),
    );
    expect(coverage).toContain("Reached finer questions · 3");
    expect(coverage).toContain("text-center");
    expect(coverage).not.toContain("text-left");
  });

  it("centers the result plate with side inset", () => {
    const html = renderToStaticMarkup(
      createElement(SoundingFinishedStage, null, createElement("div", { "data-result-box": "" }, "Result")),
    );
    expect(html).toContain("data-sounding-finished-stage");
    expect(html).toContain("my-auto");
    expect(html).toContain("px-6");
    expect(html).toContain("sm:px-10");
    expect(html).toContain("flex-col");
    expect(html).not.toContain("justify-center");
  });
});

describe("sounding wiring contract", () => {
  it("keeps the instruction, voice check, and non-canvas proof off the old board", () => {
    const engine = readFileSync(join(ROOT, "lib/calibrate-sounding.ts"), "utf8");
    const surface = readFileSync(join(ROOT, "components/calibrate/calibrate-sounding-surface.tsx"), "utf8");
    const phases = readFileSync(join(ROOT, "components/scout-tap/scout-tap-phases.tsx"), "utf8");
    const client = readFileSync(join(ROOT, "components/scout-tap/ScoutTapClient.tsx"), "utf8");
    const runner = readFileSync(join(ROOT, "components/CalibrationFlowRunner.tsx"), "utf8");
    expect(engine).toContain(SOUNDING_INSTRUCTION);
    expect(engine).toContain("falseCoverage");
    expect(engine).toContain("expert-proof");
    expect(surface).toContain("data-sounding-proof");
    expect(surface).toContain("data-sounding-progress");
    expect(surface).not.toContain("SessionBranchFieldMap");
    expect(surface).not.toContain("SessionStageProgress");
    expect(surface).toContain("usePublishSessionFieldReveal");
    expect(readFileSync(join(ROOT, "components/session-view/session-harness-panel.tsx"), "utf8")).toContain(
      "SessionBranchFieldMap",
    );
    expect(surface).not.toContain('kind="sounding"');
    expect(surface).not.toContain("WorkCanvas");
    expect(surface).not.toContain("zoom-finer");
    expect(phases).toContain("bgImage={bgImage}");
    expect(phases).toContain('variant="prepare"');
    expect(phases).toContain("data-calibrate-voice-challenge");
    expect(phases).toContain("<SessionWorkSurface");
    expect(phases).not.toContain("SoundingFinishedStage");
    expect(runner).toContain("<SessionWorkSurface");
    expect(runner).not.toContain("SoundingFinishedStage");
    expect(client).toContain("SOUNDING_POOL_COUNT");
    expect(client).toContain("absorbSoundingStills");
    expect(client).toContain("soundingTreeIsTravelable");
    expect(client).toContain("inferSoundingVoiceStep");
    expect(runner).toContain("absorbSoundingStills");
    expect(runner).toContain("inferSoundingVoiceStep");
    expect(engine).toContain("soundingVoiceSubmissionFromReply");
    expect(surface).toContain("data-sounding-voice");
    expect(surface).not.toContain("data-sounding-proof-line");
    expect(PREPARE_VOICE_CHALLENGE_SENTENCE_TWO).toContain(
      "tap every question I would not trust myself to answer",
    );
    expect(PREPARE_VOICE_CHALLENGE_SCRIPT).toContain(PREPARE_VOICE_CHALLENGE_SENTENCE_ONE);
    expect(PREPARE_VOICE_CHALLENGE_SCRIPT).not.toMatch(/speak my thinking out loud the whole time/i);
    expect(judgeVoiceChallengeReading({ transcript: PREPARE_VOICE_CHALLENGE_SCRIPT, variant: "prepare" })).toBe(
      "pass",
    );
    const voice = renderToStaticMarkup(
      createElement(PracticeVoiceChallenge, { onPass: () => {}, variant: "prepare" }),
    );
    const voiceText = voice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(voiceText).toContain("tap every question I would not trust myself to answer");
    expect(voiceText).toContain("read these opening lines out loud to start");
    expect(voiceText).not.toMatch(/speak my thinking out loud the whole time/i);
    expect(voice).toContain('data-practice-voice-variant="prepare"');

    const expert = tapGapUntilClosed("expert-ui");
    const cards = renderToStaticMarkup(
      createElement(CalibrateSoundingSurface, {
        sounding: createSoundingState(fixtureTree(), "cards-ui"),
        onCommitTaps: () => {},
        onSubmitProof: () => {},
      }),
    );
    expect(cards).toContain("data-sounding-still");
    expect(cards).toContain("data-sounding-progress");
    expect(cards).toContain("Pass 1 of 2");
    expect(cards).toContain(SOUNDING_INSTRUCTION);
    expect(cards).not.toContain("WorkCanvas");
    const afterOne = tapOne(createSoundingState(fixtureTree(), "cards-ui"));
    const nextCards = renderToStaticMarkup(
      createElement(CalibrateSoundingSurface, {
        sounding: afterOne,
        onCommitTaps: () => {},
        onSubmitProof: () => {},
      }),
    );
    expect(nextCards).toContain(SOUNDING_PASS_HINT);
    const proof = renderToStaticMarkup(
      createElement(CalibrateSoundingSurface, {
        sounding: expert,
        onCommitTaps: () => {},
        onSubmitProof: () => {},
      }),
    );
    expect(expert.phase).toBe("expert-proof");
    expect(proof).toContain("data-sounding-proof");
    expect(proof).toContain("data-sounding-voice");
    expect(proof).toContain("data-sounding-proof-still");
    expect(proof).toContain("data-sounding-cant-tell");
    expect(proof).toContain("I can&#x27;t tell");
    expect(proof).toContain("A gap you marked");
    expect(proof).toContain(SOUNDING_PROOF_PROMPT);
    expect(proof).not.toContain("data-sounding-proof-line");
    let trustedState = createSoundingState(fixtureTree(), "trusted-ui", fixtureModel());
    while (trustedState.phase === "sounding") trustedState = tapNone(trustedState);
    const trusted = renderToStaticMarkup(
      createElement(CalibrateSoundingSurface, {
        sounding: trustedState,
        onCommitTaps: () => {},
        onSubmitProof: () => {},
      }),
    );
    expect(trustedState.proof?.kind).toBe("trusted");
    expect(trusted).toContain("A question you left unmarked");
    expect(trusted).toContain(SOUNDING_TRUSTED_PROOF_PROMPT);
    expect(trusted).not.toContain("A gap you marked");
    for (const candidate of expert.proof?.candidates ?? []) {
      expect(proof).not.toContain(candidate.observation);
    }
    expect(client).toContain("candidates: live.proof.candidates");
    expect(runner).toContain("candidates: live.proof.candidates");
    expect(engine).toContain("soundingLocalCandidates");
    expect(engine).toContain("SOUNDING_GAP_NONE");
  });
});
