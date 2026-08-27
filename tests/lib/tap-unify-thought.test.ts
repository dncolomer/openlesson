/**
 * TAP conversation stash/thought management matches ILE Thought Memory.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTapScoreSurface } from "@/tests/helpers/surface-source";
import {
  ILE_EDIT_SELECTION_LABEL,
  ILE_SEE_OLDER_THOUGHTS_LABEL,
  ILE_SUBMIT_LAST_THOUGHT_LABEL,
  ILE_SUBMIT_SELECTION_LABEL,
  beginEditSelectedThoughts,
  combineSelectedThoughtText,
  openOlderThoughtsSurface,
  selectLastStashedThought,
  submitEditedThoughtSelection,
  submitLastStashedThought,
  submitSelectedThoughts,
} from "@/lib/ile-last-stash";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-43407c170b6f/implementer";

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

describe("TAP conversation live stash chrome (shipped source)", () => {
  it("has last-thought + exact labels; not ExerciseStashHistory", () => {
    const phases = read("components/tap-score/tap-score-phases.tsx");
    const live = readTapScoreSurface();
    expect(phases).not.toContain(ILE_SUBMIT_LAST_THOUGHT_LABEL);
    expect(phases).not.toContain(ILE_SEE_OLDER_THOUGHTS_LABEL);
    expect(phases).not.toContain("Submit last Thought");
    expect(phases).not.toContain("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL");
    expect(phases).not.toContain("data-tap-last-stash");
    expect(phases).not.toContain("data-tap-see-older-thoughts");
    expect(phases).not.toContain('label="Send"');
    expect(phases).toContain('label="Stash"');
    expect(phases).not.toContain('label="Edit"');
    expect(phases).not.toContain("selectLastStashedThought");
    expect(phases).not.toContain("submitLastStashedThought");
    expect(phases).toContain("ImDoneAnsweringControl");
    expect(phases).toContain("sendThought");
    expect(live).not.toContain("ExerciseStashHistory");
    expect(live).not.toContain("data-exercise-stash-history");

    const shell = read("components/exercise-tap/ExerciseTapShell.tsx");
    const exercisePhases = read("components/exercise-tap/exercise-tap-phases.tsx");
    expect(shell).not.toContain("ExerciseStashHistory");
    expect(exercisePhases).not.toContain("ExerciseStashHistory");
    expect(shell).not.toContain("Submit last Thought");
    expect(shell).not.toContain("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL");
    expect(shell).toContain("ImDoneAnsweringControl");

    writeScratch(
      "tap-unify-helios-stash.txt",
      [
        `Submit last Thought=${phases.includes(ILE_SUBMIT_LAST_THOUGHT_LABEL)}`,
        `See / Edit gone=${!phases.includes("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL")}`,
        `always-on memory=${phases.includes("data-tap-thought-memory-always")}`,
        `stash=${phases.includes('label="Stash"')} editChip=${phases.includes('label="Edit"')}`,
        `no ExerciseStashHistory on TAP convo=${!live.includes("ExerciseStashHistory")}`,
        `no ExerciseStashHistory on TAP solo=${!shell.includes("ExerciseStashHistory")}`,
      ].join("\n"),
    );
  });
});

describe("TAP older-thoughts Thought Memory surface", () => {
  it("opens ThoughtMemoryPanel with per-thought edit/delete, not multi-select submit", () => {
    const phases = read("components/tap-score/tap-score-phases.tsx");
    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    const edit = read("components/thought-ui/ThoughtEditPanel.tsx");

    expect(phases).not.toContain("openOlderThoughtsSurface");
    expect(phases).not.toContain("data-tap-see-older-thoughts");
    expect(phases).toContain("data-tap-thought-memory-always");
    expect(phases).toContain("data-tap-older-thoughts");
    expect(phases).toContain("ThoughtMemoryPanel");
    expect(phases).toContain('insightSurface="tap"');
    expect(phases).not.toContain("onSendThought={sendThought}");
    expect(phases).toContain("onEditThought={onEditThought}");
    expect(phases).toContain("onDeleteThought={onDeleteThought}");
    expect(memory).toContain("data-tap-edit-thought");
    expect(memory).toContain("data-tap-delete-thought");
    expect(memory).toContain('submitLabel="Save"');
    expect(edit).toContain("<textarea");
    expect(edit).toContain("submitLabel");

    writeScratch(
      "tap-unify-thought-tool.txt",
      [
        "Thought Memory always on TAP convo (no See / Edit toggle)",
        "ThoughtMemoryPanel insightSurface=tap onEditThought/onDeleteThought",
        `Submit Selection still ILE-only in panel=${memory.includes(ILE_SUBMIT_SELECTION_LABEL)}`,
        `Edit Selection still ILE-only in panel=${memory.includes(ILE_EDIT_SELECTION_LABEL)}`,
        "TAP item edit=ThoughtEditPanel Save, no Helios submit",
      ].join("\n"),
    );
  });
});

describe("Thought Memory is always on TAP convo chrome", () => {
  it("mounts ThoughtMemoryPanel without a See / Edit toggle", () => {
    const phases = read("components/tap-score/tap-score-phases.tsx");
    expect(phases).toContain("data-tap-thought-memory-always");
    expect(phases).toContain("<ThoughtMemoryPanel");
    expect(phases).not.toContain("openOlderThoughtsSurface");
    expect(phases).not.toContain("olderThoughtsOpen");
    expect(phases).not.toContain("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL");
  });
});

describe("shipped last-stash + send/edit handlers with TAP sendThought sink", () => {
  it("empty/one/many last-stash; 1 and 2+ combine; send last, selection, edited draft", async () => {
    expect(selectLastStashedThought([])).toBeNull();
    expect(selectLastStashedThought([thought("only", "solo")])?.id).toBe("only");
    expect(selectLastStashedThought(OLDEST_TO_NEWEST)?.id).toBe("t4");
    expect(selectLastStashedThought(OLDEST_TO_NEWEST)?.id).not.toBe("t1");

    const one = combineSelectedThoughtText(OLDEST_TO_NEWEST, ["t2"]);
    expect(one.text).toBe("middle thought");
    const many = combineSelectedThoughtText(OLDEST_TO_NEWEST, new Set(["t4", "t1"]));
    expect(many.text).toBe("first thought\nnewest thought");
    expect(many.ids).toEqual(["t1", "t4"]);

    const calls: { text: string; ids: string[] }[] = [];
    const sendThought = async (text: string, thoughtIds: string[]) => {
      calls.push({ text, ids: thoughtIds });
    };

    await submitLastStashedThought({ thoughts: [], sendThought });
    expect(calls).toEqual([]);

    await submitLastStashedThought({ thoughts: OLDEST_TO_NEWEST, sendThought });
    expect(calls).toEqual([{ text: "newest thought", ids: ["t4"] }]);

    calls.length = 0;
    await submitSelectedThoughts({
      thoughts: OLDEST_TO_NEWEST,
      selectedIds: ["t3"],
      sendThought,
    });
    expect(calls).toEqual([{ text: "third thought", ids: ["t3"] }]);

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
  });
});
