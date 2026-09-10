/**
 * Shipped ILE turn-insight helpers: unused-PoW slots, typed XAI verdict,
 * thoughts-pool candidates, persist payload, zero-craft complete.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendIlePowCounterArtifact,
  countIlePowByType,
  emptyIlePowTypeCounts,
  isIleSpokenThoughtArtifact,
} from "@/lib/ile-pow-counters";
import {
  allowIleTypedInsightCreate,
  buildIleInsightCraftPowArtifact,
  buildIleThoughtsPoolCandidateRequest,
  buildIleTurnInsightPersistPayload,
  buildIleTypedInsightEvaluateRequest,
  canCompleteIleTurnInsightCraft,
  freezeIleTurnInsightUnusedPow,
  ileInsightCraftPowFromAcceptedPersist,
  ileTurnInsightSlotCount,
  ileTurnInsightSlotsFromUnusedPow,
  ILE_INSIGHT_CRAFT_META_TYPE,
  ILE_INSIGHT_CRAFT_POW_FILE,
  ILE_INSIGHT_CRAFT_TOOL_ACTION,
  ILE_INSIGHT_CRAFT_TOOL_NAME,
  ILE_TURN_INSIGHT_CREATE_PATH,
  ILE_TURN_INSIGHT_EVALUATE_PATH,
  ILE_TURN_INSIGHT_SLOT_MAX,
  ILE_TURN_INSIGHT_SUGGEST_PATH,
  insightsSessionListUrl,
  parseIleTypedInsightVerdict,
  remainingIleTurnInsightSlots,
  typedInsightRecordFromVerdict,
  unusedIlePowForInsights,
} from "@/lib/ile-turn-insights";
import {
  classifyPowQuality,
  isExcludedFromSnapshotPoW,
  isScoredPoW,
} from "@/lib/pow-api/pow-quality";
import { ILE_END_TURN_LABEL } from "@/lib/ile-pow-spend";
import {
  buildInsightCreateInsert,
  resolveInsightBlockAndChapterIds,
} from "@/lib/insights";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-3f77a3e511a0/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body);
}

const empty = emptyIlePowTypeCounts();

describe("ileTurnInsightSlotCount (unused PoW → 0..3)", () => {
  it("is monotonic, never above 3, and zero when unused PoW is empty", () => {
    expect(ILE_TURN_INSIGHT_SLOT_MAX).toBe(3);
    expect(ileTurnInsightSlotCount(0)).toBe(0);
    expect(ileTurnInsightSlotCount(-2)).toBe(0);
    expect(ileTurnInsightSlotCount(Number.NaN)).toBe(0);
    expect(ileTurnInsightSlotCount(undefined)).toBe(0);

    expect(ileTurnInsightSlotsFromUnusedPow({ available: empty })).toBe(0);
    expect(
      ileTurnInsightSlotsFromUnusedPow({ available: { ...empty, tool: 1 } }),
    ).toBe(1);
    expect(
      ileTurnInsightSlotsFromUnusedPow({ available: { ...empty, tool: 2 } }),
    ).toBe(2);
    expect(
      ileTurnInsightSlotsFromUnusedPow({ available: { ...empty, tool: 3 } }),
    ).toBe(3);
    expect(
      ileTurnInsightSlotsFromUnusedPow({ available: { ...empty, tool: 8 } }),
    ).toBe(3);

    const one = unusedIlePowForInsights({ available: { ...empty, tool: 1 } });
    const two = unusedIlePowForInsights({ available: { ...empty, tool: 2 } });
    const eight = unusedIlePowForInsights({ available: { ...empty, tool: 8 } });
    expect(ileTurnInsightSlotCount(one)).toBeLessThan(ileTurnInsightSlotCount(two));
    expect(ileTurnInsightSlotCount(two)).toBeLessThanOrEqual(
      ileTurnInsightSlotCount(eight),
    );
    expect(ileTurnInsightSlotCount(eight)).toBe(3);

    expect(
      ileTurnInsightSlotsFromUnusedPow({ available: empty, thoughts: 2 }),
    ).toBe(2);
    expect(
      remainingIleTurnInsightSlots({ unusedPow: 3, craftedCount: 1 }),
    ).toBe(2);
    expect(
      remainingIleTurnInsightSlots({ unusedPow: 1, craftedCount: 1 }),
    ).toBe(0);
  });
});

describe("allowIleTypedInsightCreate (shipped verdict)", () => {
  it("refuses a not-correct / not-good-enough verdict and allows an accepted one", () => {
    const refused = parseIleTypedInsightVerdict({
      accepted: false,
      correct: false,
      goodEnough: false,
      reason: "too vague",
    });
    expect(allowIleTypedInsightCreate(refused)).toBe(false);
    expect(typedInsightRecordFromVerdict({ draft: "maybe gravity", verdict: refused })).toBeNull();

    const accepted = parseIleTypedInsightVerdict({
      accepted: true,
      correct: true,
      goodEnough: true,
      title: "Gravity is a field",
      summary: "Mass curves spacetime; objects follow geodesics.",
    });
    expect(allowIleTypedInsightCreate(accepted)).toBe(true);
    const record = typedInsightRecordFromVerdict({
      draft: "gravity is a field not a force at a distance",
      verdict: accepted,
    });
    expect(record?.title).toBe(accepted.title);
    expect(record?.summary).toBe(accepted.summary);

    const goodEnoughOnly = parseIleTypedInsightVerdict({
      accepted: true,
      goodEnough: true,
      title: "Use units",
      summary: "Keep SI units consistent across the derivation.",
    });
    expect(allowIleTypedInsightCreate(goodEnoughOnly)).toBe(true);

    const acceptedWithoutQuality = parseIleTypedInsightVerdict({
      accepted: true,
      title: "Keep the invariant",
      summary: "The interval is the same in every inertial frame.",
    });
    expect(allowIleTypedInsightCreate(acceptedWithoutQuality)).toBe(true);

    expect(allowIleTypedInsightCreate(null)).toBe(false);
    expect(allowIleTypedInsightCreate(undefined)).toBe(false);
    expect(
      allowIleTypedInsightCreate(
        parseIleTypedInsightVerdict({
          accepted: true,
          correct: false,
          goodEnough: false,
        }),
      ),
    ).toBe(false);

    const evaluateBody = buildIleTypedInsightEvaluateRequest({
      text: "  gravity is curvature  ",
      chapterLabel: "Ch 2",
    });
    expect(evaluateBody.text).toBe("gravity is curvature");
    expect(evaluateBody.chapterLabel).toBe("Ch 2");
    expect(ILE_TURN_INSIGHT_EVALUATE_PATH).toBe("/api/insights/evaluate");
  });
});

describe("thoughts-pool candidates + persist (session + optional chapter)", () => {
  it("builds a suggest request from selected traces and persists an accepted candidate with session id", () => {
    const pool = [
      { id: "t1", text: "force is not the same as field" },
      { id: "t2", text: "the metric encodes curvature" },
      { id: "t3", text: "   " },
      { id: "t4", text: "skip me" },
    ];
    const request = buildIleThoughtsPoolCandidateRequest({
      thoughts: pool,
      selectedIds: ["t1", "t2", "missing"],
      modifyingPrompt: "focus on geometry",
    });
    expect(request.thoughts.map((row) => row.id)).toEqual(["t1", "t2"]);
    expect(request.thoughts.every((row) => row.text.trim().length > 0)).toBe(true);
    expect(request.modifyingPrompt).toBe("focus on geometry");
    expect(ILE_TURN_INSIGHT_SUGGEST_PATH).toBe("/api/insights/suggest");

    const emptySelection = buildIleThoughtsPoolCandidateRequest({
      thoughts: pool,
      selectedIds: [],
    });
    expect(emptySelection.thoughts).toEqual([]);

    const candidate = {
      title: "Fields not forces",
      summary: "Treat gravity as geometry rather than action at a distance.",
    };
    const stepId = "step_1_seed";
    const payload = buildIleTurnInsightPersistPayload({
      title: candidate.title,
      summary: candidate.summary,
      sessionId: "sess-9",
      workspaceId: "ws-1",
      chapterId: stepId,
      thoughts: pool.filter((row) => row.id === "t1" || row.id === "t2"),
    });
    expect(payload.sessionId).toBe("sess-9");
    expect(payload.chapterId).toBe(stepId);
    expect(payload.blockId).toBeNull();
    expect(payload.workspaceId).toBe("ws-1");
    expect(payload.evaluated).toBe(true);
    expect(payload.thoughtIds).toEqual(["t1", "t2"]);
    expect(payload.title).toBe(candidate.title);
    expect(ILE_TURN_INSIGHT_CREATE_PATH).toBe("/api/insights/create");
    expect(insightsSessionListUrl("sess-9")).toBe("/api/insights?sessionId=sess-9");

    const createRow = buildInsightCreateInsert({
      userId: "11111111-1111-4111-8111-111111111111",
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId,
      blockId: payload.blockId,
      chapterId: payload.chapterId,
      title: payload.title,
      summary: payload.summary,
      thoughtIds: payload.thoughtIds,
      sourceThoughts: payload.thoughts,
      aestheticImage: "/aesthetics/example.jpeg",
    });
    expect(createRow.block_id).toBeNull();
    expect(createRow.chapter_id).toBe(stepId);
    expect(createRow.session_id).toBeNull();
    expect(createRow.workspace_id).toBeNull();

    const blockUuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const legacyStep = buildIleTurnInsightPersistPayload({
      title: candidate.title,
      summary: candidate.summary,
      sessionId: "sess-9",
      blockId: stepId,
    });
    expect(legacyStep.blockId).toBeNull();
    expect(legacyStep.chapterId).toBe(stepId);
    expect(
      buildInsightCreateInsert({
        userId: "11111111-1111-4111-8111-111111111111",
        blockId: legacyStep.blockId,
        chapterId: legacyStep.chapterId,
        title: legacyStep.title,
        summary: legacyStep.summary,
        aestheticImage: "/aesthetics/example.jpeg",
      }).block_id,
    ).toBeNull();

    const uuidLink = resolveInsightBlockAndChapterIds({ blockId: blockUuid });
    expect(uuidLink.blockId).toBe(blockUuid);
    expect(uuidLink.chapterId).toBe(blockUuid);
    const uuidRow = buildInsightCreateInsert({
      userId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      sessionId: "33333333-3333-4333-8333-333333333333",
      blockId: blockUuid,
      title: candidate.title,
      summary: candidate.summary,
      thoughtIds: payload.thoughtIds,
      sourceThoughts: payload.thoughts,
      aestheticImage: "/aesthetics/example.jpeg",
    });
    expect(uuidRow.block_id).toBe(blockUuid);
    expect(uuidRow.chapter_id).toBe(blockUuid);
    expect(uuidRow.workspace_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(uuidRow.session_id).toBe("33333333-3333-4333-8333-333333333333");

    expect(canCompleteIleTurnInsightCraft({ craftedCount: 0, unusedPow: 5 })).toBe(
      true,
    );
    expect(canCompleteIleTurnInsightCraft({ craftedCount: 2, unusedPow: 3 })).toBe(
      true,
    );
    expect(canCompleteIleTurnInsightCraft({ craftedCount: 4, unusedPow: 8 })).toBe(
      false,
    );
    expect(canCompleteIleTurnInsightCraft({ craftedCount: -1, unusedPow: 3 })).toBe(
      false,
    );
    expect(ILE_END_TURN_LABEL).toBe("End turn");

    const createSrc = readFileSync(
      join(__dirname, "../../app/api/insights/create/route.ts"),
      "utf8",
    );
    expect(createSrc).toContain("buildInsightCreateInsert");
    expect(createSrc).toContain("chapterId");
    const craftSrc = readFileSync(
      join(__dirname, "../../components/session-view/ile-turn-insight-craft.tsx"),
      "utf8",
    );
    expect(craftSrc).toContain("chapterId: linkedChapterId");
    expect(craftSrc).not.toContain("blockId: linkedChapterId");

    writeScratch(
      "ile-turn-insights-helpers.txt",
      [
        `slots0=${ileTurnInsightSlotCount(0)} slots1=${ileTurnInsightSlotCount(1)} slots8=${ileTurnInsightSlotCount(8)}`,
        `refuse=${allowIleTypedInsightCreate(parseIleTypedInsightVerdict({ accepted: false, correct: false, goodEnough: false }))}`,
        `allow=${allowIleTypedInsightCreate(parseIleTypedInsightVerdict({ accepted: true, correct: true, goodEnough: true }))}`,
        `poolIds=${request.thoughts.map((row) => row.id).join(",")}`,
        `persistSession=${payload.sessionId} chapter=${payload.chapterId} block=${payload.blockId}`,
        `createChapter=${createRow.chapter_id} createBlock=${createRow.block_id}`,
        `zeroCraftOk=${canCompleteIleTurnInsightCraft({ craftedCount: 0, unusedPow: 3 })}`,
      ].join("\n"),
    );
  });
});

describe("accepted insight craft emits snapshot-eligible tool PoW", () => {
  it("counts as tool PoW, skips thoughts-only, and does not emit on refuse or zero crafts", () => {
    const leftoverBefore = unusedIlePowForInsights({
      available: { ...empty, tool: 2 },
    });
    expect(ileTurnInsightSlotCount(leftoverBefore)).toBe(2);
    const frozen = freezeIleTurnInsightUnusedPow(leftoverBefore);
    expect(frozen).toBe(leftoverBefore);

    const accepted = parseIleTypedInsightVerdict({
      accepted: true,
      correct: true,
      goodEnough: true,
      title: "Gravity is geometry",
      summary: "Mass curves spacetime.",
    });
    expect(allowIleTypedInsightCreate(accepted)).toBe(true);
    const persist = buildIleTurnInsightPersistPayload({
      title: accepted.title,
      summary: accepted.summary,
      sessionId: "sess-craft",
      workspaceId: "ws-craft",
      chapterId: "step_2_seed",
    });
    const pow = ileInsightCraftPowFromAcceptedPersist({
      persistOk: true,
      insight: {
        id: "insight-aa",
        title: persist.title,
        session_id: persist.sessionId,
        workspace_id: persist.workspaceId,
        block_id: persist.blockId,
        chapter_id: persist.chapterId,
      },
      sessionId: persist.sessionId,
      workspaceId: persist.workspaceId,
      chapterId: persist.chapterId,
    });
    expect(pow).not.toBeNull();
    expect(pow?.type).toBe("tool");
    expect(pow?.tool_name).toBe(ILE_INSIGHT_CRAFT_TOOL_NAME);
    expect(pow?.tool_action).toBe(ILE_INSIGHT_CRAFT_TOOL_ACTION);
    expect(pow?.chapter_id).toBe("step_2_seed");
    expect(pow?.metadata?.type).toBe(ILE_INSIGHT_CRAFT_META_TYPE);
    expect(pow?.metadata?.insight_id).toBe("insight-aa");
    expect(pow?.metadata?.session_id).toBe("sess-craft");
    expect(isIleSpokenThoughtArtifact(pow)).toBe(false);
    expect(isExcludedFromSnapshotPoW(pow?.metadata)).toBe(false);
    expect(isScoredPoW(pow?.metadata)).toBe(true);
    expect(classifyPowQuality(pow?.metadata)).toBe("scored");
    expect(countIlePowByType([pow!]).tool).toBe(1);

    const before = [{ type: "tool" as const }, { type: "tool" as const }];
    expect(countIlePowByType(before).tool).toBe(2);
    const after = appendIlePowCounterArtifact(before, pow!);
    expect(countIlePowByType(after).tool).toBe(3);
    const liveAfter = unusedIlePowForInsights({
      available: countIlePowByType(after),
    });
    expect(ileTurnInsightSlotCount(liveAfter)).toBe(3);
    expect(ileTurnInsightSlotCount(frozen)).toBe(2);
    expect(
      remainingIleTurnInsightSlots({ unusedPow: frozen, craftedCount: 1 }),
    ).toBe(1);
    expect(
      remainingIleTurnInsightSlots({ unusedPow: liveAfter, craftedCount: 1 }),
    ).toBe(2);
    expect(
      remainingIleTurnInsightSlots({ unusedPow: frozen, craftedCount: 2 }),
    ).toBe(0);
    expect(ileTurnInsightSlotCount(frozen)).toBeLessThanOrEqual(
      ILE_TURN_INSIGHT_SLOT_MAX,
    );

    const refused = parseIleTypedInsightVerdict({
      accepted: false,
      correct: false,
      goodEnough: false,
      reason: "too vague",
    });
    expect(allowIleTypedInsightCreate(refused)).toBe(false);
    expect(
      ileInsightCraftPowFromAcceptedPersist({
        persistOk: false,
        insight: null,
        sessionId: "sess-craft",
      }),
    ).toBeNull();
    expect(
      buildIleInsightCraftPowArtifact({ insightId: "", sessionId: "sess-craft" }),
    ).toBeNull();
    expect(
      canCompleteIleTurnInsightCraft({ craftedCount: 0, unusedPow: frozen }),
    ).toBe(true);
    expect(
      ileInsightCraftPowFromAcceptedPersist({
        persistOk: true,
        insight: { id: "" },
        sessionId: "sess-craft",
      }),
    ).toBeNull();

    const craftSrc = readFileSync(
      join(__dirname, "../../components/session-view/ile-turn-insight-craft.tsx"),
      "utf8",
    );
    const viewSrc = readFileSync(
      join(__dirname, "../../components/SessionView.tsx"),
      "utf8",
    );
    expect(craftSrc).toContain("ileInsightCraftPowFromAcceptedPersist");
    expect(craftSrc).toContain("persistOk: true");
    expect(craftSrc).toContain("recordSessionPowArtifact?.(pow)");
    expect(craftSrc).toContain("uploadIleProofOfWork");
    expect(craftSrc).toContain("ILE_INSIGHT_CRAFT_POW_FILE");
    expect(craftSrc).toContain('file_name: ILE_INSIGHT_CRAFT_POW_FILE');
    expect(craftSrc).toContain("tool_name: ILE_INSIGHT_CRAFT_TOOL_NAME");
    expect(craftSrc).toContain("tool_action: ILE_INSIGHT_CRAFT_TOOL_ACTION");
    const persistSlice = craftSrc.slice(craftSrc.indexOf("const persistInsight"));
    expect(persistSlice.indexOf("ileInsightCraftPowFromAcceptedPersist")).toBeGreaterThan(
      persistSlice.indexOf('if (!insight?.id) throw new Error("Failed to save insight")'),
    );
    expect(viewSrc).toContain("freezeIleTurnInsightUnusedPow");
    expect(viewSrc).toContain("setCraftUnusedPow");
    expect(viewSrc).toContain("unusedPow={craftUnusedPow}");
    expect(viewSrc).not.toContain("unusedPow={unusedPowForInsights}");
    expect(viewSrc).toContain("recordSessionPowArtifact={recordSessionPowArtifact}");
    expect(ILE_INSIGHT_CRAFT_POW_FILE).toBe("ile-insight-crafting.json");

    writeScratch(
      "ile-insight-craft-pow-surface.txt",
      [
        `tool=${pow?.tool_name} action=${pow?.tool_action} type=${pow?.type}`,
        `meta=${String(pow?.metadata?.type)} insight=${String(pow?.metadata?.insight_id)} session=${String(pow?.metadata?.session_id)} chapter=${pow?.chapter_id}`,
        `countTool=${countIlePowByType([pow!]).tool} spoken=${isIleSpokenThoughtArtifact(pow)} excluded=${isExcludedFromSnapshotPoW(pow?.metadata)} quality=${classifyPowQuality(pow?.metadata)}`,
        `slotsFrozen=${ileTurnInsightSlotCount(frozen)} remainingAfterOne=${remainingIleTurnInsightSlots({ unusedPow: frozen, craftedCount: 1 })} liveWouldBe=${ileTurnInsightSlotCount(liveAfter)}`,
        `refusePow=${ileInsightCraftPowFromAcceptedPersist({ persistOk: false, insight: null, sessionId: "sess-craft" })}`,
        `zeroCraftOk=${canCompleteIleTurnInsightCraft({ craftedCount: 0, unusedPow: frozen })}`,
        `file=${ILE_INSIGHT_CRAFT_POW_FILE}`,
        "record=recordSessionPowArtifact?.(pow)",
        "upload=uploadIleProofOfWork",
        "freeze=freezeIleTurnInsightUnusedPow",
      ].join("\n") + "\n",
    );
  });
});
