import { describe, expect, it } from "vitest";
import {
  composeDantesResourceContext,
  composeTemplateCreatePrompt,
  templateDantesContextForPrompt,
} from "@/lib/workspace-create-modes";
import { applyGeneratedMapTypePlacement } from "@/lib/workspace-spatial-create";
import { INITIAL_CHAPTERS_BANDS } from "@/lib/initial-chapters";
import {
  blockedCellsFromMapType,
  formatMapTypeGeneratorContext,
  mapTypeSkeletonFrame,
  resolveMapTypeRecord,
} from "@/lib/workspace-map-types";

describe("template workspace prompt uses map-type generator context", () => {
  it("includes a goal and an uploaded file name when no Dantes resources are selected", () => {
    const goal = "Prove the mean value theorem from first principles";
    const prompt = composeTemplateCreatePrompt({
      topicName: "Own notes",
      dantesContext: "",
      goal,
      fileNames: ["lecture-notes.pdf"],
      initialChapters: "hub",
    });
    expect(prompt).toContain(goal);
    expect(prompt).toContain("lecture-notes.pdf");
    expect(prompt).not.toMatch(/Curated resources used as generation context/);
  });

  it("does not tell a goal or file create to use the topic name alone, and still keeps Dantes titles", () => {
    const goal = "Prove the mean value theorem from first principles";
    const fileNames = ["lecture-notes.pdf"];
    const ownMaterial = templateDantesContextForPrompt({
      topicName: "lecture-notes.pdf",
      resources: [],
      goal,
      fileNames,
    });
    expect(ownMaterial).not.toMatch(/use the topic name alone/i);
    const ownPrompt = composeTemplateCreatePrompt({
      topicName: "lecture-notes.pdf",
      dantesContext: ownMaterial,
      goal,
      fileNames,
      initialChapters: "hub",
    });
    expect(ownPrompt).toContain(goal);
    expect(ownPrompt).toContain("lecture-notes.pdf");
    expect(ownPrompt).not.toMatch(/use the topic name alone/i);

    const titled = templateDantesContextForPrompt({
      topicName: "Real Analysis",
      resources: [{ title: "Abbott Understanding Analysis", type: "book" }],
      goal: "Connect the lectures to a proof practice",
      fileNames: ["notes.pdf"],
    });
    expect(titled).toContain("Abbott Understanding Analysis");
    expect(titled).not.toMatch(/use the topic name alone/i);
    const titledPrompt = composeTemplateCreatePrompt({
      topicName: "Real Analysis",
      dantesContext: titled,
      goal: "Connect the lectures to a proof practice",
      fileNames: ["notes.pdf"],
      initialChapters: "islands",
    });
    expect(titledPrompt).toContain("Abbott Understanding Analysis");
    expect(titledPrompt).toContain("notes.pdf");
    expect(titledPrompt).not.toMatch(/use the topic name alone/i);

    const topicOnly = templateDantesContextForPrompt({
      topicName: "Linear Algebra",
      resources: [],
    });
    expect(topicOnly).toMatch(/use the topic name alone/i);
  });

  it("keeps Dantes titles in the prompt when a goal is also provided", () => {
    const goal = "Connect the lectures to a proof practice";
    const dantes = composeDantesResourceContext("Real Analysis", [
      { title: "Abbott Understanding Analysis", type: "book" },
      { title: "Tao Analysis I", type: "book", url: "https://example.com/tao" },
    ]);
    const prompt = composeTemplateCreatePrompt({
      topicName: "Real Analysis",
      dantesContext: dantes,
      goal,
      initialChapters: "islands",
    });
    expect(prompt).toContain(goal);
    expect(prompt).toContain("Abbott Understanding Analysis");
    expect(prompt).toContain("Tao Analysis I");
  });

  it("fills a shaped default map type from generator context instead of four-quadrant scatter", () => {
    const record = resolveMapTypeRecord("hub");
    const ctx = formatMapTypeGeneratorContext(record);
    const prompt = composeTemplateCreatePrompt({
      topicName: "Schemas",
      dantesContext: "",
      initialChapters: "hub",
    });
    expect(prompt).toContain(ctx.countInstruction);
    expect(prompt).toContain(ctx.spatialInstruction);
    expect(prompt).toMatch(/SPAWN SKELETON/i);
    expect(prompt).toMatch(/BLOCKED CHAPTER SLOTS/i);
    expect(prompt).toMatch(/SUPERSEDES|TOPOLOGY FIDELITY|80%/i);
    expect(ctx.spawnInstruction.length).toBeGreaterThan(0);
    expect(prompt).toContain(ctx.spawnInstruction);
    expect(prompt).not.toMatch(/Place nodes across positive AND negative/i);
    expect(prompt).not.toContain("Exactly one is_start: true node, at (0, 0)");
  });

  it("keeps generic spatial rules and the scatter count target", () => {
    const record = resolveMapTypeRecord("random_sparse");
    const ctx = formatMapTypeGeneratorContext(record);
    const prompt = composeTemplateCreatePrompt({
      topicName: "Light survey",
      dantesContext: "",
      initialChapters: "random_sparse",
    });
    expect(prompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_sparse.target));
    expect(prompt).toContain(ctx.spatialInstruction);
    expect(prompt).toMatch(/Place nodes across positive AND negative/i);
    expect(prompt).toMatch(/position_x=0/);
  });
});

describe("workspace generate post-process matches chapter map-type placement", () => {
  it("moves a blocked hub cell off the slot and pulls an out-of-frame cell inside", () => {
    const hub = resolveMapTypeRecord("hub");
    const blocked = blockedCellsFromMapType(hub);
    expect(blocked.length).toBeGreaterThan(0);
    const blockedCell = blocked[0]!;
    const frame = mapTypeSkeletonFrame(hub, 2);
    expect(frame).not.toBeNull();
    const placed = applyGeneratedMapTypePlacement(
      [
        { position_x: blockedCell.col, position_y: blockedCell.row, id: "blocked" },
        { position_x: 40, position_y: -30, id: "far" },
      ],
      hub,
    );
    const blockedKeys = new Set(blocked.map((cell) => `${cell.row}:${cell.col}`));
    for (const item of placed) {
      expect(blockedKeys.has(`${item.position_y}:${item.position_x}`)).toBe(false);
    }
    const far = placed.find((item) => item.id === "far");
    expect(far?.position_x).toBeGreaterThanOrEqual(frame!.minCol);
    expect(far?.position_x).toBeLessThanOrEqual(frame!.maxCol);
    expect(far?.position_y).toBeGreaterThanOrEqual(frame!.minRow);
    expect(far?.position_y).toBeLessThanOrEqual(frame!.maxRow);
    expect(far?.position_x === 40 && far?.position_y === -30).toBe(false);
  });
});
