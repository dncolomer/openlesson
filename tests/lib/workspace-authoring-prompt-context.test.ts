import { readGridOpsSurface, readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composeAddBlockAtSlotSystemMessage,
  composeJourneyGraphPromptSnippet,
} from "@/lib/workspace-authoring-prompt-context";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const blocks = [
  {
    id: "a",
    title: "Intro",
    next_block_ids: ["b"],
    lock_until_block_ids: [],
  },
  {
    id: "b",
    title: "Core",
    next_block_ids: [],
    lock_until_block_ids: ["a"],
  },
];

describe("workspace authoring prompt context (journey + bridge)", () => {
  it("composeJourneyGraphPromptSnippet includes leads-to and lock-until lines", () => {
    const snip = composeJourneyGraphPromptSnippet(blocks);
    expect(snip).toMatch(/Journey \/ DAG/);
    expect(snip).toContain('leads to "Core"');
    expect(snip).toContain('locked until "Intro"');
  });

  it("composeAddBlockAtSlotSystemMessage switches for bridge intent", () => {
    const def = composeAddBlockAtSlotSystemMessage("default");
    const bridge = composeAddBlockAtSlotSystemMessage("bridge");
    expect(def).toMatch(/single learning block/i);
    expect(bridge).toMatch(/knowledge-bridge/i);
    expect(bridge).not.toEqual(def);
  });

  it("add-block-at-slot and generate_shape wire journey + bridge intent", () => {
    const add = read("app/api/workspace/add-block-at-slot/route.ts");
    const grid = readGridOpsSurface();
    const view = readWorkspaceViewSurface();
    expect(add).toContain("composeJourneyGraphPromptSnippet");
    expect(add).toContain("composeAddBlockAtSlotSystemMessage");
    expect(add).toContain("intent");
    expect(grid).toContain("composeJourneyGraphPromptSnippet");
    expect(view).toContain('intent: "bridge"');
  });

  it("AYCL reuses full WorkspaceView shell", () => {
    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("WorkspaceView");
    expect(aycl).toContain("ayclToken={accessToken}");
    expect(aycl).toContain("workspaceIdOverride");
    expect(aycl).toMatch(/clone|cloning/i);
    expect(aycl).toContain("ayclAccessTier");
  });
});
