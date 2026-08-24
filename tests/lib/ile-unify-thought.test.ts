/**
 * ILE solo + conversation share the conversation thought-stash process.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_EDIT_SELECTION_LABEL,
  ILE_SEE_OLDER_THOUGHTS_LABEL,
  ILE_SUBMIT_LAST_THOUGHT_LABEL,
  ILE_SUBMIT_SELECTION_LABEL,
  ILE_THOUGHT_HISTORY_TOOL,
  beginEditSelectedThoughts,
  combineSelectedThoughtText,
  openIleThoughtHistoryTool,
  selectLastStashedThought,
  submitEditedThoughtSelection,
  submitLastStashedThought,
  submitSelectedThoughts,
} from "@/lib/ile-last-stash";
import { applyIleContextFullAutoStash } from "@/lib/ile-context-auto-stash";
import { emptyIleProjectDualLists } from "@/lib/ile-mode";
import { THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS } from "@/lib/thought-context-auto-stash";
import { decideIleKeyboardAction } from "@/lib/ile-keyboard-mode";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-bb1322ed3d29/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function thought(id: string, text: string) {
  return { id, text };
}

const OLDEST_TO_NEWEST = [
  thought("t1", "first thought"),
  thought("t2", "middle thought"),
  thought("t3", "third thought"),
  thought("t4", "newest thought"),
];

describe("ILE Helios thought chrome is shared (solo + conversation)", () => {
  it("Send/Stash/Edit and last-stash labels are not gated off for project/solo", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).not.toContain('label="Send"');
    expect(helios).toContain('label="Stash"');
    expect(helios).not.toContain('label="Edit"');
    expect(helios).toContain("stashCurrentTranscription");
    expect(helios).not.toContain('label="Solution"');
    expect(helios).not.toContain("onProjectSubmitToSolution?.()");
    expect(helios).not.toContain("onProjectStash?.()");
    expect(helios).not.toContain(ILE_SUBMIT_LAST_THOUGHT_LABEL);
    expect(helios).toContain(ILE_SEE_OLDER_THOUGHTS_LABEL);
    expect(helios).toContain("data-ile-last-stash");
    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).toContain("thought.sendThought");
    expect(helios).not.toContain("{!projectMode ? (");
    const lastStashIdx = helios.indexOf("data-ile-last-stash");
    expect(lastStashIdx).toBeGreaterThan(-1);

    writeScratch(
      "ile-unify-helios-stash.txt",
      [
        "Stash/Edit un-gated (no Send compact action)",
        `Submit last Thought=${helios.includes(ILE_SUBMIT_LAST_THOUGHT_LABEL)}`,
        `See Older Thoughts=${helios.includes(ILE_SEE_OLDER_THOUGHTS_LABEL)}`,
        `last-stash=${helios.includes("data-ile-last-stash")}`,
        `sendPath=ImDoneAnsweringControl + thought.sendThought`,
        `noProjectSolutionAction=${!helios.includes('label="Solution"')}`,
      ].join("\n"),
    );
  });
});

describe("ILE thought-history is Thought Memory in both modes", () => {
  it("does not mount dual-stack as the live Thoughts tool", () => {
    const panes = read("components/session-view/session-tool-panes.tsx");
    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    const view = readSessionViewSurface();

    expect(panes).toContain('activeTool === "thought-history"');
    expect(panes).toContain("ThoughtMemoryPanel");
    expect(panes).not.toContain("ProjectThoughtsDualStack");
    expect(panes).not.toContain("data-ile-thoughts-dual-stack");
    expect(view).not.toContain("ProjectThoughtsDualStack");
    expect(memory).toContain(ILE_SUBMIT_SELECTION_LABEL);
    expect(memory).toContain(ILE_EDIT_SELECTION_LABEL);
    expect(memory).toContain("ThoughtEditPanel");
    expect(memory).toContain("submitSelectedThoughts");
    expect(memory).toContain("beginEditSelectedThoughts");
    expect(memory).toContain("submitEditedThoughtSelection");
    expect(memory).toContain("ThoughtEditPanel");
    const edit = read("components/thought-ui/ThoughtEditPanel.tsx");
    expect(edit).toContain("<textarea");

    writeScratch(
      "ile-unify-thought-tool.txt",
      [
        "thought-history=ThoughtMemoryPanel both modes",
        "no ProjectThoughtsDualStack on live tool",
        `Submit Selection=${memory.includes(ILE_SUBMIT_SELECTION_LABEL)}`,
        `Edit Selection=${memory.includes(ILE_EDIT_SELECTION_LABEL)}`,
        "edit prompt=ThoughtEditPanel textarea + submit",
      ].join("\n"),
    );
  });
});

describe("See Older Thoughts reachable in both modes", () => {
  it("switches to thought-history from Helios without a solo-only omit", () => {
    const tools: string[] = [];
    openIleThoughtHistoryTool((tool) => {
      tools.push(tool);
    });
    expect(tools).toEqual([ILE_THOUGHT_HISTORY_TOOL]);

    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).toContain("data-ile-see-older-thoughts");
    expect(helios).toContain("onOpenThoughts");
    const seeIdx = helios.indexOf("data-ile-see-older-thoughts");
    const omit = helios.slice(Math.max(0, seeIdx - 400), seeIdx);
    expect(omit).not.toContain("!projectMode");

    const view = readSessionViewSurface();
    expect(view).toContain("openIleThoughtHistoryTool");
    expect(view).toMatch(/openIleThoughtHistoryTool\(\s*setActiveTool\s*\)/);

    expect(decideIleKeyboardAction({ mode: "project", key: "Enter" })).toBe("ignore");
    expect(decideIleKeyboardAction({ mode: "project", key: "Delete" })).toBe("helios_stash");
    expect(decideIleKeyboardAction({ mode: "helios", key: "Enter" })).toBe("ignore");
    expect(decideIleKeyboardAction({ mode: "helios", key: "Delete" })).toBe("helios_stash");
  });
});

describe("shipped last-stash + send/edit handlers (conversation path)", () => {
  it("empty/one/many last-stash; 1 and 2+ combine; send last, selection, edited draft", async () => {
    expect(selectLastStashedThought([])).toBeNull();
    expect(selectLastStashedThought([thought("only", "solo")])?.id).toBe("only");
    expect(selectLastStashedThought(OLDEST_TO_NEWEST)?.id).toBe("t4");

    const one = combineSelectedThoughtText(OLDEST_TO_NEWEST, ["t2"]);
    expect(one.text).toBe("middle thought");
    const many = combineSelectedThoughtText(OLDEST_TO_NEWEST, new Set(["t4", "t1"]));
    expect(many.text).toBe("first thought\nnewest thought");
    expect(many.ids).toEqual(["t1", "t4"]);

    const calls: { text: string; ids: string[] }[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      calls.push({ text, ids: thoughtIds });
    };

    await submitLastStashedThought({ thoughts: OLDEST_TO_NEWEST, sendThought });
    expect(calls).toEqual([{ text: "newest thought", ids: ["t4"] }]);

    calls.length = 0;
    await submitSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: ["t2", "t4"],
      sendThought,
    });
    expect(calls).toEqual([{ text: "middle thought\nnewest thought", ids: ["t2", "t4"] }]);

    const draft = beginEditSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: ["t1", "t3"],
    });
    expect(draft?.draft).toBe("first thought\nthird thought");
    calls.length = 0;
    await submitEditedThoughtSelection({
      draft: "manually edited combined thought",
      thoughtIds: draft!.thoughtIds,
      sendThought,
    });
    expect(calls).toEqual([
      { text: "manually edited combined thought", ids: ["t1", "t3"] },
    ]);

    const forming = "solo unify ".repeat(40).slice(0, THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS);
    const auto = applyIleContextFullAutoStash({
      formingText: forming,
      sessionMode: "project",
      chapterStatus: "in_progress",
      projectLists: emptyIleProjectDualLists(),
      nowMs: 88_000,
    });
    expect(auto.didStash).toBe(true);
    expect(auto.destination).toBe("thought-memory");
  });
});
