/**
 * FEP public surfaces must use generative model / hidden state / state factor /
 * observation / action / policy. Product metaphors (map, object) fail this test.
 *
 * To add a new explainer, append it to FEP_PUBLIC_SURFACE_FILES.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FEP_CONCEPT_NAMES,
  FEP_PUBLIC_SURFACE_FILES,
  LEARNING_MODEL_OBJECTS,
  fepPublicCopyViolations,
} from "@/lib/learning-model";
import { LEARNING_MODEL_SIZE_COPY } from "@/lib/learning-model/action-catalog";
import {
  SCIENCE_HUB_COPY,
  SCIENCE_HUB_DIRECTORY,
  HARNESS_THESIS_LINKS,
  HARNESS_PRICING_THESIS_LINKS,
} from "@/lib/science/hub";
import {
  SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES,
  SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS,
  SCIENCE_LEARNING_MODEL_COPY,
  getScienceLearningModelFullText,
} from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function visitorText(source: string): string[] {
  const stripped = stripComments(source);
  const quoted = [...stripped.matchAll(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g)].map((m) =>
    m[0].slice(1, -1),
  );
  const jsx = [...stripped.matchAll(/>([^<>{}]+)</g)]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...quoted, ...jsx];
}

describe("FEP public vocabulary", () => {
  it("flags the banned metaphors on a fixture string", () => {
    const banned = ["m", "ap"].join("");
    expect(fepPublicCopyViolations(`the ${banned} of a concept`)).toEqual([
      `${banned} (use generative model)`,
    ]);
    expect(fepPublicCopyViolations("a Concept on the generative model")).toEqual([]);
  });

  it("keeps the six FEP Concept names", () => {
    expect([...FEP_CONCEPT_NAMES]).toEqual([
      "generative model",
      "hidden state",
      "state factor",
      "observation",
      "action",
      "policy",
    ]);
    expect(LEARNING_MODEL_OBJECTS.map((row) => row.name.toLowerCase())).toEqual([
      ...FEP_CONCEPT_NAMES,
    ]);
  });

  it("assembled explainer copy has no banned metaphors", () => {
    const blobs = [
      getScienceLearningModelFullText(),
      ...Object.values(SCIENCE_LEARNING_MODEL_COPY),
      ...Object.values(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS),
      ...Object.values(SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES),
      ...LEARNING_MODEL_OBJECTS.map((row) => `${row.name} ${row.meaning}`),
      ...Object.values(LEARNING_MODEL_SIZE_COPY).map((row) => `${row.title} ${row.body}`),
      SCIENCE_HUB_COPY.directoryLead,
      ...SCIENCE_HUB_DIRECTORY.map((row) => `${row.label} ${row.hint}`),
      ...HARNESS_THESIS_LINKS.map((row) => `${row.label} ${row.hint}`),
      ...HARNESS_PRICING_THESIS_LINKS.map((row) => `${row.label} ${row.hint}`),
    ];
    for (const blob of blobs) {
      expect(fepPublicCopyViolations(blob), blob.slice(0, 120)).toEqual([]);
      expect(blob, blob.slice(0, 120)).not.toMatch(/is not the cause/i);
      expect(blob, blob.slice(0, 120)).not.toMatch(/were the cause/i);
      expect(blob, blob.slice(0, 120)).not.toMatch(/inferred hidden cause/i);
      expect(blob, blob.slice(0, 120)).not.toMatch(/\boccupying\b/i);
    }
  });

  it("quoted and JSX visitor strings on FEP surfaces have no banned metaphors", () => {
    for (const rel of FEP_PUBLIC_SURFACE_FILES) {
      const chunks = visitorText(readFileSync(join(ROOT, rel), "utf8"));
      for (const chunk of chunks) {
        expect(fepPublicCopyViolations(chunk), `${rel}: ${chunk.slice(0, 120)}`).toEqual([]);
        expect(chunk, `${rel}: ${chunk.slice(0, 120)}`).not.toMatch(/is not the cause/i);
        expect(chunk, `${rel}: ${chunk.slice(0, 120)}`).not.toMatch(/were the cause/i);
        expect(chunk, `${rel}: ${chunk.slice(0, 120)}`).not.toMatch(/inferred hidden cause/i);
        expect(chunk, `${rel}: ${chunk.slice(0, 120)}`).not.toMatch(/\boccupying\b/i);
      }
    }
  });
});
