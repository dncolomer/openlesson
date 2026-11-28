import {
  readGridOpsSurface,
  readMapGridSurface,
  readWorkspaceViewSurface,
} from "@/tests/helpers/surface-source";
/**
 * Generate-in-shape context selection: pure map to local_context + generation snippet.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  enrichSelectedOptionsWithFetchedLinkBodies,
  enrichShapeOptionsWithLinkBodies,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
  toggleShapeContextSelection,
} from "@/lib/shape-context-select";
import {
  htmlToPlainText,
  normalizeLinkBodyText,
} from "@/lib/workspace-external-resources";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import { tmpdir } from "node:os";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.SHAPE_CONTEXT_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-b413fa687e2d/implementer");

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

describe("link body enrichment for generation (pure)", () => {
  it("htmlToPlainText + normalizeLinkBodyText extract substance from HTML", () => {
    const html = `
      <html><head><style>.x{color:red}</style><script>evil()</script></head>
      <body><main><h1>Bayes theorem</h1><p>Posterior odds equal prior odds times likelihood ratio.</p></main></body>
    `;
    const plain = htmlToPlainText(html);
    expect(plain).toMatch(/Bayes theorem/i);
    expect(plain).toMatch(/Posterior odds/i);
    expect(plain).not.toMatch(/evil|color:red/i);
    const norm = normalizeLinkBodyText(html);
    expect(norm).toMatch(/Posterior odds/i);
  });

  it("enrichShapeOptionsWithLinkBodies puts Content body into generation snippet + local_context", () => {
    const opts = buildShapeContextSourceOptions(catalog);
    const url = "https://en.wikipedia.org/wiki/Bayes%27_theorem";
    const body =
      "The posterior probability of a hypothesis is proportional to the prior times the likelihood. " +
      "This is the quantitative backbone of Bayesian updating in clinical diagnosis and A/B tests.";
    const enriched = enrichShapeOptionsWithLinkBodies(
      opts,
      ["external:e1", "notes", "file:bayes.pdf"],
      { [url]: body },
    );
    const snippet = shapeSelectionToGenerationSnippet(
      ["external:e1", "notes", "file:bayes.pdf"],
      enriched,
    );
    expect(snippet).toMatch(/Content:|posterior probability|Bayesian updating/i);
    expect(snippet).toMatch(/Study Bayesian inference/i);
    expect(snippet).toMatch(/bayes\.pdf/i);

    const local = shapeSelectionToLocalContext(
      ["external:e1", "notes", "file:bayes.pdf"],
      enriched,
    );
    expect(local).toBeTruthy();
    expect(local!.notes).toMatch(/posterior probability|Bayesian updating|Content:/i);
    expect(local!.external_resource_ids).toContain("e1");
    expect(local!.global_file_refs).toContain("bayes.pdf");

    writeEvidence(
      "attach-context-generation.log",
      [
        "=== snippet ===",
        snippet,
        "",
        "=== local notes ===",
        local!.notes || "",
        "",
        "=== local_files ===",
        JSON.stringify(local!.local_files, null, 2),
      ].join("\n"),
    );
  });

  it("enrichSelectedOptionsWithFetchedLinkBodies uses injectable fetchBody", async () => {
    const opts = buildShapeContextSourceOptions(catalog);
    const url = "https://en.wikipedia.org/wiki/Bayes%27_theorem";
    const { options, fetchedCount } = await enrichSelectedOptionsWithFetchedLinkBodies({
      selectedKeys: ["external:e1"],
      options: opts,
      fetchBody: async (u) => {
        expect(u).toBe(url);
        return `<html><body><article><p>Likelihood ratios turn priors into posteriors for real.</p></article></body></html>`;
      },
    });
    expect(fetchedCount).toBe(1);
    const snippet = shapeSelectionToGenerationSnippet(["external:e1"], options);
    expect(snippet).toMatch(/Likelihood ratios|posteriors/i);
    // Failed fetch degrades without throwing
    const empty = await enrichSelectedOptionsWithFetchedLinkBodies({
      selectedKeys: ["external:e1"],
      options: opts,
      fetchBody: async () => null,
    });
    expect(empty.fetchedCount).toBe(0);
    const thin = shapeSelectionToGenerationSnippet(["external:e1"], empty.options);
    expect(thin).toMatch(/Wikipedia|Overview/i);
  });
});
