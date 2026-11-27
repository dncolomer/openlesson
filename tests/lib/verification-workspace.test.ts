/**
 * Verification Workspace (stored kind knowledge_region): question pool,
 * identity, flow-scoped results, region embeddings, synthetic requests,
 * Knowledge filters, and shipped UI gates.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import { encodeFlowEmbedding, encodeFlowRaw, encodeTextsToFlowVector } from "@/lib/flow-embedding-encode";
import { resolveTapStartingTopicsFromLlm } from "@/lib/tap-score";
import { availableWorkspaceSections } from "@/lib/workspace-sections";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import {
  acceptParticipantIdentity,
  applyVerificationCommand,
  buildRegionFromFlowEmbeddings,
  buildRegionFromSyntheticItems,
  buildVoiceRegionFromFlowRaws,
  buildSyntheticAgentPowRequest,
  buildVerificationFlowSkillMarkdown,
  emptyVerificationState,
  filterKnowledgeRowsByVerificationFlow,
  generateSyntheticPowItems,
  generateVerificationPoolFromTopic,
  knowledgeRowsFromFlowResults,
  localVerificationOpening,
  pickVerificationFlowQuestion,
  resultsForFlow,
  verificationFlowPublicPath,
  verificationFlowSkillFilename,
  verificationFlowStartChoices,
  verificationProofEmbedding,
  verificationQuestionStartingPrompt,
  type VerificationFlowResult,
  type VerificationKnowledgeRow,
} from "@/lib/verification-flow";
import {
  knowledgeCoordsForVerificationFlow,
  knowledgeRankingCardsForVerificationFlow,
  knowledgeSubjectsForVerificationFlow,
  lwmLoadedSubjectForVerificationFlow,
} from "@/lib/verification-knowledge-subtab";
import {
  applyTapVerificationOpeningToWorkCanvas,
  emptyTapWorkCanvasScene,
} from "@/lib/tap-work-canvas";
import type { KnowledgeRankingCard } from "@/lib/verification-knowledge-subtab";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function axis(index: number): number[] {
  const vector = new Array(FLOW_EMBEDDING_DIM).fill(0);
  vector[index] = 1;
  return vector;
}

const tapBrief = {
  plan: { id: "plan-1", title: "Algebra", root_topic: "Algebra" },
  nodes: [],
  sessions: [],
};

describe("verification flow question selection", () => {
  it("refuses an empty pool and does not pad to three topics", async () => {
    expect(pickVerificationFlowQuestion([], () => 0)).toEqual({
      ok: false,
      reason: "empty_pool",
    });
    const start = verificationFlowStartChoices([], () => 0.4);
    expect(start.emptyPool).toBe(true);
    expect(start.practice).toBe(false);
    expect(start.question).toBeNull();
    expect(start.topics).toEqual([]);
  });

  it("picks the only question from a pool of one", async () => {
    const pool = [{ id: "only", text: "State the derivative of x^2." }];
    const picked = pickVerificationFlowQuestion(pool, () => 0.9);
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.question).toEqual(pool[0]);
    const start = verificationFlowStartChoices(pool, () => 0);
    expect(start.topics).toHaveLength(1);
    expect(start.practice).toBe(true);
    expect(verificationQuestionStartingPrompt(start.question!)).toBe(pool[0].text);
    expect(start.topics[0]?.openingQuestion).toBe(pool[0].text);
  });

  it("offers every pooled question as a starting topic", async () => {
    const pool = [
      { id: "a", text: "Question A" },
      { id: "b", text: "Question B" },
    ];
    const first = pickVerificationFlowQuestion(pool, () => 0);
    const second = pickVerificationFlowQuestion(pool, () => 0.99);
    expect(first).toEqual({ ok: true, question: pool[0] });
    expect(second).toEqual({ ok: true, question: pool[1] });
    const start = verificationFlowStartChoices(pool, () => 0);
    expect(start.topics).toHaveLength(2);
    expect(start.topics.map((topic) => topic.openingQuestion)).toEqual([
      "Question A",
      "Question B",
    ]);
  });

  it("lists the whole pool on start and never invents a topic", async () => {
    const pool = ["One", "Two", "Three", "Four", "Five"].map((text, index) => ({
      id: `q-${index}`,
      text,
    }));
    const seen = new Set<string>();
    for (let step = 0; step < pool.length; step += 1) {
      const picked = pickVerificationFlowQuestion(pool, () => step / pool.length);
      expect(picked.ok).toBe(true);
      if (!picked.ok) return;
      expect(pool.map((question) => question.text)).toContain(picked.question.text);
      seen.add(picked.question.id);
      const start = verificationFlowStartChoices(pool, () => step / pool.length);
      expect(start.topics).toHaveLength(pool.length);
      expect(start.topics.map((topic) => topic.openingQuestion)).toEqual(
        pool.map((question) => question.text),
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("standard TAP starting topics", () => {
  it("still resolves to exactly three topics", async () => {
    expect(resolveTapStartingTopicsFromLlm(null, tapBrief)).toHaveLength(3);
    expect(
      resolveTapStartingTopicsFromLlm(
        [{ title: "Only one", openingQuestion: "Just this?" }],
        tapBrief,
      ),
    ).toHaveLength(3);
  });
});

describe("verification flow identity and result membership", () => {
  it("accepts a non-empty identity and lets the same person claim again", async () => {
    expect(acceptParticipantIdentity("  ")).toEqual({ ok: false, reason: "empty" });
    expect(acceptParticipantIdentity("  ada ")).toEqual({ ok: true, identity: "ada" });
    expect(acceptParticipantIdentity("ada")).toEqual({ ok: true, identity: "ada" });
    expect(acceptParticipantIdentity("Ada")).toEqual({ ok: true, identity: "Ada" });
    expect(
      acceptParticipantIdentity("lti:https://school.brightspace.com:user-9"),
    ).toEqual({
      ok: true,
      identity: "lti:https://school.brightspace.com:user-9",
    });

    let state = emptyVerificationState();
    const created = applyVerificationCommand(state, {
      type: "create",
      workspaceId: "ws-1",
      topic: "Limits",
      questions: ["What is a limit?"],
      id: "flow-a",
      publicToken: "token-a",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;
    state = created.state;
    const claimed = applyVerificationCommand(state, {
      type: "claim",
      flowId: "flow-a",
      identity: "ada",
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    state = claimed.state;
    const again = applyVerificationCommand(state, {
      type: "claim",
      flowId: "flow-a",
      identity: "ada",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.identity).toBe("ada");
    expect(again.state.identities).toHaveLength(1);

    const first = applyVerificationCommand(again.state, {
      type: "addResult",
      flowId: "flow-a",
      identity: "ada",
      source: "runner",
      prompt: "first run",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyVerificationCommand(first.state, {
      type: "addResult",
      flowId: "flow-a",
      identity: "ada",
      source: "runner",
      prompt: "second run",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const ada = resultsForFlow(second.state.results, "flow-a").filter(
      (item) => item.identity === "ada",
    );
    expect(ada).toHaveLength(2);
    expect(ada.map((item) => item.prompt)).toEqual(["first run", "second run"]);
  });

  it("keeps runner and skill results on their flow", async () => {
    let state = emptyVerificationState();
    for (const flow of [
      { id: "flow-a", token: "token-a", topic: "Limits" },
      { id: "flow-b", token: "token-b", topic: "Series" },
    ]) {
      const created = applyVerificationCommand(state, {
        type: "create",
        workspaceId: "ws-1",
        topic: flow.topic,
        questions: [`Question for ${flow.topic}`],
        id: flow.id,
        publicToken: flow.token,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      state = created.state;
    }
    const runner = applyVerificationCommand(state, {
      type: "addResult",
      flowId: "flow-a",
      identity: "ada",
      source: "runner",
      prompt: "epsilon delta",
      embedding: axis(0),
    });
    expect(runner.ok).toBe(true);
    if (!runner.ok) return;
    state = runner.state;
    const skill = applyVerificationCommand(state, {
      type: "addResult",
      flowId: "flow-a",
      identity: "agent",
      source: "skill",
      prompt: "generated proof",
      embedding: axis(0),
    });
    expect(skill.ok).toBe(true);
    if (!skill.ok) return;
    state = skill.state;
    const other = applyVerificationCommand(state, {
      type: "addResult",
      flowId: "flow-b",
      identity: "bea",
      source: "runner",
      prompt: "power series",
      embedding: axis(1),
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    state = other.state;

    const flowA = resultsForFlow(state.results, "flow-a");
    const flowB = resultsForFlow(state.results, "flow-b");
    expect(flowA.map((item) => item.source).sort()).toEqual(["runner", "skill"]);
    expect(flowA.every((item) => item.flowId === "flow-a")).toBe(true);
    expect(flowB.map((item) => item.prompt)).toEqual(["power series"]);
    expect(flowA.some((item) => item.flowId === "flow-b")).toBe(false);
    expect(verificationFlowPublicPath("token-a")).toBe("/v/token-a");
    const skillMd = buildVerificationFlowSkillMarkdown({
      workspaceId: "ws-1",
      flowId: "flow-a",
      topic: "Limits",
      questions: [{ text: "What is a limit?" }],
      publicToken: "token-a",
    });
    expect(skillMd).toContain("flow-a");
    expect(skillMd).toContain("proof of work");
    expect(skillMd).toContain("/api/verification-flow/public/token-a/results");
    expect(verificationFlowSkillFilename("Limits & continuity")).toBe("limits-continuity-skill.md");
    expect(verificationFlowSkillFilename("   ")).toBe("verification-flow-skill.md");
  });
});

describe("region embeddings from a verification flow and synthetic agents", () => {
  it("builds a region from the selected flow's embeddings only", async () => {
    const items = [
      { id: "a1", flowId: "flow-a", embedding: axis(0) },
      { id: "a2", flowId: "flow-a", embedding: axis(0) },
      { id: "b1", flowId: "flow-b", embedding: axis(1) },
    ];
    const spec = buildRegionFromFlowEmbeddings({
      name: "Limits region",
      flowId: "flow-a",
      items,
    });
    expect(spec.subject_count).toBe(2);
    expect(spec.centroid[0]).toBeGreaterThan(0.99);
    expect(Math.abs(spec.centroid[1] || 0)).toBeLessThan(1e-6);
    expect(spec.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    const voice = await buildVoiceRegionFromFlowRaws({
      name: "Limits region",
      embeddings: [
        await encodeFlowEmbedding({
          flowKind: "verify",
          pow: [{ type: "speech", timestamp_ms: 1, payload: "epsilon delta" }],
        }),
        await encodeFlowEmbedding({
          flowKind: "verify",
          pow: [{ type: "speech", timestamp_ms: 1, payload: "same walk different words" }],
        }),
      ],
    });
    expect(voice?.name).toBe("Limits region · Path + Text");
    expect(voice?.embedding_model_id).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
    expect(voice?.subject_count).toBe(2);
    expect(await buildVoiceRegionFromFlowRaws({ name: "Limits region", embeddings: [] })).toBeNull();
  });

  it("asks xAI for proof of work with the optional modifier and builds from the returned items", async () => {
    const injected = [
      { id: "s1", text: "worked limit", embedding: axis(2) },
      { id: "s2", text: "worked series", embedding: axis(2) },
    ];
    const generated = await generateSyntheticPowItems({
      topic: "Limits",
      promptModifier: "prefer epsilon proofs",
      complete: async (request) => {
        expect(request.asksForProofOfWork).toBe(true);
        expect(request.includesModifier).toBe(true);
        expect(request.instructions.toLowerCase()).toContain("proof of work");
        expect(request.instructions).toContain("prefer epsilon proofs");
        expect(request.user).toContain("prefer epsilon proofs");
        return { items: injected };
      },
    });
    expect(generated.embeddings).toHaveLength(2);
    expect(generated.embeddings[0]).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(generated.embeddings[0]).not.toEqual(generated.embeddings[1]);
    expect(generated.embeddings[0]).not.toEqual(axis(2));
    const spec = buildRegionFromSyntheticItems({
      name: "Synthetic limits",
      items: generated.items,
    });
    expect(spec.embedding_model_id).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
    expect(spec.subject_count).toBe(generated.items.length);
    expect(spec.dim).toBe(FLOW_EMBEDDING_DIM);
    expect(spec.centroid).toHaveLength(FLOW_EMBEDDING_DIM);
    const bogus = await generateSyntheticPowItems({
      topic: "Limits",
      promptModifier: "prefer epsilon proofs",
      complete: async () => ({
        items: [{ text: "epsilon proof", embedding: [0.1, 0.2, 0.3] }],
      }),
    });
    expect(bogus.items[0]?.embedding).toEqual([]);
    expect(bogus.embeddings[0]).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(bogus.embeddings[0]?.slice(0, 3)).not.toEqual([0.1, 0.2, 0.3]);
    const fromText = buildRegionFromSyntheticItems({
      name: "Epsilon",
      items: bogus.items,
    });
    expect(fromText.dim).toBe(FLOW_EMBEDDING_DIM);
    expect(fromText.centroid).toEqual(
      buildRegionFromSyntheticItems({
        name: "Epsilon",
        items: [{ id: "s", text: "epsilon proof", embedding: [] }],
      }).centroid,
    );
    const bare = buildSyntheticAgentPowRequest({ topic: "Limits", promptModifier: "  " });
    expect(bare.includesModifier).toBe(false);
    expect(bare.asksForProofOfWork).toBe(true);
  });

  it("keeps runner and skill on the same path without a walk; path+text follows spoken proof", async () => {
    const runnerA = await verificationProofEmbedding({
      prompt: "epsilon delta limit proof",
      source: "runner",
      workspaceId: "flow-token",
    });
    const runnerB = await verificationProofEmbedding({
      prompt: "photosynthesis calvin cycle",
      source: "runner",
      workspaceId: "flow-token",
    });
    const skill = await verificationProofEmbedding({
      prompt: "epsilon delta limit proof",
      source: "skill",
      workspaceId: "flow-token",
    });
    expect(runnerA).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(runnerA).toEqual(runnerB);
    expect(runnerA).toEqual(skill);
    const runnerAText = await verificationProofEmbedding({
      prompt: "epsilon delta limit proof",
      source: "runner",
      workspaceId: "flow-token",
      channel: "path_text",
    });
    const runnerBText = await verificationProofEmbedding({
      prompt: "photosynthesis calvin cycle",
      source: "runner",
      workspaceId: "flow-token",
      channel: "path_text",
    });
    const skillText = await verificationProofEmbedding({
      prompt: "epsilon delta limit proof",
      source: "skill",
      workspaceId: "flow-token",
      channel: "path_text",
    });
    expect(runnerAText).not.toEqual(runnerBText);
    expect(runnerAText).not.toEqual(skillText);
    expect(
      await verificationProofEmbedding({
        prompt: "epsilon delta limit proof",
        source: "runner",
        workspaceId: "flow-token",
      }),
    ).toEqual(runnerA);
    const route = read("app/api/verification-flow/public/[token]/results/route.ts");
    expect(route).toContain("buildFlowEmbeddingRaw");
    expect(route).toContain("persistCompletedFlowEmbedding");
    expect(route).toContain("prompt");
  });
});

describe("knowledge subtab verification-flow filter", () => {
  it("keeps the selected flow's rows and returns every row when no flow is selected", async () => {
    const results: VerificationFlowResult[] = [
      {
        id: "r1",
        flowId: "flow-a",
        workspaceId: "ws",
        identity: "ada",
        source: "runner",
        questionId: "q",
        prompt: "limit",
        embedding: null,
        createdAt: "t",
      },
      {
        id: "r2",
        flowId: "flow-b",
        workspaceId: "ws",
        identity: "bea",
        source: "skill",
        questionId: null,
        prompt: "series",
        embedding: null,
        createdAt: "t",
      },
    ];
    const rows: VerificationKnowledgeRow[] = knowledgeRowsFromFlowResults(results);
    expect(filterKnowledgeRowsByVerificationFlow(rows, null).map((row) => row.id)).toEqual([
      "r1",
      "r2",
    ]);
    expect(filterKnowledgeRowsByVerificationFlow(rows, "").map((row) => row.id)).toEqual([
      "r1",
      "r2",
    ]);
    expect(filterKnowledgeRowsByVerificationFlow(rows, "flow-a").map((row) => row.id)).toEqual([
      "r1",
    ]);
    expect(filterKnowledgeRowsByVerificationFlow(rows, "flow-b")[0]?.label).toBe("bea");
  });

  it("filters ranking, strengths, LWM subjects, and embedding points to the selected flow", () => {
    const cards: KnowledgeRankingCard[] = [
      {
        rank: 1,
        subjectKey: "u:alice",
        userId: "alice",
        guestUserId: null,
        label: "Alice",
        snapshotScore: 80,
        ghcScore: 70,
        ranAt: "t",
        runId: "run-a",
        hasSnapshot: true,
        report: { marker_scores: [] },
      },
      {
        rank: 2,
        subjectKey: "u:bob",
        userId: "bob",
        guestUserId: null,
        label: "Bob",
        snapshotScore: 40,
        ghcScore: 30,
        ranAt: "t",
        runId: "run-b",
        hasSnapshot: true,
        report: null,
      },
    ];
    const flowRows = knowledgeRowsFromFlowResults([
      {
        id: "r1",
        flowId: "flow-a",
        workspaceId: "ws",
        identity: "ada",
        source: "runner",
        questionId: "q",
        prompt: "epsilon proof",
        embedding: null,
        createdAt: "t",
      },
      {
        id: "r2",
        flowId: "flow-b",
        workspaceId: "ws",
        identity: "bea",
        source: "skill",
        questionId: null,
        prompt: "series proof",
        embedding: null,
        createdAt: "t",
      },
    ]);
    const ranked = knowledgeRankingCardsForVerificationFlow(cards, flowRows, "flow-a");
    expect(ranked.map((card) => card.label)).toEqual(["ada"]);
    expect(ranked.some((card) => card.label === "Alice" || card.label === "Bob")).toBe(false);
    expect(ranked[0]?.proofText).toBe("epsilon proof");
    expect(knowledgeRankingCardsForVerificationFlow(cards, flowRows, null).map((card) => card.label)).toEqual([
      "Alice",
      "Bob",
    ]);
    expect(knowledgeRankingCardsForVerificationFlow(cards, flowRows, "").map((card) => card.subjectKey)).toEqual([
      "u:alice",
      "u:bob",
    ]);

    const subjects = [
      {
        user_id: "alice",
        guest_user_id: null,
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 1,
        confidence: 1,
        label: "Alice",
      },
      {
        user_id: "bob",
        guest_user_id: null,
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 1,
        confidence: 1,
        label: "Bob",
      },
    ];
    const lwm = knowledgeSubjectsForVerificationFlow(subjects, flowRows, "flow-a");
    expect(lwm.map((subject) => subject.label)).toEqual(["ada"]);
    expect(lwm.some((subject) => subject.user_id === "alice" || subject.user_id === "bob")).toBe(false);
    expect(knowledgeSubjectsForVerificationFlow(subjects, flowRows, null).map((subject) => subject.user_id)).toEqual([
      "alice",
      "bob",
    ]);

    const coords = [{ subjectKey: "u:alice", x: 1 }, { subjectKey: "u:bob", x: 2 }];
    const visibleCoords = knowledgeCoordsForVerificationFlow(coords, lwm, "flow-a");
    expect(visibleCoords).toEqual([]);
    expect(knowledgeCoordsForVerificationFlow(coords, subjects, null)).toEqual(coords);
    const matchedSubjects = knowledgeSubjectsForVerificationFlow(
      [{ ...subjects[0], user_id: "ada", label: "ada" }],
      flowRows,
      "flow-a",
    );
    expect(matchedSubjects.map((subject) => subject.user_id)).toEqual(["ada"]);
    expect(
      knowledgeCoordsForVerificationFlow([{ subjectKey: "u:ada" }, { subjectKey: "u:bob" }], matchedSubjects, "flow-a"),
    ).toEqual([{ subjectKey: "u:ada" }]);
  });

  it("emits every selected-flow row when only one row matches a workspace card", async () => {
    const cards: KnowledgeRankingCard[] = [
      {
        rank: 1,
        subjectKey: "u:ada",
        userId: "ada",
        guestUserId: null,
        label: "ada",
        snapshotScore: 90,
        ghcScore: 80,
        ranAt: "t",
        runId: "run-ada",
        hasSnapshot: true,
        report: { marker_scores: [] },
      },
      {
        rank: 2,
        subjectKey: "u:bob",
        userId: "bob",
        guestUserId: null,
        label: "Bob",
        snapshotScore: 40,
        ghcScore: 30,
        ranAt: "t",
        runId: "run-bob",
        hasSnapshot: true,
        report: null,
      },
    ];
    const flowRows = knowledgeRowsFromFlowResults([
      {
        id: "r-ada",
        flowId: "flow-a",
        workspaceId: "ws",
        identity: "ada",
        source: "runner",
        questionId: "q",
        prompt: "epsilon proof",
        embedding: null,
        createdAt: "t",
      },
      {
        id: "r-bea",
        flowId: "flow-a",
        workspaceId: "ws",
        identity: "bea",
        source: "skill",
        questionId: null,
        prompt: "series proof",
        embedding: null,
        createdAt: "t",
      },
    ]);
    const ranked = knowledgeRankingCardsForVerificationFlow(cards, flowRows, "flow-a");
    expect(ranked.map((card) => card.label)).toEqual(["ada", "bea"]);
    expect(ranked.some((card) => card.label === "Bob" || card.userId === "bob")).toBe(false);
    expect(ranked[0]?.hasSnapshot).toBe(true);
    expect(ranked[0]?.snapshotScore).toBe(90);
    expect(ranked[0]?.userId).toBe("ada");
    expect(ranked[0]?.proofText).toBe("epsilon proof");
    expect(ranked[1]?.hasSnapshot).toBe(false);
    expect(ranked[1]?.guestUserId).toBe("r-bea");
    expect(ranked[1]?.proofText).toBe("series proof");
    expect(knowledgeRankingCardsForVerificationFlow(cards, flowRows, null).map((card) => card.label)).toEqual([
      "ada",
      "Bob",
    ]);

    const subjects = [
      {
        user_id: "ada",
        guest_user_id: null,
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 1,
        confidence: 1,
        label: "ada",
      },
      {
        user_id: "bob",
        guest_user_id: null,
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 1,
        confidence: 1,
        label: "Bob",
      },
    ];
    const listed = knowledgeSubjectsForVerificationFlow(subjects, flowRows, "flow-a");
    expect(listed.map((subject) => subject.label)).toEqual(["ada", "bea"]);
    expect(listed[0]?.user_id).toBe("ada");
    expect(listed[0]?.guest_user_id).toBeNull();
    expect(listed[1]?.user_id).toBeNull();
    expect(listed[1]?.guest_user_id).toBe("r-bea");
    expect(listed.some((subject) => subject.user_id === "bob")).toBe(false);
    expect(
      knowledgeCoordsForVerificationFlow(
        [{ subjectKey: "u:ada" }, { subjectKey: "u:bob" }, { subjectKey: "g:r-bea" }],
        listed,
        "flow-a",
      ).map((coord) => coord.subjectKey),
    ).toEqual(["u:ada", "g:r-bea"]);

    const roster = subjects;
    const signedIn = lwmLoadedSubjectForVerificationFlow({
      subjects: listed,
      roster,
      flowId: "flow-a",
      current: { userId: "owner-1", guestUserId: "" },
      currentUserId: "owner-1",
    });
    expect(signedIn).toEqual({ userId: "ada", guestUserId: "" });
    expect(signedIn.userId).not.toBe("owner-1");
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: listed,
        roster,
        flowId: "flow-a",
        current: { userId: "", guestUserId: "r-bea" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "", guestUserId: "r-bea" });
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: [],
        roster,
        flowId: "flow-a",
        current: { userId: "owner-1", guestUserId: "" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "", guestUserId: "" });
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: listed,
        roster,
        flowId: null,
        current: { userId: "ada", guestUserId: "" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "ada", guestUserId: "" });
  });

  it("restores the signed-in profile when a cleared flow was showing a proof-only guest", async () => {
    const flowSubjects = [
      {
        user_id: null,
        guest_user_id: "r-bea",
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 0,
        confidence: 0,
        label: "bea",
      },
    ];
    const roster = [
      {
        user_id: "owner-1",
        guest_user_id: null,
        embedding_model_id: "knowledgecfg-v1-d64",
        as_of_ms: 1,
        confidence: 1,
        label: "Owner",
      },
    ];
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: flowSubjects,
        roster,
        flowId: "flow-a",
        current: { userId: "owner-1", guestUserId: "" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "", guestUserId: "r-bea" });
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: flowSubjects,
        roster,
        flowId: null,
        current: { userId: "", guestUserId: "r-bea" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "owner-1", guestUserId: "" });
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: flowSubjects,
        roster,
        flowId: "",
        current: { userId: "", guestUserId: "r-bea" },
        currentUserId: null,
      }),
    ).toEqual({ userId: "", guestUserId: "" });
    expect(
      lwmLoadedSubjectForVerificationFlow({
        subjects: flowSubjects,
        roster,
        flowId: null,
        current: { userId: "owner-1", guestUserId: "" },
        currentUserId: "owner-1",
      }),
    ).toEqual({ userId: "owner-1", guestUserId: "" });
  });
});

describe("verification workspace shell gates", () => {
  it("exposes Verification Flows only on this workspace kind", async () => {
    expect(isKnowledgeRegionWorkspace("knowledge_region")).toBe(false);
    const owner = availableWorkspaceSections({
      isOwner: true,
      workspaceKind: "knowledge_region",
    });
    expect(owner).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(owner).not.toContain("verification_flows");
    expect(owner).not.toContain("calibration_flows");
    expect(
      availableWorkspaceSections({ isOwner: true, workspaceKind: "calibration" }),
    ).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    const standard = availableWorkspaceSections({ isOwner: true });
    expect(standard).not.toContain("verification_flows");
    expect(standard[0]).toBe("workspace");
  });


  it("refuses to update or remove a flow from another workspace", async () => {
    const first = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      workspaceId: "workspace-a",
      topic: "Limits",
      questions: ["What is a limit?"],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyVerificationCommand(first.state, {
      type: "create",
      workspaceId: "workspace-b",
      topic: "Series",
      questions: ["What is a series?"],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const foreign = second.state.flows.find((flow) => flow.workspaceId === "workspace-b");
    expect(foreign).toBeTruthy();
    const updated = applyVerificationCommand(second.state, {
      type: "update",
      workspaceId: "workspace-a",
      flowId: foreign?.id || "",
      topic: "Hijacked",
    });
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.reason).toBe("wrong_workspace");
    expect(updated.state.flows.find((flow) => flow.id === foreign?.id)?.topic).toBe("Series");
    const removed = applyVerificationCommand(second.state, {
      type: "remove",
      workspaceId: "workspace-a",
      flowId: foreign?.id || "",
    });
    expect(removed.ok).toBe(false);
    if (removed.ok) return;
    expect(removed.reason).toBe("wrong_workspace");
    expect(removed.state.flows.some((flow) => flow.id === foreign?.id)).toBe(true);
    const allowed = applyVerificationCommand(second.state, {
      type: "update",
      workspaceId: "workspace-b",
      flowId: foreign?.id || "",
      topic: "Series revised",
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.flow?.topic).toBe("Series revised");
  });
});
