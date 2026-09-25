/**
 * Scout mode: author flags, Work launch label, pick → connected canvas node,
 * on-demand questions (never answers), thank-you CTA gating, ILE context.
 * Drives shipped helpers — no reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blockAllowsPracticeStyle,
  enabledPracticeLaunchCombos,
  normalizeBlockPracticeOptions,
  practiceOptionsIconKeys,
  resolveDefaultPracticeLaunchUi,
  serializeBlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  PRODUCT_INTENT_LABELS,
  allBlockPracticeLaunchTargets,
  launchPracticeHref,
  productIntentClusterLabel,
  resolveLaunchFromStyleAndModality,
  resolveProductIntent,
  resolveProductIntentFromId,
} from "@/lib/product-intent";
import {
  normalizeTapInteractionKind,
  tapSessionInsertRetryKind,
} from "@/lib/pow-api/tap-link-config";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";
import { assemblePromptWorkspaceContext } from "@/lib/prompt-workspace-context";
import { convertToExcalidrawElements, ileWorkCanvasXaiToolsInstruction } from "@/lib/ile-work-canvas";
import {
  SCOUT_CHILD_GAP_Y,
  SCOUT_FOLLOWUP_QUESTION_COUNT,
  SCOUT_FRAME_PADDING_X,
  SCOUT_FRAME_WIDTH,
  SCOUT_NODE_CUSTOM_DATA_KEY,
  SCOUT_QUESTION_MAX_WORDS,
  SCOUT_SEED_NODE_ID,
  scoutFrameMetrics,
  buildScoutCanvasPowMetadata,
  buildScoutQuestionsSystemMessage,
  buildScoutQuestionsUserPrompt,
  canGoBackScoutNode,
  collectScoutArtifactsFromPowRows,
  connectScoutQuestionToCanvas,
  createScoutLiveState,
  extractScoutCanvasText,
  goBackScoutNode,
  looksLikeScoutQuestion,
  mergeScoutArtifactsIntoPromptInput,
  normalizeScoutQuestions,
  parseScoutArtifactsFromPowMetadata,
  pickScoutQuestion,
  receiveScoutQuestions,
  shortenScoutQuestion,
  scoutLiveSpeechEnabled,
  scoutPathFromRoot,
  scoutSessionPurityEnabled,
  scoutThankYouActions,
  scoutThinkAloudEnabled,
  seedScoutWorkCanvas,
  stripScoutAnswerTail,
} from "@/lib/scout-session";
import { WORKSPACE_CIRCULAR_MENU_ACTIONS } from "@/lib/block-circular-menu";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-68ad206c8604/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function canvasRect(el: { x: number; y: number; width: number; height: number }) {
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const w = Number(el.width) || 0;
  const h = Number(el.height) || 0;
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  if (!(maxX > minX) || !(maxY > minY)) return null;
  return { minX, minY, maxX, maxY };
}

function positiveAreaHit(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0
  );
}

function newMarksOverlapExisting(
  incoming: readonly {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
    containerId?: string | null;
  }[],
  existing: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
  }[],
) {
  const ids = new Set(incoming.map((el) => el.id));
  for (const el of incoming) {
    if (el.isDeleted) continue;
    if (el.type === "text" && el.containerId && ids.has(el.containerId)) continue;
    const rect = canvasRect(el);
    if (!rect) continue;
    for (const other of existing) {
      if (other.isDeleted) continue;
      const obstacle = canvasRect(other);
      if (!obstacle) continue;
      if (positiveAreaHit(rect, obstacle)) return true;
    }
  }
  return false;
}

describe("author Scout enable/disable + at least one of Work/Drill/Scout", () => {
  it("normalizes Scout independently and refuses an empty mode set", () => {
    const def = normalizeBlockPracticeOptions(null);
    expect(def.allowExplore).toBe(true);
    expect(def.allowDrill).toBe(true);
    expect(def.allowScout).toBe(true);

    const scoutOnly = normalizeBlockPracticeOptions({
      allowExplore: false,
      allowDrill: false,
      allowScout: true,
    });
    expect(scoutOnly.allowExplore).toBe(false);
    expect(scoutOnly.allowDrill).toBe(false);
    expect(scoutOnly.allowScout).toBe(true);
    expect(blockAllowsPracticeStyle(scoutOnly, "scout")).toBe(true);
    expect(blockAllowsPracticeStyle(scoutOnly, "explore")).toBe(false);
    expect(enabledPracticeLaunchCombos(scoutOnly)).toEqual(["scout_dialog"]);
    expect(practiceOptionsIconKeys(scoutOnly)).toEqual(["scout"]);
    expect(resolveDefaultPracticeLaunchUi(scoutOnly).style).toBe("scout");

    const allOff = normalizeBlockPracticeOptions({
      allow_explore: false,
      allow_drill: false,
      allow_scout: false,
    });
    expect(allOff.allowExplore).toBe(true);
    expect(allOff.allowDrill).toBe(false);
    expect(allOff.allowScout).toBe(false);

    const wire = serializeBlockPracticeOptions(scoutOnly);
    expect(wire.allow_scout).toBe(true);
    expect(wire.allow_explore).toBe(false);
  });
});

describe("Learn (not Explore/Work) is the ILE block-launch label", () => {
  it("product labels, circular menu, and card use Prepare / Learn / Drill", () => {
    expect(PRODUCT_INTENT_LABELS.styleScout).toBe("Prepare");
    expect(PRODUCT_INTENT_LABELS.styleExplore).toBe("Learn");
    expect(PRODUCT_INTENT_LABELS.exploreDialog).toBe("Learn");
    expect(PRODUCT_INTENT_LABELS.scoutDialog).toBe("Prepare");
    expect(productIntentClusterLabel(resolveProductIntent("explore"))).toBe("Learn");
    expect(productIntentClusterLabel(resolveProductIntent("scout"))).toBe("Prepare");
    expect(WORKSPACE_CIRCULAR_MENU_ACTIONS.map((a) => a.label)).toEqual(
      expect.arrayContaining(["Prepare", "Learn", "Drill"]),
    );
    expect(WORKSPACE_CIRCULAR_MENU_ACTIONS[0]?.id).toBe("start_prepare");

    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("PRODUCT_INTENT_LABELS.styleExplore");
    expect(card).toContain("PRODUCT_INTENT_LABELS.styleScout");
    expect(card).toContain('id: "scout"');
    expect(card).toContain("data-practice-allow-scout");
    const scoutIdx = card.indexOf('id: "scout" as const');
    const learnIdx = card.indexOf('id: "explore" as const');
    const drillIdx = card.indexOf('id: "drill" as const');
    expect(scoutIdx).toBeGreaterThan(0);
    expect(learnIdx).toBeGreaterThan(scoutIdx);
    expect(drillIdx).toBeGreaterThan(learnIdx);

    const menu = read("lib/block-circular-menu.ts");
    expect(menu).toContain('id: "start_session", label: "Learn"');
    expect(menu).not.toMatch(/id: "start_session", label: "Explore"/);
    expect(menu).not.toMatch(/id: "start_session", label: "Work"/);

    const href = launchPracticeHref(resolveProductIntent("explore"), {
      workspaceId: "ws-1",
      blockId: "b-1",
    });
    expect(href).toContain("/session?");
    expect(href).toContain("block=b-1");

    const scoutHref = launchPracticeHref(resolveProductIntent("scout"), {
      workspaceId: "ws-1",
      blockId: "b-1",
    });
    expect(scoutHref).toContain("/workspace/ws-1/scout");
    expect(scoutHref).toContain("blockId=b-1");
    expect(scoutHref).not.toContain("/tap");
  });
});

describe("Scout pick → connected canvas node + 5 questions + go-back", () => {
  it("seeds framed topic, pick connects, go-back regenerates from canvas", () => {
    const seed = seedScoutWorkCanvas("Heaps");
    expect(seed.nodeId).toBe(SCOUT_SEED_NODE_ID);
    expect(seed.scene.elements.some((el) => el.type === "rectangle")).toBe(true);
    expect(extractScoutCanvasText(seed.scene)).toMatch(/Heaps/);

    let state = createScoutLiveState("Heaps");
    const injected = [
      "What heap invariant fails first on a decrease-key?",
      "How does sift-down choose the child to swap?",
      "When does a binary heap beat a Fibonacci heap here?",
      "Which array index is the parent of node 7?",
      "Why store heaps in arrays instead of pointer nodes?",
    ];
    state = receiveScoutQuestions(state, injected);
    expect(state.questions).toHaveLength(SCOUT_FOLLOWUP_QUESTION_COUNT);
    expect(state.questions.every((q) => looksLikeScoutQuestion(q))).toBe(true);

    const afterPick = pickScoutQuestion(state, 0);
    expect(afterPick.nodes).toHaveLength(2);
    expect(afterPick.currentNodeId).not.toBe(SCOUT_SEED_NODE_ID);
    expect(afterPick.questions).toEqual([]);
    expect(canGoBackScoutNode(afterPick)).toBe(true);
    expect(scoutPathFromRoot(afterPick)).toEqual([
      "Heaps",
      "What heap invariant fails first on a decrease-key?",
    ]);

    const connected = connectScoutQuestionToCanvas(seed.scene, {
      question: afterPick.nodes[1]!.text,
      nodeId: afterPick.nodes[1]!.id,
      parentNodeId: SCOUT_SEED_NODE_ID,
    });
    expect(
      connected.scene.elements.some(
        (el) =>
          el.type === "rectangle" &&
          el.customData?.[SCOUT_NODE_CUSTOM_DATA_KEY] === afterPick.nodes[1]!.id,
      ),
    ).toBe(true);
    expect(connected.scene.elements.some((el) => el.type === "arrow")).toBe(true);
    expect(extractScoutCanvasText(connected.scene)).toMatch(/decrease-key/);
    const seedIds = new Set(seed.scene.elements.map((el) => el.id));
    expect(connected.added.length).toBeGreaterThan(0);
    expect(connected.added.every((el) => !seedIds.has(el.id))).toBe(true);
    expect(
      connected.added.some(
        (el) =>
          el.type === "rectangle" &&
          el.customData?.[SCOUT_NODE_CUSTOM_DATA_KEY] === afterPick.nodes[1]!.id,
      ),
    ).toBe(true);
    expect(connected.added.some((el) => el.type === "arrow")).toBe(true);

    const parentRect = seed.scene.elements.find((el) => el.type === "rectangle")!;
    const childRect = connected.scene.elements.find(
      (el) =>
        el.type === "rectangle" &&
        el.customData?.[SCOUT_NODE_CUSTOM_DATA_KEY] === afterPick.nodes[1]!.id,
    )!;
    expect(childRect.y).toBeGreaterThanOrEqual(parentRect.y + parentRect.height);
    expect(childRect.x).toBe(parentRect.x);

    const childText = connected.scene.elements.find(
      (el) =>
        el.type === "text" &&
        el.customData?.[SCOUT_NODE_CUSTOM_DATA_KEY] === afterPick.nodes[1]!.id,
    )!;
    expect(childText.width).toBeLessThanOrEqual(childRect.width);
    expect(childText.height).toBeLessThanOrEqual(childRect.height);
    expect(String(childText.text)).toContain("\n");

    const round2 = [
      "What happens if the parent is already smaller?",
      "How would you test a broken sift-down?",
      "Where does the hole move during decrease-key?",
      "Which neighbor of this node is unexplored?",
      "Why would you scout Fibonacci heaps next?",
    ];
    const withNew = receiveScoutQuestions(afterPick, round2);
    expect(withNew.questions).toHaveLength(SCOUT_FOLLOWUP_QUESTION_COUNT);
    expect(withNew.questions[0]).toMatch(/parent is already smaller/);

    const back = goBackScoutNode(withNew);
    expect(back.currentNodeId).toBe(SCOUT_SEED_NODE_ID);
    expect(back.questions).toEqual([]);
    expect(canGoBackScoutNode(back)).toBe(false);

    const altRound = receiveScoutQuestions(back, [
      "What other pull exists besides decrease-key?",
      "How does build-heap differ from repeated inserts?",
      "When is a d-ary heap the better scout?",
      "Which operation dominates your workload?",
      "Why map this topic before drilling it?",
    ]);
    expect(altRound.questions[0]).not.toBe(withNew.questions[0]);
  });

  it("sizes frames so wrapped question text stays inside the square", () => {
    const long =
      "What heap invariant fails first on a decrease-key when the array is already dense?";
    const metrics = scoutFrameMetrics(long);
    expect(metrics.width).toBe(SCOUT_FRAME_WIDTH);
    expect(metrics.innerWidth).toBe(SCOUT_FRAME_WIDTH - SCOUT_FRAME_PADDING_X * 2);
    expect(metrics.wrappedText.split("\n").length).toBeGreaterThan(1);
    const seeded = seedScoutWorkCanvas(long);
    const rect = seeded.scene.elements.find((el) => el.type === "rectangle")!;
    const text = seeded.scene.elements.find((el) => el.type === "text")!;
    expect(rect.height).toBeGreaterThanOrEqual(metrics.height);
    expect(text.width).toBeLessThanOrEqual(rect.width - SCOUT_FRAME_PADDING_X);
    expect(text.height).toBeLessThanOrEqual(rect.height);
    expect(text.containerId).toBe(rect.id);
    expect(text.autoResize).toBe(false);
  });
});

describe("on-demand questions stay questions", () => {
  it("clips long follow-ups to a short scannable question", () => {
    const clipped = shortenScoutQuestion(
      "What heap invariant fails first on a decrease-key when the array is already dense?",
    );
    expect(looksLikeScoutQuestion(clipped)).toBe(true);
    expect(clipped.split(/\s+/).length).toBeLessThanOrEqual(SCOUT_QUESTION_MAX_WORDS + 1);
    expect(clipped.endsWith("?")).toBe(true);
  });

  it("normalize rejects/strips answers and keeps five questions", () => {
    const mixed = normalizeScoutQuestions(
      {
        questions: [
          "What is the first invariant to check?",
          "A binary heap is a complete tree stored in an array.",
          "How does sift-up restore the heap? It swaps with the parent until the order holds.",
          "Because the array is 1-indexed you just divide by two.",
          "Which child is larger after a swap?",
          "Where does the last leaf move on extract-min?",
          "Do decrease-key and insert share a walk?",
        ],
      },
      5,
    );
    expect(mixed).toHaveLength(5);
    expect(mixed.every((q) => looksLikeScoutQuestion(q))).toBe(true);
    expect(mixed.some((q) => /complete tree stored in an array/i.test(q))).toBe(false);
    expect(mixed.some((q) => /just divide by two/i.test(q))).toBe(false);
    expect(stripScoutAnswerTail("How does sift-up restore the heap? It swaps.")).toBe(
      "How does sift-up restore the heap?",
    );
    expect(looksLikeScoutQuestion("A binary heap is a complete tree.")).toBe(false);
  });
});

describe("thank-you CTA gating by allowed modes", () => {
  it("Restart and workspace always; Work/Drill only when allowed", () => {
    const both = scoutThankYouActions({
      practiceOptions: normalizeBlockPracticeOptions({
        allowExplore: true,
        allowDrill: true,
        allowScout: true,
      }),
    });
    expect(both).toEqual({ restart: true, workspace: true, work: true, drill: true });

    const scoutOnly = scoutThankYouActions({
      practiceOptions: normalizeBlockPracticeOptions({
        allowExplore: false,
        allowDrill: false,
        allowScout: true,
      }),
    });
    expect(scoutOnly.restart).toBe(true);
    expect(scoutOnly.workspace).toBe(true);
    expect(scoutOnly.work).toBe(false);
    expect(scoutOnly.drill).toBe(false);

    const workOnly = scoutThankYouActions({ allowExplore: true, allowDrill: false });
    expect(workOnly.work).toBe(true);
    expect(workOnly.drill).toBe(false);
  });
});

describe("Scout canvas/path in later Work/ILE context", () => {
  it("assembly includes scout artifacts when present", () => {
    const artifacts = {
      path: ["Heaps", "What heap invariant fails first on a decrease-key?"],
      canvasText: "Heaps\nWhat heap invariant fails first on a decrease-key?",
      seedText: "Heaps",
    };
    const merged = mergeScoutArtifactsIntoPromptInput(
      { workspaceTitle: "Algorithms", blockTitle: "Heaps" },
      artifacts,
    );
    const ctx = assemblePromptWorkspaceContext(merged);
    expect(ctx.contextBlock).toMatch(/Scout mind map/);
    expect(ctx.contextBlock).toMatch(/decrease-key/);
    expect(ctx.contextBlock).toMatch(/Heaps/);

    const meta = buildScoutCanvasPowMetadata(artifacts);
    expect(meta.scout_session).toBe(true);
    const parsed = parseScoutArtifactsFromPowMetadata(meta);
    expect(parsed?.path).toEqual(artifacts.path);
    const collected = collectScoutArtifactsFromPowRows([{ metadata: meta }]);
    expect(collected?.seedText).toBe("Heaps");

    const without = assemblePromptWorkspaceContext({
      workspaceTitle: "Algorithms",
      blockTitle: "Heaps",
    });
    expect(without.contextBlock).not.toMatch(/Scout mind map/);
  });
});

describe("prompt builder asks for 3 short questions with canvas/path", () => {
  it("system + user prompts name short questions, count 3, and include canvas/path", () => {
    expect(SCOUT_FOLLOWUP_QUESTION_COUNT).toBe(3);
    const system = buildScoutQuestionsSystemMessage();
    expect(system).toMatch(/question/i);
    expect(system).toMatch(/never an answer/i);
    expect(system).toMatch(/exactly 3/);
    expect(system).toMatch(/3–8 words/);

    const user = buildScoutQuestionsUserPrompt({
      seedTitle: "Heaps",
      seedDescription: "Array-backed binary heaps",
      path: ["Heaps", "What heap invariant fails first on a decrease-key?"],
      canvasText: "Heaps [framed]\nWhat heap invariant fails first on a decrease-key?",
      currentNode: "What heap invariant fails first on a decrease-key?",
    });
    expect(user).toMatch(/exactly 3/);
    expect(user).toMatch(/3–8 words/);
    expect(user).toMatch(/Questions only/);
    expect(user).toMatch(/decrease-key/);
    expect(user).toMatch(/Work canvas/);
    expect(user).toMatch(/Path from seed/);
  });
});

describe("structural: Scout TAP shell, no think-aloud, Build toggle", () => {
  it("live split, frozen thank-you, no speech/purity, briefing names mind-map goal", () => {
    expect(scoutThinkAloudEnabled()).toBe(false);
    expect(scoutSessionPurityEnabled()).toBe(false);
    expect(scoutLiveSpeechEnabled("live")).toBe(false);
    expect(normalizeTapInteractionKind("scout")).toBe("scout");
    expect(tapSessionInsertRetryKind("scout", "violates check constraint")).toBe(
      "conversational",
    );
    expect(tapSessionInsertRetryKind("exercise", "violates check constraint")).toBeNull();
    expect(resolveTapShellFromSession({ interaction_kind: "scout" })).toBe("scout");
    expect(allBlockPracticeLaunchTargets().map((t) => t.id)).toEqual([
      "scout_dialog",
      "explore_dialog",
      "drill_dialog",
    ]);
    expect(resolveProductIntentFromId("scout_dialog").interaction_kind).toBe("scout");

    const phases = read("components/scout-tap/scout-tap-phases.tsx");
    const client = read("components/scout-tap/ScoutTapClient.tsx");
    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    const en = read("messages/en.json");
    const tapPage = read("app/workspace/[id]/tap/page.tsx");
    const scoutPage = read("app/workspace/[id]/scout/page.tsx");
    const start = read("app/api/workspace-tap-score/start/route.ts");
    const questionsApi = read("app/api/workspace-tap-score/scout-questions/route.ts");
    const sessionView = read("components/SessionView.tsx");
    const mutate = read("components/session-view/use-session-mutate.ts");
    const onboarding = read("components/SessionOnboardingGuide.tsx");

    expect(phases).toContain("data-scout-live-split");
    expect(phases).toContain('data-scout-split="70-30"');
    expect(phases).toContain("lg:grid-cols-[7fr_3fr]");
    expect(phases).toContain("LoadingStatusMessage");
    expect(phases).toContain("data-scout-questions-loading");
    expect(phases).toMatch(/data-scout-go-back[\s\S]{0,180}disabled=\{readOnly\}/);
    expect(phases).not.toContain("disabled={questionsLoading || readOnly}");
    expect(client).toContain("questionsAbortRef");
    expect(phases).toContain("data-scout-work-canvas-pane");
    expect(phases).toContain("data-scout-questions-pane");
    expect(phases).toContain("data-scout-go-back");
    expect(phases).toContain("data-scout-thank-you");
    expect(phases).toContain("data-scout-canvas-readonly");
    expect(phases).toContain("viewModeEnabled={readOnly}");
    expect(phases).toContain("applyElements={canvasApplyElements}");
    expect(phases).toContain("applyElementsNonce={canvasApplyNonce}");
    expect(phases).toContain('variant="scout"');
    expect(phases).not.toContain("useSessionThoughtInterface");
    expect(phases).not.toContain("tap-session-purity");
    expect(phases).not.toContain("retryMicrophone");

    expect(client).toContain('interaction_kind: "scout"');
    const learner = read("components/workspace-view/use-workspace-learner.ts");
    expect(learner).toContain("/workspace/${workspaceId}/scout?");
    expect(learner).toContain("/workspace/${workspaceId}/tap?");
    expect(client).not.toContain("useSessionThoughtInterface");
    expect(client).not.toContain("tap-session-purity");
    expect(client).not.toContain("useTapSpeechProofOfWork");
    expect(client).toContain("buildScoutCanvasPowMetadata");
    expect(client).toContain("setCanvasApplyElements(connected.added)");
    expect(client).toContain("setCanvasApplyNonce((n) => n + 1)");
    expect(client).toContain("canvasApplyNonce={canvasApplyNonce}");

    expect(edit).toContain("data-block-edit-allow-scout");
    expect(edit).toContain(">Prepare<");
    expect(edit).toContain(">Learn<");
    const prepareIdx = edit.indexOf(">Prepare<");
    const learnIdx = edit.indexOf(">Learn<");
    const drillIdx = edit.indexOf(">Drill<");
    expect(prepareIdx).toBeGreaterThan(0);
    expect(learnIdx).toBeGreaterThan(prepareIdx);
    expect(drillIdx).toBeGreaterThan(learnIdx);

    expect(en).toMatch(/Scout the topic/);
    expect(en).toMatch(/mind map/);
    expect(en).toMatch(/where curiosity and pull are strongest/);
    expect(en).toMatch(/Jump into Learn/);

    expect(tapPage).not.toContain("ScoutTapClient");
    expect(scoutPage).toContain("ScoutTapClient");
    expect(scoutPage).toContain("blockId={blockId || block}");
    expect(start).toContain('interactionKind === "scout"');
    expect(start).toContain("tapSessionInsertRetryKind");
    expect(questionsApi).toContain("buildScoutQuestionsUserPrompt");
    expect(questionsApi).toContain("normalizeScoutQuestions");

    expect(sessionView).toContain("scoutArtifacts: ilePromptMaterials?.scoutArtifacts");
    expect(mutate).toContain("collectScoutArtifactsFromPowRows");
    expect(onboarding).toContain('"scout"');

    const structural = [
      "think_aloud=false",
      "purity=false",
      "live_split=true",
      "apply_elements_nonce=true",
      "readonly_thank_you=true",
      "build_toggle=true",
      "briefing_mind_map=true",
      "ile_context=true",
    ].join("\n");
    writeScratch("scout-mode-structural.log", structural);
  });
});

describe("evidence logs", () => {
  it("writes gating test samples", () => {
    const system = buildScoutQuestionsSystemMessage();
    const user = buildScoutQuestionsUserPrompt({
      seedTitle: "Heaps",
      path: ["Heaps"],
      canvasText: "Heaps",
    });
    writeScratch(
      "scout-mode-tests.log",
      [
        "allow_scout=" +
          String(normalizeBlockPracticeOptions(null).allowScout),
        "work_label=" + PRODUCT_INTENT_LABELS.styleExplore,
        "questions=" +
          normalizeScoutQuestions(["What next?", "Why this?"]).join(" | "),
        "thank_you=" +
          JSON.stringify(scoutThankYouActions({ allowExplore: true, allowDrill: false })),
        "system_has_questions=" + String(/question/i.test(system)),
        "user_count_3=" + String(user.includes("exactly 3")),
        "user_has_canvas=" + String(user.includes("Work canvas")),
      ].join("\n"),
    );
    expect(system).toMatch(/question/i);
  });
});

describe("Prepare canvas drops miss live marks and the question prompt lists them", () => {
  it("moves a child off a non-sibling occupying the naive slot and names live geometry plus drawing tools", () => {
    const seed = seedScoutWorkCanvas("Heaps");
    const parent = seed.scene.elements.find((el) => el.type === "rectangle" && !el.isDeleted)!;
    const naive = {
      x: parent.x,
      y: parent.y + parent.height + SCOUT_CHILD_GAP_Y,
      width: parent.width,
      height: parent.height,
    };
    const blocker = convertToExcalidrawElements([
      { type: "rectangle", x: naive.x, y: naive.y, width: naive.width, height: naive.height },
    ])[0]!;
    expect(positiveAreaHit(canvasRect(naive)!, canvasRect(blocker)!)).toBe(true);
    const scene = {
      ...seed.scene,
      elements: [...seed.scene.elements, blocker],
      appState: { collaborators: { "cursor-agent-77": { pointer: { x: 1234, y: 5678 } } } },
    };
    const connected = connectScoutQuestionToCanvas(scene, {
      question: "Where does this break?",
      parentNodeId: SCOUT_SEED_NODE_ID,
    });
    const child = connected.added.find((el) => el.type === "rectangle")!;
    expect(child.x !== naive.x || child.y !== naive.y).toBe(true);
    const keptParent = connected.scene.elements.find((el) => el.id === parent.id)!;
    const keptBlocker = connected.scene.elements.find((el) => el.id === blocker.id)!;
    expect(keptParent.x).toBe(parent.x);
    expect(keptParent.y).toBe(parent.y);
    expect(keptParent.width).toBe(parent.width);
    expect(keptParent.height).toBe(parent.height);
    expect(keptBlocker.x).toBe(blocker.x);
    expect(keptBlocker.y).toBe(blocker.y);
    expect(keptBlocker.width).toBe(blocker.width);
    expect(keptBlocker.height).toBe(blocker.height);
    expect(newMarksOverlapExisting(connected.added, [parent, blocker])).toBe(false);

    const deleted = {
      ...blocker,
      id: "gone-scout",
      isDeleted: true,
      type: "text",
      text: "PREPARE_DELETED_MARK",
      originalText: "PREPARE_DELETED_MARK",
      x: 7,
      y: 9,
      width: 11,
      height: 13,
    };
    const prompt = buildScoutQuestionsUserPrompt({
      seedTitle: "Heaps",
      path: ["Heaps"],
      canvasText: "Heaps",
      scene: {
        elements: [blocker, deleted],
        appState: { collaborators: { "cursor-agent-77": { pointer: { x: 1234, y: 5678 } } } },
        files: {},
      },
    });
    expect(prompt).toContain(
      `rectangle x=${blocker.x} y=${blocker.y} width=${blocker.width} height=${blocker.height}`,
    );
    expect(prompt).toContain("freedraw");
    expect(prompt).toContain(ileWorkCanvasXaiToolsInstruction());
    expect(prompt).not.toContain("PREPARE_DELETED_MARK");
    expect(prompt).not.toContain("x=7 y=9 width=11 height=13");
    expect(prompt).not.toContain("cursor-agent-77");
    const textOnly = buildScoutQuestionsUserPrompt({
      seedTitle: "Heaps",
      canvasText: "Heaps",
    });
    expect(textOnly).not.toContain(`x=${blocker.x} y=${blocker.y} width=${blocker.width}`);

    const questionsApi = read("app/api/workspace-tap-score/scout-questions/route.ts");
    const client = read("components/scout-tap/ScoutTapClient.tsx");
    expect(questionsApi).toContain("buildScoutQuestionsUserPrompt");
    expect(questionsApi).toContain("workCanvasScene");
    expect(client).toContain("workCanvasScene: serializeTapWorkCanvasScene(scene)");
    expect(client).toContain("connectScoutQuestionToCanvas");

    writeScratch(
      "canvas-nonoverlap-prepare.txt",
      [
        `childMoved=${child.x !== naive.x || child.y !== naive.y}`,
        `parentKept=${keptParent.x === parent.x && keptParent.y === parent.y}`,
        `geometry=${prompt.includes(`width=${blocker.width}`)}`,
        `tools=${prompt.includes("freedraw")}`,
        `textOnlyMissesGeometry=${!textOnly.includes(`width=${blocker.width}`)}`,
      ].join("\n") + "\n",
    );
  });
});
