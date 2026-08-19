import { readGridOpsSurface } from "@/tests/helpers/surface-source";
/**
 * External links: absorb into durable local notes + JIT URL bias for xAI prompts.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXTERNAL_ABSORB_MARKER,
  absorbExternalResourcesIntoLocalContext,
  buildExternalUrlJitBiasSnippet,
  formatAbsorbedExternalNoteBlock,
  localNotesContainExternalUrl,
  mergeAbsorbedExternalNotes,
} from "@/lib/workspace-external-resources";
import { shapeSelectionToLocalContext } from "@/lib/shape-context-select";
import { assemblePromptWorkspaceContext } from "@/lib/prompt-workspace-context";
import {
  acceptExternalContextSuggestion,
  externalSuggestionToContextOption,
} from "@/lib/suggest-external-context";
import { buildDomainExerciseAuthorUserPrompt } from "@/lib/pow-api/tapbench-exercise-generate";
import { resolveExercisePromptContext } from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.EXTERNAL_ABSORB_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b413fa687e2d/implementer";

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const fixtureLink = {
  id: "ext-1",
  title: "CDC PPV guide",
  url: "https://example.com/cdc-ppv",
  description: "Base rates and false positives for diagnostic tests",
};

describe("absorb external links into local notes (pure)", () => {
  it("formats a note block with title, URL, and summary", () => {
    const block = formatAbsorbedExternalNoteBlock(fixtureLink);
    expect(block).toBeTruthy();
    expect(block!).toContain(EXTERNAL_ABSORB_MARKER);
    expect(block!).toContain("CDC PPV guide");
    expect(block!).toContain("https://example.com/cdc-ppv");
    expect(block!).toMatch(/base rates|false positive/i);
    expect(formatAbsorbedExternalNoteBlock({ title: "x", url: "not-a-url" })).toBe(
      null,
    );
  });

  it("includes fetched link body Content when body is provided", () => {
    const body =
      "Positive predictive value depends on prevalence. At low base rates most positives are false positives.";
    const block = formatAbsorbedExternalNoteBlock({
      ...fixtureLink,
      body,
    });
    expect(block).toBeTruthy();
    expect(block!).toMatch(/Content:/i);
    expect(block!).toMatch(/Positive predictive value|prevalence/i);
    expect(block!).not.toMatch(/consult this URL for domain substance/i);
  });

  it("mergeAbsorbedExternalNotes appends without duplicating URLs", () => {
    const once = mergeAbsorbedExternalNotes("Prior local notes.", [fixtureLink]);
    expect(once).toMatch(/Prior local notes/);
    expect(once).toContain("https://example.com/cdc-ppv");
    const twice = mergeAbsorbedExternalNotes(once, [fixtureLink]);
    expect(twice).toBe(once);
    expect(localNotesContainExternalUrl(once, fixtureLink.url)).toBe(true);
  });

  it("absorbExternalResourcesIntoLocalContext writes notes + local_files + ids", () => {
    const absorbed = absorbExternalResourcesIntoLocalContext(
      { notes: "Existing author notes" },
      [fixtureLink],
    );
    expect(absorbed.notes).toMatch(/Existing author notes/);
    expect(absorbed.notes).toContain("https://example.com/cdc-ppv");
    expect(absorbed.notes).toContain(EXTERNAL_ABSORB_MARKER);
    expect(absorbed.local_files?.some((f) => f.name.startsWith("[external]"))).toBe(
      true,
    );
    expect(absorbed.external_resource_ids).toEqual(["ext-1"]);
    // Does not invent title/description for the block — only local materials
    expect(Object.keys(absorbed).sort()).toEqual(
      [
        "external_resource_ids",
        "global_file_refs",
        "local_files",
        "notes",
      ].sort(),
    );
  });

  it("shapeSelectionToLocalContext absorbs external URLs into notes (not ids only)", () => {
    const local = shapeSelectionToLocalContext(
      ["external:ext-1"],
      [
        {
          key: "external:ext-1",
          kind: "external",
          id: "ext-1",
          label: "CDC PPV guide",
          url: "https://example.com/cdc-ppv",
          excerpt: "URL: https://example.com/cdc-ppv\nBase rates walkthrough",
        },
      ],
    );
    expect(local).toBeTruthy();
    expect(local!.external_resource_ids).toContain("ext-1");
    expect(local!.notes).toContain("https://example.com/cdc-ppv");
    expect(local!.notes).toMatch(/CDC PPV|External source/i);
    expect(local!.local_files?.length).toBeGreaterThan(0);

    writeEvidence(
      "external-link-absorb-pure.log",
      [
        "=== absorbed notes ===",
        local!.notes || "",
        "",
        "=== local_files ===",
        JSON.stringify(local!.local_files, null, 2),
        "",
        "=== external_resource_ids ===",
        JSON.stringify(local!.external_resource_ids),
      ].join("\n"),
    );
  });
});

describe("JIT URL bias prompt snippet (pure)", () => {
  it("buildExternalUrlJitBiasSnippet lists URLs and consult instruction", () => {
    const snip = buildExternalUrlJitBiasSnippet([fixtureLink]);
    expect(snip).toBeTruthy();
    expect(snip!).toMatch(/consult|look into|just-in-time|just in time/i);
    expect(snip!).toContain("https://example.com/cdc-ppv");
    expect(snip!).toContain("CDC PPV guide");
  });

  it("assemblePromptWorkspaceContext injects JIT bias when external resources present", () => {
    const assembled = assemblePromptWorkspaceContext({
      workspaceTitle: "Clinic",
      workspaceGoal: "Update clinical beliefs",
      blockTitle: "PPV",
      blockDescription: "Predictive value basics",
      externalResources: [fixtureLink],
    });
    expect(assembled.contextBlock).toContain("https://example.com/cdc-ppv");
    expect(assembled.contextBlock).toMatch(
      /consult|look into|just-in-time|External URL resources/i,
    );
    expect(assembled.contextBlock).toMatch(/CDC PPV guide/);

    writeEvidence(
      "external-link-absorb-pure.log",
      [
        readFileSync(join(SCRATCH, "external-link-absorb-pure.log"), "utf8"),
        "",
        "=== JIT bias in contextBlock ===",
        assembled.contextBlock,
      ].join("\n"),
    );
  });

  it("acceptExternalContextSuggestion excerpt is absorbed note form", () => {
    const accepted = acceptExternalContextSuggestion({
      key: "suggest:https://example.com/x",
      title: "Example paper",
      url: "https://example.com/x",
      description: "Methods section",
      rationale: null,
    });
    expect(accepted).toBeTruthy();
    expect(accepted!.option.excerpt).toContain("https://example.com/x");
    expect(accepted!.option.excerpt).toMatch(/External source|URL:/i);

    const opt = externalSuggestionToContextOption(
      {
        key: "k",
        title: "Example paper",
        url: "https://example.com/x",
        description: "Methods",
        rationale: null,
      },
      "res-99",
    );
    expect(opt.excerpt).toContain("https://example.com/x");
    expect(opt.excerpt).toContain(EXTERNAL_ABSORB_MARKER);
  });
});

describe("structural wiring: attach + prompt assembly", () => {
  it("shape-context-select uses absorbExternalResourcesIntoLocalContext", () => {
    const src = read("lib/shape-context-select.ts");
    expect(src).toContain("absorbExternalResourcesIntoLocalContext");
    expect(src).toContain("externalLinks");
    expect(src).toContain("enrichSelectedOptionsWithFetchedLinkBodies");
    expect(src).toContain("enrichShapeOptionsWithLinkBodies");
  });

  it("create APIs fetch link bodies for selected externals", () => {
    const slot = read("app/api/workspace/add-block-at-slot/route.ts");
    const ops = readGridOpsSurface();
    const fetchLib = read("lib/fetch-link-body.ts");
    expect(fetchLib).toContain("export async function fetchLinkBodyText");
    expect(slot).toContain("fetchLinkBodyText");
    expect(slot).toContain("enrichSelectedOptionsWithFetchedLinkBodies");
    expect(ops).toContain("fetchLinkBodyText");
    expect(ops).toContain("enrichSelectedOptionsWithFetchedLinkBodies");
  });

  it("prompt-workspace-context injects buildExternalUrlJitBiasSnippet", () => {
    const src = read("lib/prompt-workspace-context.ts");
    expect(src).toContain("buildExternalUrlJitBiasSnippet");
    expect(src).toContain("jitBias");
    // Snippet body lives in workspace-external-resources
    const helpers = read("lib/workspace-external-resources.ts");
    expect(helpers).toContain("External URL resources");
    expect(helpers).toMatch(/consult|look into/i);
  });

  it("workspace-external-resources exports absorb + JIT helpers", () => {
    const src = read("lib/workspace-external-resources.ts");
    expect(src).toContain("formatAbsorbedExternalNoteBlock");
    expect(src).toContain("mergeAbsorbedExternalNotes");
    expect(src).toContain("absorbExternalResourcesIntoLocalContext");
    expect(src).toContain("buildExternalUrlJitBiasSnippet");
    expect(src).toContain("EXTERNAL_ABSORB_MARKER");
  });

  it("suggest-external-context writes absorbed excerpts", () => {
    const src = read("lib/suggest-external-context.ts");
    expect(src).toContain("formatAbsorbedExternalNoteBlock");
  });

  it("buildDomainExerciseAuthorUserPrompt includes JIT bias when externalResources set", () => {
    const prompt = buildDomainExerciseAuthorUserPrompt({
      workspaceTitle: "Clinic",
      workspaceGoal: "Update clinical beliefs",
      blockTitle: "PPV",
      blockDescription: "Predictive value basics",
      externalResources: [fixtureLink],
      surface: "tap_exercise",
    });
    expect(prompt).toContain("https://example.com/cdc-ppv");
    expect(prompt).toMatch(
      /consult|look into|just-in-time|External URL resources/i,
    );
    expect(prompt).toContain("CDC PPV guide");
  });

  it("resolveExercisePromptContext forwards externalResources into assemble", () => {
    const ctx = resolveExercisePromptContext({
      workspaceTitle: "Clinic",
      blockTitle: "PPV",
      externalResources: [fixtureLink],
    });
    expect(ctx.contextBlock).toContain("https://example.com/cdc-ppv");
    expect(ctx.contextBlock).toMatch(
      /consult|look into|just-in-time|External URL resources/i,
    );
  });

  it("generate-exercise + tapbench-links routes pass externalResources from hydrate", () => {
    const gen = read("app/api/generate-exercise/route.ts");
    expect(gen).toContain("externalResources");
    expect(gen).toMatch(/hydrated\?\.externalResources|externalResources:\s*hydrated/);
    const tap = read("app/api/workspace/tapbench-links/route.ts");
    expect(tap).toContain("externalResources");
    expect(tap).toMatch(/promptCtx\.externalResources|externalResources:\s*promptCtx/);
    const domain = read("lib/pow-api/tapbench-exercise-generate.ts");
    expect(domain).toContain("externalResources: input.externalResources");
    const exercise = read("lib/exercise-tap.ts");
    expect(exercise).toContain(
      "externalResources: input.externalResources ?? base.externalResources",
    );
  });
});
