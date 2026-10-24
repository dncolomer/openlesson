/**
 * TAP solo uses the same universal Stash Submit UI as TAP Learning and TAP conversation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";
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
} from "@/lib/learn-last-stash";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ad1ba1775897/implementer";

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

describe("TAP solo live Stash Submit chrome", () => {
  it("has last-thought labels and Send/Stash/Edit; no solution stack", () => {
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);

    expect(existsSync(join(ROOT, "components/exercise-tap/exercise-tap-phases.tsx"))).toBe(false);

    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);

    expect(existsSync(join(ROOT, "components/exercise-tap"))).toBe(false);




    writeScratch(
      "tap-solo-unify-stash.txt",
      "Exercise TAP UI gone; conversational TAP remains on TapScoreClient.\n",
    );
  });
});

describe("TAP solo older-thoughts Thought Memory", () => {
  it("opens ThoughtMemoryPanel with per-thought edit/delete, not multi-select submit", () => {
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);

    const memory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    const edit = read("components/thought-ui/ThoughtEditPanel.tsx");

    expect(memory).toContain("data-tap-edit-thought");
    expect(memory).toContain("data-tap-delete-thought");
    expect(memory).toContain('submitLabel="Save"');
    expect(edit).toContain("<textarea");
    expect(edit).toContain("submitLabel");

    writeScratch(
      "tap-solo-unify-thought-tool.txt",
      [
        "Thought Memory always on TAP solo (no See / Edit toggle)",
        "ThoughtMemoryPanel insightSurface=tap onEditThought/onDeleteThought",
        `Submit Selection still TAP Learning-only in panel=${memory.includes(ILE_SUBMIT_SELECTION_LABEL)}`,
        `Edit Selection still TAP Learning-only in panel=${memory.includes(ILE_EDIT_SELECTION_LABEL)}`,
        "TAP item edit=ThoughtEditPanel Save, no Helios submit",
      ].join("\n"),
    );
  });
});

describe("Thought Memory is always on TAP solo chrome", () => {
  it("mounts ThoughtMemoryPanel without a See / Edit toggle", () => {
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);

  });
});

describe("universal Stash Submit labels across TAP Learning + TAP", () => {
  it("all four surfaces contain the same English labels", () => {
    expect(existsSync(join(ROOT, "components/SessionHeliosPanel.tsx"))).toBe(false);
    const ileHelios = read("lib/useSessionThoughtInterface.ts");
    const ileMemory = read("components/thought-ui/ThoughtMemoryPanel.tsx");
    const ilePanes = read("components/session-view/session-tool-panes.tsx");
    const tapConvo = readTapScoreSurface();
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/exercise-tap"))).toBe(false);

    const session = readSessionViewSurface();

    expect(ileHelios).not.toContain("Submit last Thought");
    expect(ileHelios).not.toContain("See Your thoughts");
    expect(ileHelios).not.toContain("See Older Thoughts");
    expect(ileHelios).not.toContain("ImDoneAnsweringControl");
    for (const surface of [tapConvo]) {
      expect(surface).not.toContain("Submit last Thought");
      expect(surface).not.toContain("TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL");
      expect(surface).toContain("data-tap-thought-memory-always");
      expect(surface).not.toContain("See Older Thoughts");
      expect(surface).toContain("ImDoneAnsweringControl");
    }
    expect(ileMemory).toContain("Submit Selection");
    expect(ileMemory).toContain("Edit Selection");
    expect(ilePanes).toContain("IleReviewWorkPanel");
    expect(session).toContain("IleReviewWorkPanel");
    expect(tapConvo).toContain("ThoughtMemoryPanel");
  });
});

describe("shipped last-stash + send/edit handlers with TAP solo sendThought sink", () => {
  it("empty/one/many last-stash; 1 and 2+ combine; send last, selection, edited draft", async () => {
    expect(selectLastStashedThought([])).toBeNull();
    expect(selectLastStashedThought([thought("only", "solo")])?.id).toBe("only");
    expect(selectLastStashedThought(OLDEST_TO_NEWEST)?.id).toBe("t4");

    const one = combineSelectedThoughtText(OLDEST_TO_NEWEST, ["t2"]);
    expect(one.text).toBe("middle thought");
    const many = combineSelectedThoughtText(OLDEST_TO_NEWEST, new Set(["t4", "t1"]));
    expect(many.text).toBe("first thought\nnewest thought");

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
