/**
 * Generate-in-shape context selection: pure map to local_context + generation snippet.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
  toggleShapeContextSelection,
} from "@/lib/shape-context-select";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.SHAPE_CONTEXT_SCRATCH ||
  process.env.SINGLE_EMPTY_ADD_CONTEXT_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d44762646fb6/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

const catalog = {
  notes: "Study Bayesian inference carefully.",
  files: [
    { id: "f1", file_name: "bayes.pdf", excerpt: "Bayes theorem notes" },
    { id: "f2", file_name: "prior.md" },
  ],
  externalResources: [
    {
      id: "e1",
      title: "Wikipedia Bayes",
      url: "https://en.wikipedia.org/wiki/Bayes%27_theorem",
      description: "Overview article",
    },
  ],
};

describe("buildShapeContextSourceOptions + toggle", () => {
  it("lists external, notes, files and toggles multi-select", () => {
    const opts = buildShapeContextSourceOptions(catalog);
    expect(opts.some((o) => o.kind === "external")).toBe(true);
    expect(opts.some((o) => o.kind === "notes")).toBe(true);
    expect(opts.some((o) => o.kind === "file" && o.fileName === "bayes.pdf")).toBe(true);
    // external before notes before files
    const kinds = opts.map((o) => o.kind);
    expect(kinds.indexOf("external")).toBeLessThan(kinds.indexOf("notes"));
    expect(kinds.indexOf("notes")).toBeLessThan(kinds.indexOf("file"));

    let sel: string[] = [];
    sel = toggleShapeContextSelection(sel, "file:bayes.pdf");
    sel = toggleShapeContextSelection(sel, "external:e1");
    expect(sel).toEqual(["file:bayes.pdf", "external:e1"]);
    sel = toggleShapeContextSelection(sel, "file:bayes.pdf");
    expect(sel).toEqual(["external:e1"]);
  });
});

describe("shapeSelectionToLocalContext", () => {
  it("maps files only, external only, mixed, empty", () => {
    const opts = buildShapeContextSourceOptions(catalog);

    expect(shapeSelectionToLocalContext([], opts)).toBeNull();

    const filesOnly = shapeSelectionToLocalContext(["file:bayes.pdf", "file:prior.md"], opts);
    expect(filesOnly?.global_file_refs).toEqual(["bayes.pdf", "prior.md"]);
    expect(filesOnly?.notes).toBeNull();
    expect(filesOnly?.local_files).toBeNull();

    const extOnly = shapeSelectionToLocalContext(["external:e1"], opts);
    expect(extOnly?.external_resource_ids).toEqual(["e1"]);
    expect(extOnly?.local_files?.some((f) => /Wikipedia/i.test(f.name))).toBe(true);

    const mixed = shapeSelectionToLocalContext(
      ["notes", "file:bayes.pdf", "external:e1"],
      opts,
    );
    expect(mixed?.notes).toMatch(/Bayesian/i);
    expect(mixed?.global_file_refs).toContain("bayes.pdf");
    expect(mixed?.external_resource_ids).toContain("e1");

    const norm = normalizeBlockLocalContext(mixed);
    expect(norm.hasLocalMaterials).toBe(true);

    writeEvidence(
      "shape-context-select-rules.log",
      [
        "empty=" + String(shapeSelectionToLocalContext([], opts)),
        "filesOnly=" + JSON.stringify(filesOnly),
        "extOnly=" + JSON.stringify(extOnly),
        "mixedNotes=" + Boolean(mixed?.notes),
        "mixedFiles=" + (mixed?.global_file_refs || []).join(","),
        "mixedExt=" + (mixed?.external_resource_ids || []).join(","),
      ].join("\n"),
    );
  });
});

describe("shapeSelectionToGenerationSnippet + compose", () => {
  it("folds selected materials into generation context", () => {
    const opts = buildShapeContextSourceOptions(catalog);
    const snippet = shapeSelectionToGenerationSnippet(
      ["file:bayes.pdf", "external:e1", "notes"],
      opts,
    );
    expect(snippet).toMatch(/bayes\.pdf/i);
    expect(snippet).toMatch(/Wikipedia/i);
    expect(snippet).toMatch(/notes/i);

    const composed = composeShapeGenerationContext({
      baseContext: "Workspace: Stats\nGoal: Learn Bayes",
      selectedSnippet: snippet,
    });
    expect(composed).toMatch(/Workspace: Stats/);
    expect(composed).toMatch(/Primary generation source|Selected context sources/i);
    expect(composeShapeGenerationContext({ baseContext: "base", selectedSnippet: "" })).toBe(
      "base",
    );
  });
});

describe("structural: dialog + grid-ops wire selection → local_context + prompt", () => {
  it("BlockSkillGrid picker and generate_shape payload; grid-ops persists local_context", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("data-shape-context-picker");
    expect(grid).toContain("data-shape-context-list");
    expect(grid).toContain("contextSourceKeys");
    expect(grid).toContain("toggleShapeContextSelection");
    expect(grid).toContain("buildShapeContextSourceOptions");

    const ops = read("app/api/workspace/grid-ops/route.ts");
    expect(ops).toContain("contextSourceKeys");
    expect(ops).toContain("shapeSelectionToLocalContext");
    expect(ops).toContain("shapeSelectionToGenerationSnippet");
    expect(ops).toContain("selectedMaterialsSnippet");
    expect(ops).toContain("local_context");
    expect(ops).toContain("composeShapeGenerationContext");

    const prompt = read("lib/block-footprint-prompt.ts");
    expect(prompt).toContain("selectedMaterialsSnippet");

    writeEvidence(
      "shape-context-wire.log",
      [
        "picker=" + grid.includes("data-shape-context-picker"),
        "payloadKeys=" + grid.includes("contextSourceKeys"),
        "opsLocalContext=" + ops.includes("local_context"),
        "opsSnippet=" + ops.includes("shapeSelectionToGenerationSnippet"),
        "promptField=" + prompt.includes("selectedMaterialsSnippet"),
      ].join("\n"),
    );
  });

  it("single-empty Add pane mounts context picker and submit sends contextSourceKeys; API persists local_context", () => {
    const pane = read("components/WorkspaceAddBlockPane.tsx");
    expect(pane).toContain("data-workspace-add-block-pane");
    expect(pane).toContain("data-shape-context-picker");
    expect(pane).toContain("data-add-block-context-picker");
    expect(pane).toContain("data-shape-context-list");
    expect(pane).toContain("toggleShapeContextSelection");
    expect(pane).toContain("buildShapeContextSourceOptions");
    expect(pane).toContain("contextSourceKeys");
    // Local context is a top-level drawer section, collapsed by default
    expect(pane).toContain('title="Local context"');
    expect(pane).toContain("defaultExpanded={false}");
    // Submit passes selected keys (not prompt-only)
    expect(pane).toMatch(/onSubmit\([\s\S]*contextSourceKeys/);

    const slot = read("app/api/workspace/add-block-at-slot/route.ts");
    expect(slot).toContain("contextSourceKeys");
    expect(slot).toContain("shapeSelectionToLocalContext");
    expect(slot).toContain("shapeSelectionToGenerationSnippet");
    expect(slot).toContain("local_context");
    expect(slot).toContain("composeShapeGenerationContext");

    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain("contextSourceKeys");
    expect(view).toContain("WorkspaceAddBlockPane");
    expect(view).toContain("workspaceNotes=");

    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("contextSourceKeys");
    expect(aycl).toContain("WorkspaceAddBlockPane");

    // Shared pure path still maps selection → local_context
    const opts = buildShapeContextSourceOptions(catalog);
    const mapped = shapeSelectionToLocalContext(["file:bayes.pdf", "notes"], opts);
    expect(mapped?.global_file_refs).toContain("bayes.pdf");
    expect(mapped?.notes).toMatch(/Bayesian/i);

    writeEvidence(
      "single-empty-add-context-ui.log",
      [
        "panePicker=" + pane.includes("data-add-block-context-picker"),
        "paneShapePicker=" + pane.includes("data-shape-context-picker"),
        "paneSubmitKeys=" + /contextSourceKeys/.test(pane),
        "slotLocalContext=" + slot.includes("shapeSelectionToLocalContext"),
        "slotInsertLocal=" + slot.includes("local_context"),
        "viewKeys=" + view.includes("contextSourceKeys"),
        "mappedFiles=" + (mapped?.global_file_refs || []).join(","),
      ].join("\n"),
    );
  });
});
