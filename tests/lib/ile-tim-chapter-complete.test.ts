/**
 * ILE chapter-complete TIM → map expansion (shipped helpers + wiring).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  alreadyHasTimExpansionFrom,
  applyChapterCompleteTimExpansionToPlan,
  appetiteExpansionHint,
  buildChapterCompleteExpansionSuggestion,
  buildChapterCompleteExpansionSuggestions,
  CHAPTER_MAP_EXPAND_INTERVENTION,
  createIleMapInterruptionScheduler,
  displayChapterMapIcon,
  ileTimDelayProgressFraction,
  beginIleMarkDoneProgress,
  mergeIleMapDelayWithTim,
  remainingIleMapDelayMs,
  ILE_MARK_DONE_AWAITING_ID,
  EXPAND_CHAPTER_MAP_ACTION,
  ILE_CHAPTER_COMPLETE_DEFAULT_EXPANSIONS,
  ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS,
  ILE_CHAPTER_COMPLETE_TIM_DELAY_MS,
  ILE_CHAPTER_DONE_TOOL_ACTION,
  ILE_CHAPTER_DONE_TOOL_NAME,
  ILE_CHAPTER_SOURCE_TIM,
  ILE_TIM_MAP_INTERACTIONS,
  chapterSuggestionsFromInterruption,
  countTimExpansionsFrom,
  ilePowInterruptionOriginFromTool,
  isChapterMapExpandInterruption,
  isIleChapterDonePow,
  isTimUnopenedChapter,
  predictChapterCompleteMapExpansion,
  predictIleChapterCompleteInterruption,
  revealTimChapterIcon,
  revealTimChapterIconOnPlan,
  resolveChapterCompleteExpansionAnchor,
} from "@/lib/ile-tim-chapter-complete";
import { resolvePowInterruptionContext } from "@/lib/pow-interruption-resolver";
import {
  predictInterruption,
  withProofOfWorkApiResponse,
} from "@/lib/pow-api/predictive-interruption";
import { buildTimFeatureEnvelope } from "@/lib/pow-api/tim-feature-envelope";
import { setTimProviderForTests, predictWithTimProvider } from "@/lib/pow-api/tim-provider";
import { TIM_INTERVENTION_TYPE_CATALOG } from "@/lib/pow-api/predictive-interruption-types";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import { buildIleChapterDonePowToolData } from "@/lib/ile-mode";
import { TIM_EXPLORE_MAP_ICON, parseBlockMapIconName } from "@/lib/block-map-glyph";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import type { SessionPlan, SessionPlanStep } from "@/lib/domain/types";
import type { PredictiveInterruption } from "@/lib/pow-api/predictive-interruption-types";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-8ac12025c029/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function plan(steps: SessionPlanStep[]): SessionPlan {
  return {
    id: "plan-1",
    sessionId: "session-1",
    userId: "user-1",
    goal: "Learn graphs",
    strategy: "",
    steps,
    currentStepIndex: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function completedStep(): SessionPlanStep {
  return {
    id: "ch-done",
    description: "Dijkstra shortest path",
    status: "completed",
    type: "task",
    order: 0,
    position_x: 0,
    position_y: 0,
    map_keyword: "Shortest Path",
    map_icon: "g27",
  };
}

function expansionInterruption(overrides?: Partial<PredictiveInterruption>): PredictiveInterruption {
  return {
    interruption_id: "int_chapter_done_test",
    delay_ms: ILE_CHAPTER_COMPLETE_TIM_DELAY_MS,
    confidence: "high",
    predicted_at: "2026-08-31T12:00:00.000Z",
    intervention: {
      type: CHAPTER_MAP_EXPAND_INTERVENTION,
      message: "Explore causal chains next to Dijkstra shortest path",
      consumer_action: EXPAND_CHAPTER_MAP_ACTION,
      chapter_suggestion: {
        topic: "causal chains",
        title: "Explore causal chains",
        description: "Explore causal chains next to Dijkstra shortest path",
        source_step_id: "ch-done",
      },
    },
    ...overrides,
  };
}

describe("chapter-complete PoW is a TIM event (shipped)", () => {
  it("detects session_plan/chapter_done and resolves upload_ile_chapter_done", () => {
    expect(isIleChapterDonePow("session_plan", "chapter_done")).toBe(true);
    expect(isIleChapterDonePow("session_plan", "chapter_add")).toBe(false);
    expect(ilePowInterruptionOriginFromTool("session_plan", "chapter_done")).toBe("chapter_done");

    const ctx = resolvePowInterruptionContext({
      workspaceId: "ws-1",
      toolName: ILE_CHAPTER_DONE_TOOL_NAME,
      toolAction: ILE_CHAPTER_DONE_TOOL_ACTION,
      proofOfWorkCount: 4,
      artifact_summary: "session_plan:chapter_done",
      artifact_metadata: {
        event: "chapter_done",
        stepId: "ch-done",
        stepDescription: "Dijkstra shortest path",
      },
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.endpoint).toBe("upload_ile_chapter_done");
    expect(ctx?.tap_action).toBe("chapter_done");
    expect(ctx?.artifact_metadata?.stepId).toBe("ch-done");

    const payload = buildIleChapterDonePowToolData({
      stepIndex: 0,
      stepId: "ch-done",
      stepDescription: "Dijkstra shortest path",
      sessionMode: "learning",
    });
    expect(payload.event).toBe("chapter_done");
    expect(payload.tool_action).toBe("chapter_done");
    expect(payload.stepId).toBe("ch-done");

    writeScratch(
      "ile-chapter-done-pow.txt",
      `endpoint=${ctx?.endpoint} event=${payload.event} origin=${ilePowInterruptionOriginFromTool("session_plan", "chapter_done")}`,
    );
  });
});

describe("predictChapterCompleteMapExpansion (shipped TIM)", () => {
  it("always expands after chapter complete and biases the topic from appetite.want_more", async () => {
    const model = emptyLearningWorldModel("ws-1");
    model.evidence_appetite = {
      want_more: ["causal_reasoning", "tool_crud_events"],
      saturated: ["idle_heartbeat"],
    };
    const features = buildTimFeatureEnvelope({
      endpoint: "upload_ile_chapter_done",
      workspace_id: "ws-1",
      proof_of_work_artifacts: 6,
      tool_name: "session_plan",
      tap_action: "chapter_done",
      artifact_summary: "session_plan:chapter_done",
      artifact_metadata: {
        event: "chapter_done",
        stepId: "ch-done",
        stepDescription: "Dijkstra shortest path",
      },
      learning_world_model: model,
    });
    expect(features.learning_world_model?.evidence_appetite?.want_more).toContain("causal_reasoning");
    expect(appetiteExpansionHint(model.evidence_appetite)).toBe("causal reasoning");

    const interruption = predictChapterCompleteMapExpansion(features);
    expect(interruption.intervention.type).toBe("chapter_map_expand");
    expect(interruption.intervention.consumer_action).toBe("expand_chapter_map");
    expect(interruption.delay_ms).toBe(ILE_CHAPTER_COMPLETE_TIM_DELAY_MS);
    expect(interruption.delay_ms).toBeGreaterThanOrEqual(2_000);
    expect(interruption.intervention.chapter_suggestion?.source_step_id).toBe("ch-done");
    expect(interruption.intervention.message.toLowerCase()).toMatch(/causal/);
    expect(isChapterMapExpandInterruption(interruption)).toBe(true);
    const suggested = chapterSuggestionsFromInterruption(interruption);
    expect(suggested.length).toBeGreaterThanOrEqual(ILE_CHAPTER_COMPLETE_DEFAULT_EXPANSIONS);
    expect(suggested.length).toBeLessThanOrEqual(ILE_CHAPTER_COMPLETE_MAX_EXPANSIONS);
    expect(suggested.map((item) => item.description.toLowerCase()).join(" ")).toMatch(/causal/);

    const withoutLlm = await predictIleChapterCompleteInterruption(features);
    expect(withoutLlm?.intervention.type).toBe("chapter_map_expand");
    expect(withoutLlm?.intervention.chapter_suggestion?.source_step_id).toBe("ch-done");

    const emptyAppetite = buildChapterCompleteExpansionSuggestion({
      completedDescription: "Dijkstra shortest path",
      completedStepId: "ch-done",
    });
    expect(emptyAppetite.description).toMatch(/Dijkstra/i);
    expect(emptyAppetite.source_step_id).toBe("ch-done");
    expect(
      buildChapterCompleteExpansionSuggestions({
        completedDescription: "Dijkstra shortest path",
        completedStepId: "ch-done",
      }),
    ).toHaveLength(ILE_CHAPTER_COMPLETE_DEFAULT_EXPANSIONS);

    writeScratch(
      "ile-chapter-complete-tim.txt",
      [
        `type=${interruption.intervention.type}`,
        `action=${interruption.intervention.consumer_action}`,
        `delay=${interruption.delay_ms}`,
        `message=${interruption.intervention.message}`,
        `source=${interruption.intervention.chapter_suggestion?.source_step_id}`,
      ].join("\n"),
    );
  });

  it("predictInterruption drives the shipped chapter-complete predictor", async () => {
    setTimProviderForTests({
      id: "chapter-complete-shipped",
      async predict(features) {
        if (features.event.endpoint !== "upload_ile_chapter_done") return null;
        return predictChapterCompleteMapExpansion(features);
      },
    });
    try {
      const model = emptyLearningWorldModel("ws-1");
      model.evidence_appetite = { want_more: ["worked_examples"], saturated: [] };
      const wrapped = await withProofOfWorkApiResponse(
        { proof_of_work: { id: "pow-1" } },
        {
          endpoint: "upload_ile_chapter_done",
          workspace_id: "ws-1",
          tool_name: "session_plan",
          tap_action: "chapter_done",
          artifact_metadata: {
            stepId: "ch-done",
            stepDescription: "Dijkstra shortest path",
          },
          learning_world_model: model,
        },
      );
      expect(wrapped.interruption?.intervention.type).toBe("chapter_map_expand");
      expect(wrapped.interruption?.intervention.message.toLowerCase()).toMatch(/worked examples|dijkstra/);

      const direct = await predictInterruption({
        endpoint: "upload_ile_chapter_done",
        workspace_id: "ws-1",
        artifact_metadata: { stepId: "ch-done", stepDescription: "BFS layers" },
      });
      expect(direct?.intervention.type).toBe("chapter_map_expand");
    } finally {
      setTimProviderForTests(null);
    }
  });

  it("default TIM provider still returns chapter_map_expand for ILE chapter complete", async () => {
    setTimProviderForTests(null);
    const features = buildTimFeatureEnvelope({
      endpoint: "upload_ile_chapter_done",
      workspace_id: "ws-1",
      tool_name: "session_plan",
      tap_action: "chapter_done",
      artifact_metadata: {
        stepId: "ch-done",
        stepDescription: "Dijkstra shortest path",
      },
    });
    const interruption = await predictWithTimProvider(features);
    expect(interruption?.intervention.type).toBe("chapter_map_expand");
    expect(interruption?.intervention.consumer_action).toBe("expand_chapter_map");
    expect(interruption?.intervention.chapter_suggestion?.source_step_id).toBe("ch-done");
  });
});

describe("applyChapterCompleteTimExpansionToPlan + TIM explore icon (shipped)", () => {
  it("places an adjacent TIM-sourced chapter and reveals the blocky icon on open", () => {
    const current = plan([completedStep()]);
    const interruption = expansionInterruption();
    const applied = applyChapterCompleteTimExpansionToPlan({
      plan: current,
      interruption,
      newStepId: "ch-tim",
      sessionMode: "learning",
    });
    expect(applied).not.toBeNull();
    expect(applied!.added).toHaveLength(1);
    const added = applied!.added[0];
    expect(added.source).toBe(ILE_CHAPTER_SOURCE_TIM);
    expect(added.source_step_id).toBe("ch-done");
    expect(added.tim_unopened).toBe(true);
    expect(added.map_icon).toBe(TIM_EXPLORE_MAP_ICON);
    expect(added.position_x).toBe(1);
    expect(added.position_y).toBe(0);
    expect(isTimUnopenedChapter(added)).toBe(true);
    expect(displayChapterMapIcon(added)).toBe(TIM_EXPLORE_MAP_ICON);
    expect(parseBlockMapIconName(added.map_icon)).toBe(TIM_EXPLORE_MAP_ICON);

    const nodes = sessionStepsToSkillGridNodes(applied!.plan.steps);
    const timNode = nodes.find((node) => node.id === "ch-tim");
    expect(timNode?.map_icon).toBe(TIM_EXPLORE_MAP_ICON);

    const duplicate = applyChapterCompleteTimExpansionToPlan({
      plan: applied!.plan,
      interruption,
      newStepId: "ch-tim-2",
    });
    expect(duplicate).toBeNull();
    expect(alreadyHasTimExpansionFrom(applied!.plan, "ch-done")).toBe(true);

    const revealed = revealTimChapterIcon(added);
    expect(revealed.tim_unopened).toBe(false);
    expect(revealed.map_icon).toMatch(/^g\d+$/);
    expect(isTimUnopenedChapter(revealed)).toBe(false);
    expect(displayChapterMapIcon(revealed)).toMatch(/^g\d+$/);

    const onPlan = revealTimChapterIconOnPlan(applied!.plan, "ch-tim");
    expect(onPlan.changed).toBe(true);
    expect(onPlan.plan.steps.find((step) => step.id === "ch-tim")?.map_icon).toMatch(/^g\d+$/);
    const again = revealTimChapterIconOnPlan(onPlan.plan, "ch-tim");
    expect(again.changed).toBe(false);

    const anchor = resolveChapterCompleteExpansionAnchor(applied!.plan, interruption);
    expect(anchor?.id).toBe("ch-done");

    writeScratch(
      "ile-tim-map-expansion.txt",
      [
        `added=${added.id}@${added.position_x},${added.position_y}`,
        `icon=${added.map_icon}`,
        `revealed=${revealed.map_icon}`,
        `nodes=${timNode?.map_icon}`,
      ].join("\n"),
    );
  });

  it("places multiple distinct adjacent TIM chapters from one interruption", () => {
    const current = plan([completedStep()]);
    const interruption = expansionInterruption({
      intervention: {
        type: CHAPTER_MAP_EXPAND_INTERVENTION,
        message: "Fan out",
        consumer_action: EXPAND_CHAPTER_MAP_ACTION,
        chapter_suggestion: {
          topic: "causal chains",
          title: "Explore causal chains",
          description: "Explore causal chains next to Dijkstra shortest path",
          source_step_id: "ch-done",
        },
        chapter_suggestions: [
          {
            topic: "causal chains",
            title: "Explore causal chains",
            description: "Explore causal chains next to Dijkstra shortest path",
            source_step_id: "ch-done",
          },
          {
            topic: "worked examples",
            title: "Explore worked examples",
            description: "Explore worked examples next to Dijkstra shortest path",
            source_step_id: "ch-done",
          },
          {
            topic: "contrast",
            title: "Contrast shortest path",
            description: "Contrast Dijkstra shortest path with a nearby idea",
            source_step_id: "ch-done",
          },
        ],
      },
    });
    const applied = applyChapterCompleteTimExpansionToPlan({
      plan: current,
      interruption,
      newStepIds: ["ch-tim-a", "ch-tim-b", "ch-tim-c"],
    });
    expect(applied).not.toBeNull();
    expect(applied!.added).toHaveLength(3);
    const cells = applied!.added.map((step) => `${step.position_x},${step.position_y}`);
    expect(new Set(cells).size).toBe(3);
    expect(applied!.added.every((step) => step.map_icon === TIM_EXPLORE_MAP_ICON)).toBe(true);
    expect(applied!.added.every((step) => step.source === ILE_CHAPTER_SOURCE_TIM)).toBe(true);
    expect(countTimExpansionsFrom(applied!.plan, "ch-done")).toBe(3);

    const again = applyChapterCompleteTimExpansionToPlan({
      plan: applied!.plan,
      interruption,
      newStepIds: ["ch-tim-d"],
    });
    expect(again).toBeNull();

    const threeAppetite = emptyLearningWorldModel("ws-1");
    threeAppetite.evidence_appetite = {
      want_more: ["causal_reasoning", "worked_examples", "oral_walkthrough"],
      saturated: [],
    };
    const predicted = predictChapterCompleteMapExpansion(
      buildTimFeatureEnvelope({
        endpoint: "upload_ile_chapter_done",
        workspace_id: "ws-1",
        artifact_metadata: {
          stepId: "ch-done",
          stepDescription: "Dijkstra shortest path",
        },
        learning_world_model: threeAppetite,
      }),
    );
    expect(chapterSuggestionsFromInterruption(predicted)).toHaveLength(3);

    writeScratch(
      "ile-tim-multi-expand.txt",
      [
        `cells=${cells.join(" | ")}`,
        `count=${countTimExpansionsFrom(applied!.plan, "ch-done")}`,
        `predicted=${chapterSuggestionsFromInterruption(predicted).map((item) => item.title).join(" · ")}`,
      ].join("\n"),
    );
  });
});

describe("ILE map interruption scheduler (shipped)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires chapter_map_expand after delay and ignores idle null supersession", () => {
    const onExpand = vi.fn();
    const scheduler = createIleMapInterruptionScheduler(onExpand);
    const interruption = expansionInterruption({ delay_ms: 8_000 });

    scheduler.apply(interruption);
    scheduler.apply(null);
    const started = ileTimDelayProgressFraction(scheduler.getPending(), Date.now());
    expect(started).toBeGreaterThan(0);
    expect(started).toBeLessThanOrEqual(1);
    vi.advanceTimersByTime(4_000);
    const mid = ileTimDelayProgressFraction(scheduler.getPending(), Date.now());
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(1);
    vi.advanceTimersByTime(3_999);
    expect(onExpand).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand.mock.calls[0][0].interruption_id).toBe(interruption.interruption_id);
    expect(ileTimDelayProgressFraction(scheduler.getPending(), Date.now())).toBe(0);

    const second = expansionInterruption({
      interruption_id: "int_newer",
      delay_ms: 3_000,
    });
    scheduler.apply(interruption);
    scheduler.apply(second);
    vi.advanceTimersByTime(8_000);
    expect(onExpand).toHaveBeenCalledTimes(2);
    expect(onExpand.mock.calls[1][0].interruption_id).toBe("int_newer");
  });

  it("Mark as Done begins a visible bar immediately; TIM apply keeps the click-time start", () => {
    vi.setSystemTime(1_000);
    const onExpand = vi.fn();
    const scheduler = createIleMapInterruptionScheduler(onExpand);

    expect(beginIleMarkDoneProgress("")).toBeNull();
    const optimistic = beginIleMarkDoneProgress("ch-done", 1_000);
    expect(optimistic?.interruptionId).toBe(ILE_MARK_DONE_AWAITING_ID);
    expect(optimistic?.stepId).toBe("ch-done");
    expect(ileTimDelayProgressFraction(optimistic, 1_000)).toBeGreaterThan(0);
    expect(ileTimDelayProgressFraction(optimistic, 1_000)).toBeLessThanOrEqual(1);

    scheduler.begin("ch-done");
    const started = ileTimDelayProgressFraction(scheduler.getPending(), Date.now());
    expect(started).toBeGreaterThan(0);
    expect(scheduler.getPending()?.interruptionId).toBe(ILE_MARK_DONE_AWAITING_ID);

    vi.advanceTimersByTime(2_000);
    const mid = ileTimDelayProgressFraction(scheduler.getPending(), Date.now());
    expect(mid).toBeGreaterThan(started);

    const interruption = expansionInterruption({ delay_ms: 8_000 });
    const merged = mergeIleMapDelayWithTim(scheduler.getPending(), interruption, Date.now());
    expect(merged.pending.startedAt).toBe(scheduler.getPending()?.startedAt);
    expect(merged.remainingMs).toBe(remainingIleMapDelayMs(merged.pending, Date.now()));
    expect(merged.remainingMs).toBeLessThan(8_000);

    scheduler.apply(interruption);
    const afterApply = ileTimDelayProgressFraction(scheduler.getPending(), Date.now());
    expect(afterApply).toBeGreaterThan(0);
    expect(afterApply).toBeGreaterThanOrEqual(mid);
    expect(onExpand).not.toHaveBeenCalled();
    vi.advanceTimersByTime(merged.remainingMs);
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(ileTimDelayProgressFraction(scheduler.getPending(), Date.now())).toBe(0);
  });
});

describe("ILE TIM map interactions catalog + wiring", () => {
  it("ships chapter-complete expansion and lists idle negative effects as planned", () => {
    const shipped = ILE_TIM_MAP_INTERACTIONS.filter((item) => item.status === "shipped");
    expect(shipped.map((item) => item.id)).toEqual(["chapter_complete_expand"]);
    expect(ILE_TIM_MAP_INTERACTIONS.some((item) => item.id === "idle_fog_creep" && item.effect === "negative")).toBe(
      true,
    );
    expect(ILE_TIM_MAP_INTERACTIONS.some((item) => item.id === "idle_wilt_unopened")).toBe(true);
    expect(ILE_TIM_MAP_INTERACTIONS.length).toBeGreaterThanOrEqual(6);
    expect(ILE_TIM_MAP_INTERACTIONS.length).toBeLessThanOrEqual(8);
    expect(TIM_INTERVENTION_TYPE_CATALOG).toEqual([
      "reflection_prompt",
      "checkpoint_probe",
      "coaching_nudge",
      "proof_of_work_reminder",
      "performance_review",
      "chapter_map_expand",
    ]);

    const docs = read("docs/ile-tim-map-interactions.md");
    expect(docs).toContain("chapter_complete_expand");
    expect(docs).toContain("idle_fog_creep");

    const idle = read("components/session-view/use-session-idle.ts");
    expect(idle).toContain("createIleMapInterruptionScheduler");
    expect(idle).toContain("isChapterMapExpandInterruption");
    expect(idle).toContain("mapSchedulerRef.current.apply(interruption)");
    expect(idle).toContain("onChapterMapExpand");

    const mutate = read("components/session-view/use-session-mutate.ts");
    expect(mutate).toContain("handleTimChapterMapExpansion");
    expect(mutate).toContain("applyChapterCompleteTimExpansionToPlan");
    expect(mutate).toContain("newStepIds");
    expect(mutate).toContain('via: "tim_chapter_complete"');
    expect(mutate).toContain("revealTimChapterIconOnPlan");

    const view = read("components/SessionView.tsx");
    expect(view).toContain("onChapterMapExpand: handleTimChapterMapExpansion");

    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).toContain("ilePowInterruptionOriginFromTool");

    const provider = read("lib/pow-api/tim-provider.ts");
    expect(provider).toContain('features.event.endpoint === "upload_ile_chapter_done"');
    expect(provider).toContain("predictIleChapterCompleteInterruption");

    const route = read("app/api/workspace/proof-of-work/route.ts");
    expect(route).toContain("loadLearningWorldModel");
    expect(route).toContain("isIleChapterDonePow");

    const glyph = read("components/block-skill-grid/map-block-glyph-icon.tsx");
    expect(glyph).toContain("data-tim-explore-icon");
    expect(glyph).toContain("TIM_EXPLORE_MAP_ICON");
    expect(glyph).toMatch(/>\s*\?\s*</);
    expect(glyph).not.toContain("lucide-react");
    expect(idle).toContain("mapDelay");
    expect(idle).toContain("beginMapDelay");
    expect(idle).toContain("mapSchedulerRef.current.begin");
    expect(view).toContain("ileTimDelayProgressFraction");
    expect(view).toContain("timBlockActionProgress");
    expect(view).toContain("beginMapDelay(stepId)");
    const markDoneIdx = view.indexOf("onMarkChapterCompleted={(stepId) => {");
    const flushIdx = view.indexOf("await flushRemainingIlePow()", markDoneIdx);
    const beginIdx = view.indexOf("beginMapDelay(stepId)", markDoneIdx);
    expect(markDoneIdx).toBeGreaterThan(-1);
    expect(beginIdx).toBeGreaterThan(markDoneIdx);
    expect(flushIdx).toBeGreaterThan(beginIdx);
    expect(mutate).toContain("handleMarkChapterUndone");
    expect(mutate).toContain("applyIleChapterUndoDone");

    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).toContain("data-tim-unopened");
    expect(world).toContain("MAP_CELL_TIM_UNOPENED_CLASS");

    writeScratch(
      "ile-tim-wiring.txt",
      [
        `catalog=${ILE_TIM_MAP_INTERACTIONS.length}`,
        "idle=map scheduler not helios",
        "mutate=applyChapterCompleteTimExpansionToPlan",
        "icon=tim-explore until open",
      ].join("\n"),
    );
  });
});
