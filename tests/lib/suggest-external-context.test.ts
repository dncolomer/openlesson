/**
 * Pure normalize/accept of xAI external-source suggestions + structural UI/API wire.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptExternalContextSuggestion,
  buildSuggestExternalContextMessages,
  externalSuggestionToContextOption,
  mergeAcceptedExternalIntoSelection,
  normalizeExternalContextSuggestions,
} from "@/lib/suggest-external-context";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.SUGGEST_EXTERNAL_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-eb20debe1998/implementer";

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

describe("normalizeExternalContextSuggestions", () => {
  it("requires valid URLs, de-dupes, and maps fields", () => {
    const raw = {
      suggestions: [
        {
          title: "MDN Array",
          url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
          description: "Array reference",
          rationale: "Core JS docs",
        },
        {
          title: "Dup",
          url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array",
        },
        { title: "Bad", url: "not-a-url" },
        { title: "No url" },
        {
          name: "Wikipedia",
          href: "https://en.wikipedia.org/wiki/JavaScript",
          summary: "Overview",
          why: "Background",
        },
      ],
    };
    const list = normalizeExternalContextSuggestions(raw);
    expect(list.length).toBe(2);
    expect(list[0].title).toBe("MDN Array");
    expect(list[0].url).toMatch(/^https:\/\//);
    expect(list[0].description).toMatch(/Array/);
    expect(list[0].rationale).toMatch(/Core/);
    expect(list[1].title).toBe("Wikipedia");

    expect(normalizeExternalContextSuggestions(null)).toEqual([]);
    expect(normalizeExternalContextSuggestions({ suggestions: "x" })).toEqual(
      [],
    );
    expect(normalizeExternalContextSuggestions([])).toEqual([]);

    writeEvidence(
      "suggest-external-context.log",
      [
        "normalizedN=" + list.length,
        "deduped=" + String(list.length === 2),
        "requiresUrl=" +
          String(
            normalizeExternalContextSuggestions([
              { title: "x", url: "ftp://nope" },
            ]).length === 0,
          ),
        "acceptOk=" +
          String(
            Boolean(
              acceptExternalContextSuggestion(list[0])?.createInput.url,
            ),
          ),
      ].join("\n"),
    );
  });

  it("accept + merge into selection uses external:id keys", () => {
    const suggestion = normalizeExternalContextSuggestions([
      {
        title: "Khan",
        url: "https://www.khanacademy.org/computing",
        description: "Computing courses",
      },
    ])[0];
    expect(suggestion).toBeTruthy();
    const prepared = acceptExternalContextSuggestion(suggestion)!;
    expect(prepared.createInput.source).toBe("create");
    expect(prepared.createInput.url).toMatch(/^https:\/\//);

    const merged = mergeAcceptedExternalIntoSelection({
      selectedKeys: [],
      options: [],
      resourceId: "ext-uuid-1",
      suggestion,
    });
    expect(merged.selectedKeys[0]).toBe("external:ext-uuid-1");
    expect(merged.options[0].kind).toBe("external");
    expect(merged.options[0].id).toBe("ext-uuid-1");
    expect(merged.options[0].url).toBe(suggestion.url);

    const opt = externalSuggestionToContextOption(suggestion, "id-2");
    expect(opt.key).toBe("external:id-2");

    const msgs = buildSuggestExternalContextMessages({
      topic: "Graph algorithms",
      workspaceTitle: "CS Map",
    });
    expect(msgs.system).toMatch(/JSON/);
    expect(msgs.user).toMatch(/Graph algorithms/);
  });
});

describe("structural: suggest external context UI + API", () => {
  it("Add + geometry panes mount suggest control; API uses xAI", () => {
    const add = read("components/WorkspaceAddBlockPane.tsx");
    const shape = read("components/WorkspaceGenerateShapePane.tsx");
    const widget = read("components/WorkspaceSuggestExternalContext.tsx");
    const route = read(
      "app/api/workspace/suggest-external-context/route.ts",
    );
    const pure = read("lib/suggest-external-context.ts");

    expect(widget).toContain("data-suggest-external-context");
    expect(widget).toContain("data-suggest-external-context-button");
    expect(widget).toContain("data-suggest-external-context-accept");
    expect(widget).toContain("/api/workspace/suggest-external-context");
    expect(widget).toContain("/api/workspace/external-resources");
    expect(widget).toContain("Suggest from web (xAI)");

    // Add pane: attach context inside Add drawer (no separate Local drawer)
    expect(add).toContain("WorkspaceSuggestExternalContext");
    expect(add).toContain("data-shape-context-picker");
    expect(add).toContain("data-add-block-context-picker");
    expect(add).not.toContain('drawerId="local"');
    // Generate-in-shape still mounts the picker + suggest widget
    expect(shape).toContain("WorkspaceSuggestExternalContext");
    expect(shape).toContain("data-shape-context-picker");

    expect(route).toContain("callXaiJSON");
    expect(route).toContain("from \"@/lib/xai-client\"");
    expect(route).toContain("normalizeExternalContextSuggestions");
    expect(route).toContain("buildSuggestExternalContextMessages");
    expect(route).not.toMatch(/openai|OpenAI/i);

    expect(pure).toContain("export function normalizeExternalContextSuggestions");
    expect(pure).toContain("export function acceptExternalContextSuggestion");
    expect(pure).toContain("export function mergeAcceptedExternalIntoSelection");

    writeEvidence(
      "suggest-external-ui.log",
      [
        "addHasPicker=" + add.includes("data-add-block-context-picker"),
        "addHasWidget=" + add.includes("WorkspaceSuggestExternalContext"),
        "shapeHasWidget=" + shape.includes("WorkspaceSuggestExternalContext"),
        "buttonHook=" + widget.includes("data-suggest-external-context-button"),
        "acceptHook=" + widget.includes("data-suggest-external-context-accept"),
        "callsSuggestApi=" +
          widget.includes("/api/workspace/suggest-external-context"),
        "callsExternalCreate=" +
          widget.includes("/api/workspace/external-resources"),
      ].join("\n"),
    );

    writeEvidence(
      "suggest-external-api.log",
      [
        "usesCallXaiJSON=" + route.includes("callXaiJSON"),
        "usesXaiClient=" + route.includes("@/lib/xai-client"),
        "normalizesPayload=" +
          route.includes("normalizeExternalContextSuggestions"),
        "emptySafe=" + pure.includes("return out"),
        "noOpenAI=" + String(!/openai/i.test(route)),
      ].join("\n"),
    );
  });
});
