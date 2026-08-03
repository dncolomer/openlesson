/**
 * parseJsonLoose must recover common model JSON shapes (fences, prose wrap,
 * truncated objects) so callXaiJSON does not fail the Simulation tab.
 */
import { describe, expect, it } from "vitest";
import { parseJsonLoose } from "@/lib/xai-client";

describe("parseJsonLoose", () => {
  it("parses clean JSON objects", () => {
    const r = parseJsonLoose<{ questions: string[] }>('{"questions":["a"]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.questions).toEqual(["a"]);
  });

  it("strips markdown fences around JSON", () => {
    const raw = 'Here you go:\n```json\n{"questions":["What is PPV?"],"exercises":["Compute LR+"]}\n```\n';
    const r = parseJsonLoose<{ questions: string[]; exercises: string[] }>(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.questions[0]).toMatch(/PPV/);
      expect(r.data.exercises[0]).toMatch(/LR/);
    }
  });

  it("extracts first object when model adds prose", () => {
    const raw =
      'Sure — samples below.\n{"topics":["Bayes"],"questions":["Q1 about prevalence?"],"exercises":["Ex1 compute PPV"]}\nHope that helps!';
    const r = parseJsonLoose<{ topics: string[]; questions: string[] }>(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.topics).toEqual(["Bayes"]);
      expect(r.data.questions[0]).toMatch(/prevalence/i);
    }
  });

  it("repairs truncated object by closing braces/brackets", () => {
    // Model cut off mid-array (common with low max_tokens)
    const raw =
      '{"questions":["What is sensitivity?","Define specificity?"],"exercises":["Compute PPV for';
    const r = parseJsonLoose<{ questions: string[]; exercises: string[] }>(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.questions.length).toBe(2);
      expect(Array.isArray(r.data.exercises)).toBe(true);
    }
  });

  it("returns ok:false for non-JSON garbage", () => {
    const r = parseJsonLoose("not json at all, just prose about algebra");
    expect(r.ok).toBe(false);
  });
});
