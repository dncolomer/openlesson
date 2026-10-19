/**
 * Helios unsys seed chat: tools apply on the shipped editor units.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyAuthorUnsysHeliosTools,
  AUTHOR_UNSYS_HELIOS_OPENING,
  AUTHOR_UNSYS_HELIOS_TOOL_IDS,
  authorUnsysHeliosSelectionContext,
  formatAuthorUnsysSeedForPrompt,
  formatAuthorUnsysSelectionForPrompt,
  parseAuthorUnsysHeliosChatTurn,
} from "@/lib/author-unsys-helios";
import { exampleAuthorUnsysModel } from "@/lib/author-unsys-model";
import { sessionBranchById } from "@/lib/session-branch-model";
import { buildHeliosUnsysSeedSystemPrompt } from "@/lib/prompt-kernel";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("Helios unsys seed helper", () => {
  it("parses a chat turn and applies edge price, branch, and edit tools", () => {
    const base = exampleAuthorUnsysModel("Just war");
    const prompt = formatAuthorUnsysSeedForPrompt({
      blockTitle: "Just war",
      model: base,
      focusId: "root",
    });
    expect(prompt).toContain("CURRENT SEED");
    expect(prompt).not.toContain("Catalog:");
    expect(prompt).toContain("r1");
    expect(prompt).toMatch(/r1=/);
    expect(formatAuthorUnsysSelectionForPrompt({ model: base, focusId: "r1" })).toContain(
      "SELECTED NODE",
    );
    expect(authorUnsysHeliosSelectionContext(base, "r1").active).toBe(true);
    expect(authorUnsysHeliosSelectionContext(null).summary).toBe("No node selected");
    expect(
      formatAuthorUnsysSeedForPrompt({
        blockTitle: "Just war",
        model: null,
      }),
    ).toContain("No graph yet");

    const turn = parseAuthorUnsysHeliosChatTurn({
      reply: "The edge into region 1 is cheaper.",
      tool_calls: [
        {
          name: "set_edge_price",
          arguments: { fromId: "root", toId: "r1", price: 5 },
        },
        {
          name: "add_branch",
          arguments: { parentId: "root", title: "Misconception" },
        },
      ],
    });
    expect(turn.reply).toContain("region 1");
    expect(turn.toolCalls.map((call) => call.name)).toEqual([
      "set_edge_price",
      "add_branch",
    ]);

    const applied = applyAuthorUnsysHeliosTools({
      model: base,
      focusId: "root",
      calls: turn.toolCalls,
    });
    expect(
      sessionBranchById(applied.model, "root")?.edges.find((row) => row.toId === "r1")
        ?.price,
    ).toBe(5);
    const added = applied.model.branches.find((row) => row.title === "Misconception");
    expect(added).toBeTruthy();
    expect(applied.focusId).toBe(added!.id);
    expect(applied.steps.every((step) => step.ok)).toBe(true);

    const edited = applyAuthorUnsysHeliosTools({
      model: applied.model,
      focusId: applied.focusId,
      calls: [
        {
          name: "edit_branch",
          args: { branchId: added!.id, title: "Misread", question: "What broke?" },
        },
        { name: "remove_branch", args: { branchId: added!.id } },
        { name: "generate_sample", args: {} },
      ],
    });
    expect(sessionBranchById(edited.model, added!.id)).toBeNull();
    expect(edited.steps.find((step) => step.name === "edit_branch")?.ok).toBe(true);
    expect(edited.steps.find((step) => step.name === "remove_branch")?.ok).toBe(true);
    expect(edited.steps.find((step) => step.name === "generate_sample")?.ok).toBe(false);

    const promptText = buildHeliosUnsysSeedSystemPrompt();
    expect(promptText).toContain("set_edge_price");
    expect(promptText).toContain("add_branch");
    expect(promptText).not.toContain("set_catalog");
    expect(promptText).toContain("generate_sample");
    expect(promptText).toContain("generate_deeper");
    expect(promptText).toContain("SELECTED NODE");
    expect(promptText).toContain(AUTHOR_UNSYS_HELIOS_OPENING);
    expect(AUTHOR_UNSYS_HELIOS_OPENING).not.toMatch(/\bprior\b/i);
    for (const id of AUTHOR_UNSYS_HELIOS_TOOL_IDS) {
      expect(promptText).toContain(id);
    }

    const panel = read("components/WorkspaceBlockUnsysModelPanel.tsx");
    const studio = read("components/WorkspaceUnsysSeedStudio.tsx");
    const chat = read("components/WorkspaceBlockUnsysHeliosChat.tsx");
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    const route = read("app/api/workspace/helios-unsys-seed-chat/route.ts");
    const mapChat = read("components/WorkspaceHeliosChat.tsx");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");

    expect(panel).not.toContain("WorkspaceBlockUnsysHeliosChat");
    expect(studio).toContain("WorkspaceBlockUnsysHeliosChat");
    expect(chat).toContain("data-author-unsys-helios-chat");
    expect(chat).toMatch(
      /data-author-unsys-helios-chat-mic[\s\S]*data-author-unsys-helios-chat-send/,
    );
    expect(chat).toContain("data-author-unsys-helios-selection");
    expect(chat).toContain("onGenerateGraph");
    expect(chat).toContain("isAuthorUnsysHeliosHostTool");
    expect(chat).toContain("/api/workspace/helios-unsys-seed-chat");
    expect(chat).toContain("applyAuthorUnsysHeliosTools");
    expect(chat).not.toMatch(/\bprior\b/i);
    expect(detail).toContain("workspaceId={workspaceId}");
    expect(route).toContain("buildHeliosUnsysSeedSystemPrompt");
    expect(route).toContain("callXaiJSON");
    expect(route).toContain("seedModel");
    expect(route).toContain("formatAuthorUnsysSelectionForPrompt");
    expect(route).toContain("parseAuthorUnsysHeliosChatTurn");
    expect(mapChat).not.toContain("helios-unsys-seed-chat");
    expect(learner).not.toContain("WorkspaceBlockUnsysHeliosChat");

    writeEvidence(
      "author-unsys-helios.log",
      [
        `reply=${turn.reply}`,
        `edgePrice=${sessionBranchById(applied.model, "root")?.edges.find((row) => row.toId === "r1")?.price}`,
        `added=${added?.title}`,
        `route=${route.includes("buildHeliosUnsysSeedSystemPrompt")}`,
        `micThenSend=${/data-author-unsys-helios-chat-mic[\s\S]*data-author-unsys-helios-chat-send/.test(chat)}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-unsys-helios.log"))).toBe(true);
  });
});
