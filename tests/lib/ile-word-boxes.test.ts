/**
 * ILE per-word bounding boxes + Open Grok / Open Dantes prefill.
 * Drives shipped helpers (not a reimplementation). TAP must not mount this.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface, readTapScoreSurface, readExerciseTapSurface } from "@/tests/helpers/surface-source";
import {
  ILE_WORD_BOX_DANTES_TOOL,
  ILE_WORD_BOX_GROK_TOOL,
  ILE_WORD_BOX_OPEN_DANTES_LABEL,
  ILE_WORD_BOX_OPEN_GROK_LABEL,
  ileWordBoxApplyWindowPointerUp,
  ileWordBoxMenuActions,
  ileWordBoxMenuPosition,
  ileWordBoxPointerDown,
  ileWordBoxPointerEnter,
  ileWordBoxPointerIdle,
  ileWordBoxPointerUp,
  ileWordBoxSelectionText,
  ileWordBoxShouldClearSelection,
  ILE_WORD_BOX_MENU_OFFSET_PX,
  openIleWordBoxTool,
  resolveIleGrokipediaSearchValue,
  splitIleTurnWords,
  stripIleConceptMarkDelimiters,
} from "@/lib/ile-word-boxes";
import { IleWordBoxText } from "@/components/thought-ui/IleWordBoxText";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d11267a7dd9c/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ile word-box helpers (shipped)", () => {
  it("splits every word, drag-range joins selection, menu is Open Grok + Open Dantes, concept marks are gone", () => {
    const learningTurn = "Walk the recurrence relation with me.";
    const projectPrompt = "Implement binary search on a sorted array.";

    const learningTokens = splitIleTurnWords(learningTurn);
    const learningWords = learningTokens
      .filter((token) => token.kind === "word")
      .map((token) => token.text);
    expect(learningWords).toEqual(["Walk", "the", "recurrence", "relation", "with", "me."]);
    expect(learningWords).not.toContain("==");

    const projectTokens = splitIleTurnWords(projectPrompt);
    const projectWords = projectTokens
      .filter((token) => token.kind === "word")
      .map((token) => token.text);
    expect(projectWords).toEqual(["Implement", "binary", "search", "on", "a", "sorted", "array."]);

    expect(ileWordBoxSelectionText(learningTokens, 2, 2)).toBe("recurrence");
    expect(ileWordBoxSelectionText(learningTokens, 2, 3)).toBe("recurrence relation");
    expect(ileWordBoxSelectionText(learningTokens, 3, 2)).toBe("recurrence relation");
    expect(ileWordBoxSelectionText(learningTokens, 0, 5)).toBe("Walk the recurrence relation with me.");
    expect(ileWordBoxSelectionText(learningTokens, 2, 3)).not.toBe(learningTurn);

    const leftover = stripIleConceptMarkDelimiters("Walk the ==recurrence relation== with me.");
    expect(leftover).toBe("Walk the recurrence relation with me.");
    expect(splitIleTurnWords("Walk the ==recurrence relation== with me.").map((t) => (t.kind === "word" ? t.text : "")).filter(Boolean)).toEqual([
      "Walk",
      "the",
      "recurrence",
      "relation",
      "with",
      "me.",
    ]);

    const one = ileWordBoxMenuActions("recurrence");
    expect(one).toEqual([
      { tool: ILE_WORD_BOX_GROK_TOOL, query: "recurrence", label: ILE_WORD_BOX_OPEN_GROK_LABEL },
      { tool: ILE_WORD_BOX_DANTES_TOOL, query: "recurrence", label: ILE_WORD_BOX_OPEN_DANTES_LABEL },
    ]);
    expect(one.map((action) => action.tool)).toEqual(["grokipedia", "dantes"]);
    expect(one.map((action) => action.label)).toEqual(["Open Grok", "Open Dantes"]);
    expect(one[0]?.tool).toBe("grokipedia");
    expect(one[1]?.tool).toBe("dantes");
    expect(ileWordBoxMenuActions("")).toEqual([]);
    const many = ileWordBoxMenuActions("binary search");
    expect(many[0]?.query).toBe("binary search");
    expect(many[0]?.query).not.toBe(projectPrompt);

    const tools: string[] = [];
    const prefills: string[] = [];
    const grok = openIleWordBoxTool({
      tool: "grokipedia",
      query: "binary search",
      setActiveTool: (tool) => tools.push(tool),
      setPrefillQuery: (query) => prefills.push(query),
    });
    expect(grok).toEqual({
      tool: "grokipedia",
      query: "binary search",
      label: "Open Grok",
    });
    const dantes = openIleWordBoxTool({
      tool: "dantes",
      query: "binary search",
      setActiveTool: (tool) => tools.push(tool),
      setPrefillQuery: (query) => prefills.push(query),
    });
    expect(dantes?.tool).toBe("dantes");
    expect(dantes?.query).toBe("binary search");
    expect(tools).toEqual(["grokipedia", "dantes"]);
    expect(prefills).toEqual(["binary search", "binary search"]);

    expect(
      resolveIleGrokipediaSearchValue({
        prefillQuery: "binary search",
        sessionProblem: "the whole session problem",
      }),
    ).toBe("binary search");

    const html = renderToStaticMarkup(
      createElement(IleWordBoxText, { text: learningTurn }),
    );
    expect(html).toContain("data-ile-word-box");
    expect(html).toContain("data-ile-word-box-surface");
    expect(html.match(/data-ile-word-index=/g)?.length).toBe(6);
    expect(html).not.toContain("data-ile-concept-mark");

    let pointer = ileWordBoxPointerIdle();
    const skippedUp = ileWordBoxPointerUp(pointer, learningTokens);
    expect(skippedUp.menuText).toBeNull();
    pointer = ileWordBoxPointerDown(pointer, 2);
    const oneRelease = ileWordBoxPointerUp(pointer, learningTokens);
    expect(oneRelease.menuText).toBe("recurrence");
    const oneMenu = ileWordBoxMenuActions(oneRelease.menuText);
    expect(oneMenu.map((action) => action.label)).toEqual(["Open Grok", "Open Dantes"]);
    expect(oneMenu.map((action) => action.query)).toEqual(["recurrence", "recurrence"]);

    pointer = ileWordBoxPointerDown(ileWordBoxPointerIdle(), 2);
    pointer = ileWordBoxPointerEnter(pointer, 3);
    const dragRelease = ileWordBoxPointerUp(pointer, learningTokens);
    expect(dragRelease.menuText).toBe("recurrence relation");
    const dragMenu = ileWordBoxMenuActions(dragRelease.menuText);
    expect(dragMenu[0]).toMatchObject({ tool: "grokipedia", query: "recurrence relation", label: "Open Grok" });
    expect(dragMenu[1]).toMatchObject({ tool: "dantes", query: "recurrence relation", label: "Open Dantes" });
    expect(dragRelease.menuText).not.toBe(learningTurn);

    pointer = ileWordBoxPointerEnter(ileWordBoxPointerIdle(), 4);
    expect(pointer.dragging).toBe(false);
    expect(pointer.head).toBeNull();

    pointer = ileWordBoxPointerDown(ileWordBoxPointerIdle(), 2);
    pointer = ileWordBoxPointerEnter(pointer, 3);
    let menu: string | null = null;
    const dragApply = ileWordBoxApplyWindowPointerUp(pointer, learningTokens);
    expect(dragApply.apply).toBe(true);
    expect(dragApply.menuText).toBe("recurrence relation");
    if (dragApply.apply) menu = dragApply.menuText;
    const idleClick = ileWordBoxApplyWindowPointerUp(dragApply.state, learningTokens);
    expect(idleClick.apply).toBe(false);
    expect(idleClick.menuText).toBeNull();
    if (idleClick.apply) menu = idleClick.menuText;
    expect(menu).toBe("recurrence relation");
    const stillOpen = ileWordBoxMenuActions(menu);
    expect(stillOpen.map((action) => action.label)).toEqual(["Open Grok", "Open Dantes"]);
    expect(stillOpen[0]?.query).toBe("recurrence relation");

    const atPointer = ileWordBoxMenuPosition({ clientX: 120, clientY: 80 });
    expect(atPointer).toEqual({
      left: 120 + ILE_WORD_BOX_MENU_OFFSET_PX,
      top: 80 + ILE_WORD_BOX_MENU_OFFSET_PX,
    });
    const flipped = ileWordBoxMenuPosition({
      clientX: 790,
      clientY: 590,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(flipped.left).toBeLessThan(790);
    expect(flipped.top).toBeLessThan(590);
    expect(flipped.left).toBeGreaterThanOrEqual(ILE_WORD_BOX_MENU_OFFSET_PX);
    expect(flipped.top).toBeGreaterThanOrEqual(ILE_WORD_BOX_MENU_OFFSET_PX);

    const menuTarget = {
      closest: (selector: string) => (selector === "[data-ile-word-box-menu]" ? {} : null),
    };
    const wordTarget = {
      closest: (selector: string) => (selector === "[data-ile-word-box]" ? {} : null),
    };
    const awayTarget = { closest: () => null };
    expect(ileWordBoxShouldClearSelection({ target: awayTarget, hasSelection: true })).toBe(true);
    expect(ileWordBoxShouldClearSelection({ target: menuTarget, hasSelection: true })).toBe(false);
    expect(ileWordBoxShouldClearSelection({ target: wordTarget, hasSelection: true })).toBe(false);
    expect(ileWordBoxShouldClearSelection({ target: awayTarget, hasSelection: false })).toBe(false);
    expect(ileWordBoxShouldClearSelection({ target: null, hasSelection: true })).toBe(true);

    writeScratch(
      "ile-word-boxes.txt",
      [
        `learningWords=${JSON.stringify(learningWords)}`,
        `projectWords=${JSON.stringify(projectWords)}`,
        `oneWord=${ileWordBoxSelectionText(learningTokens, 2, 2)}`,
        `manyWords=${ileWordBoxSelectionText(learningTokens, 2, 3)}`,
        `grokTool=${grok?.tool}`,
        `grokQuery=${grok?.query}`,
        `dantesTool=${dantes?.tool}`,
        `dantesQuery=${dantes?.query}`,
        `stripped=${leftover}`,
        `htmlHasWordBoxes=${html.includes("data-ile-word-box")}`,
        `htmlHasConceptMark=${html.includes("data-ile-concept-mark")}`,
        `pointerOne=${oneRelease.menuText}`,
        `pointerDrag=${dragRelease.menuText}`,
        `pointerMenu=${dragMenu.map((action) => action.label).join("|")}`,
        `idleUpClearsMenu=${idleClick.apply}`,
        `menuSurvivesIdleUp=${menu}`,
        `menuAtPointer=${atPointer.left},${atPointer.top}`,
        `clickAway=${ileWordBoxShouldClearSelection({ target: awayTarget, hasSelection: true })}`,
        `clickMenu=${ileWordBoxShouldClearSelection({ target: menuTarget, hasSelection: true })}`,
      ].join("\n"),
    );
  });
});

describe("ILE word-box surfaces (shipped source)", () => {
  it("Learning and Project paint word boxes + Open Grok/Dantes; TAP overlay does not; concept highlighter is gone", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    const ui = read("components/thought-ui/ThoughtUi.tsx");
    const boxes = read("components/thought-ui/IleWordBoxText.tsx");
    const markdown = read("components/thought-ui/HeliosMarkdown.tsx");
    const grok = read("components/GrokGrokipediaTool.tsx");
    const dantes = read("components/DantesTool.tsx");
    const panes = read("components/session-view/session-tool-panes.tsx");
    const view = readSessionViewSurface();
    const overlay = read("components/tap-score/tap-turn-overlay.tsx");
    const tap = readTapScoreSurface();
    const exercise = readExerciseTapSurface();
    const ileSurface = read("lib/prompt-kernel/surfaces/ile.ts");
    const harness = read("lib/ile-chapter-depth.ts");

    expect(existsSync(join(ROOT, "lib/ile-concept-marks.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "components/thought-ui/IleConceptMarkedText.tsx"))).toBe(false);

    expect(boxes).toContain("data-ile-word-box");
    expect(boxes).toContain("data-ile-word-box-menu");
    expect(boxes).toContain("ileWordBoxMenuActions");
    expect(boxes).toContain("ileWordBoxPointerDown");
    expect(boxes).toContain("ileWordBoxPointerEnter");
    expect(boxes).toContain("ileWordBoxApplyWindowPointerUp");
    expect(boxes).toContain("if (!released.apply) return");
    expect(boxes).toContain("ileWordBoxMenuPosition");
    expect(boxes).toContain("ileWordBoxShouldClearSelection");
    expect(boxes).toContain("createPortal");
    expect(boxes).toContain('data-ile-word-box-menu-at="pointer"');
    expect(boxes).toContain('window.addEventListener("pointerdown"');
    expect(boxes).toContain("pointerRef");
    expect(boxes).toContain("data-ile-word-box-open");
    expect(boxes).toContain("data-ile-word-box-menu-text");
    expect(boxes).toContain("{action.label}");
    expect(boxes).toContain("min-w-[11rem]");
    expect(boxes).toContain("border-neutral-800");
    expect(boxes).toContain("bg-neutral-950");
    expect(boxes).toContain("hover:bg-white");
    expect(boxes).toContain("hover:text-black");
    expect(boxes).toContain('role="separator"');
    expect(boxes).not.toContain("flex-wrap");
    expect(boxes).not.toContain("border-neutral-200 bg-white px-2.5");
    expect(boxes).toContain("userSelect: \"none\"");
    expect(boxes).toContain("hover:border-white/45");
    expect(boxes).toContain("border-white/80");
    expect(boxes).toContain("bg-white/15");
    expect(boxes).not.toMatch(/border-amber-|bg-amber-|border-yellow-|bg-yellow-/);
    expect(boxes).not.toContain("data-ile-concept-mark");

    const ileFn = ui.slice(ui.indexOf("function DialogueSplitIle"), ui.indexOf("function DialogueSplitFramed"));
    expect(ileFn).toContain("IleWordBoxText");
    expect(ileFn).toContain("onOpenWordBoxTool");
    expect(ileFn).not.toContain("<HeliosMarkdown");
    expect(ileFn).not.toContain("onConceptClick");
    expect(helios).toContain("IleWordBoxText");
    expect(helios).toContain("onOpenWordBoxTool={onOpenWordBoxTool}");
    expect(helios).not.toContain("IleConceptMarkedText");
    expect(helios).not.toContain("data-ile-concept-mark");
    expect(helios).not.toContain("onConceptClick");

    expect(markdown).not.toContain("onConceptClick");
    expect(markdown).not.toContain("encodeIleConceptMarkdown");
    expect(markdown).not.toContain("IleConceptMark");

    expect(view).toContain("openIleWordBoxTool");
    expect(view).toContain("onOpenWordBoxTool");
    expect(view).toContain("toolPrefillQuery");
    expect(view).not.toContain("openIleGrokipediaWithConcept");
    expect(view).not.toContain("onOpenConcept");
    expect(panes).toContain("prefillQuery={toolPrefillQuery}");
    expect(grok).toContain("prefillQuery");
    expect(grok).toContain("setGrokQuery");
    expect(grok).toContain("data-ile-grok-search");
    expect(dantes).toContain("prefillQuery");
    expect(dantes).toContain("data-ile-dantes-search");

    expect(overlay).not.toContain("IleWordBoxText");
    expect(overlay).not.toContain("data-ile-word-box");
    expect(overlay).toContain("HeliosMarkdown");
    expect(tap).not.toContain("IleWordBoxText");
    expect(tap).not.toContain("openIleWordBoxTool");
    expect(exercise).not.toContain("IleWordBoxText");
    expect(exercise).not.toContain("openIleWordBoxTool");

    expect(ileSurface).not.toContain("ILE_CONCEPT_MARK_PROMPT");
    expect(ileSurface).not.toContain("==binary search==");
    expect(harness).not.toContain("==binary search==");
    expect(harness).not.toContain("CONCEPT LOOKUPS");

    writeScratch(
      "ile-word-box-surface.txt",
      [
        "Learning: DialogueSplitIle IleWordBoxText onOpenWordBoxTool",
        "Project: IleWordBoxText on data-ile-project-exercise-prompt",
        "menu: Open Grok → grokipedia + Open Dantes → dantes, both prefillQuery",
        "GrokGrokipediaTool + DantesTool accept prefillQuery",
        "TAP overlay: HeliosMarkdown, no word boxes",
        `conceptMarksGone=${!existsSync(join(ROOT, "lib/ile-concept-marks.ts"))}`,
        `promptHasEqualsWrap=${ileSurface.includes("==binary search==")}`,
      ].join("\n"),
    );
  });
});
