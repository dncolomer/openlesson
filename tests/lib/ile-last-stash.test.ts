/**
 * ILE Learning Mode: last-stash compact Helios + Thought-tool multi-select send/edit.
 * Drives shipped helpers (not a reimplementation) and checks live surfaces.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_EDIT_SELECTION_LABEL,
  ILE_SEE_YOUR_THOUGHTS_LABEL,
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

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d4d25428c41b/implementer";

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

describe("selectLastStashedThought (shipped)", () => {
  it("empty yields no last thought; one and many pick the newest, not list[0] / first three", () => {
    expect(selectLastStashedThought([])).toBeNull();
    expect(selectLastStashedThought(undefined)).toBeNull();
    expect(selectLastStashedThought(null)).toBeNull();

    const one = [thought("only", "solo")];
    expect(selectLastStashedThought(one)).toEqual(one[0]);

    const last = selectLastStashedThought(OLDEST_TO_NEWEST);
    expect(last).toEqual(OLDEST_TO_NEWEST[3]);
    expect(last?.id).not.toBe(OLDEST_TO_NEWEST[0].id);
    expect(last?.text).toBe("newest thought");
    expect(OLDEST_TO_NEWEST.slice(0, 3).map((item) => item.id)).not.toContain(last?.id);

    writeScratch(
      "ile-last-stash.txt",
      [
        "empty=null",
        `one=${selectLastStashedThought(one)?.id}:${selectLastStashedThought(one)?.text}`,
        `many=${last?.id}:${last?.text}`,
        "not list[0] / not first three",
      ].join("\n"),
    );
  });
});

describe("combineSelectedThoughtText (shipped)", () => {
  it("joins 1 thought and 2+ thoughts in list order", () => {
    const one = combineSelectedThoughtText(OLDEST_TO_NEWEST, ["t2"]);
    expect(one.ids).toEqual(["t2"]);
    expect(one.text).toBe("middle thought");
    expect(one.text.trim().length).toBeGreaterThan(0);

    const many = combineSelectedThoughtText(OLDEST_TO_NEWEST, new Set(["t4", "t1"]));
    expect(many.ids).toEqual(["t1", "t4"]);
    expect(many.text).toBe("first thought\nnewest thought");
    expect(many.text.trim().length).toBeGreaterThan(0);

    const empty = combineSelectedThoughtText(OLDEST_TO_NEWEST, []);
    expect(empty.text).toBe("");
    expect(empty.ids).toEqual([]);

    writeScratch(
      "ile-combine-selection.txt",
      [
        `one=${one.ids.join(",")}|${one.text}`,
        `many=${many.ids.join(",")}|${JSON.stringify(many.text)}`,
        `empty=${empty.ids.length}|${JSON.stringify(empty.text)}`,
      ].join("\n"),
    );
  });
});

describe("shipped send/edit handlers", () => {
  it("last thought → send with that thought's id/text", async () => {
    const calls: { text: string; ids: string[] }[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      calls.push({ text, ids: thoughtIds });
    };

    const empty = await submitLastStashedThought({ thoughts: [], sendThought });
    expect(empty.submitted).toBe(false);
    expect(calls).toEqual([]);

    const one = await submitLastStashedThought({
      thoughts: [thought("only", "solo")],
      sendThought,
    });
    expect(one.submitted).toBe(true);
    expect(calls).toEqual([{ text: "solo", ids: ["only"] }]);

    calls.length = 0;
    const many = await submitLastStashedThought({
      thoughts: OLDEST_TO_NEWEST,
      sendThought,
    });
    expect(many.submitted).toBe(true);
    expect(many.thought?.id).toBe("t4");
    expect(calls).toEqual([{ text: "newest thought", ids: ["t4"] }]);
  });

  it("selected ids → submit combined text on the send path", async () => {
    const calls: { text: string; ids: string[] }[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      calls.push({ text, ids: thoughtIds });
    };

    const none = await submitSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: [],
      sendThought,
    });
    expect(none.submitted).toBe(false);
    expect(calls).toEqual([]);

    const one = await submitSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: ["t3"],
      sendThought,
    });
    expect(one.submitted).toBe(true);
    expect(calls).toEqual([{ text: "third thought", ids: ["t3"] }]);

    calls.length = 0;
    const many = await submitSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: new Set(["t2", "t4"]),
      sendThought,
    });
    expect(many.submitted).toBe(true);
    expect(calls).toEqual([{ text: "middle thought\nnewest thought", ids: ["t2", "t4"] }]);
  });

  it("edit-selection draft → submit the edited draft on the send path", async () => {
    const calls: { text: string; ids: string[] }[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      calls.push({ text, ids: thoughtIds });
    };

    const started = beginEditSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: ["t1", "t3"],
    });
    expect(started).not.toBeNull();
    expect(started?.draft).toBe("first thought\nthird thought");
    expect(started?.thoughtIds).toEqual(["t1", "t3"]);

    const skipped = await submitEditedThoughtSelection({
      draft: "   ",
      thoughtIds: started!.thoughtIds,
      sendThought,
    });
    expect(skipped.submitted).toBe(false);
    expect(calls).toEqual([]);

    const edited = await submitEditedThoughtSelection({
      draft: "manually edited combined thought",
      thoughtIds: started!.thoughtIds,
      sendThought,
    });
    expect(edited.submitted).toBe(true);
    expect(calls).toEqual([
      { text: "manually edited combined thought", ids: ["t1", "t3"] },
    ]);
  });
});

describe("See Older Thoughts wiring (shipped)", () => {
  it("thought-history helper still maps to the Thoughts tool; Helios has no See Your thoughts button", () => {
    const tools: string[] = [];
    openIleThoughtHistoryTool((tool) => {
      tools.push(tool);
    });
    expect(tools).toEqual([ILE_THOUGHT_HISTORY_TOOL]);
    expect(ILE_THOUGHT_HISTORY_TOOL).toBe("thought-history");

    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).not.toContain(ILE_SEE_YOUR_THOUGHTS_LABEL);
    expect(helios).not.toContain("onOpenThoughts");
    expect(helios).not.toContain("data-ile-see-older-thoughts");

    const pane = read("components/session-view/session-thought-pane.tsx");
    expect(pane).not.toContain("onOpenThoughts");

    const view = readSessionViewSurface();
    expect(view).not.toContain("openIleThoughtHistoryTool");
    expect(view).not.toContain("onOpenThoughts");
    expect(view).toContain('activeTool === "thought-history"');
  });
});

describe("ILE Helios last-stash surface (shipped source)", () => {
  it("has no last thought or Submit last Thought on Helios", () => {
    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).not.toContain(ILE_SUBMIT_LAST_THOUGHT_LABEL);
    expect(helios).not.toContain(ILE_SEE_YOUR_THOUGHTS_LABEL);
    expect(helios).not.toContain("Submit last Thought");
    expect(helios).not.toContain("See Your thoughts");
    expect(helios).not.toContain("See Older Thoughts");
    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).not.toContain("data-ile-last-stash");
    expect(helios).not.toContain("data-ile-last-stash-text");
    expect(helios).not.toContain("selectLastStashedThought");
    expect(helios).not.toContain("submitLastStashedThought");
    expect(helios).toContain("thought.sendThought");
    expect(helios).not.toContain("ActiveThoughtSlots");
    expect(helios).not.toContain("ACTIVE_THOUGHT_SLOT_COUNT");
    expect(helios).not.toContain("thought.latestThoughts");
    expect(helios).not.toContain("lastStashedThought");

    const hook = read("lib/useSessionThoughtInterface.ts");
    expect(hook).not.toContain("lastStashedThought");
    expect(hook).not.toContain("selectLastStashedThought");

    const slots = read("components/thought-ui/ActiveThoughtSlots.tsx");
    expect(slots).toContain("ACTIVE_THOUGHT_SLOT_COUNT");
  });
});

describe("ILE Thought tool multi-select (shipped source)", () => {
  it("shows Submit Selection / Edit Selection and reuses thought-edit prompt", () => {
    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    expect(memory).toContain(ILE_SUBMIT_SELECTION_LABEL);
    expect(memory).toContain(ILE_EDIT_SELECTION_LABEL);
    expect(memory).toContain("Submit Selection");
    expect(memory).toContain("Edit Selection");
    expect(memory).toContain("data-submit-selection");
    expect(memory).toContain("data-edit-selection");
    expect(memory).toContain("submitSelectedThoughts");
    expect(memory).toContain("beginEditSelectedThoughts");
    expect(memory).toContain("submitEditedThoughtSelection");
    expect(memory).toContain("ThoughtEditPanel");
    expect(memory).toContain("selectionEdit.draft");
    expect(memory).toContain('title="Edit selection"');
    expect(memory).toContain("onSendThought");

    const panes = read("components/session-view/session-tool-panes.tsx");
    expect(panes).toContain('activeTool === "thought-history"');
    expect(panes).toContain("onSendThought={onSendThought}");
    expect(panes).toContain("<ThoughtMemoryPanel");

    const edit = read("components/thought-ui/ThoughtEditPanel.tsx");
    expect(edit).toContain("<textarea");
    expect(edit).toContain("data-thought-edit-panel");
    expect(edit).toContain("submitLabel");
    expect(edit).toContain("onSend");
  });
});
