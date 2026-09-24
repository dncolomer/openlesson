/**
 * /science principles 01–04: one shared grid, lighter cells, same copy and order.
 * Reads the shipped page source. Does not reimplement the layout.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

const PRINCIPLE_COPY = [
  {
    number: "01",
    title: "Knowledge Configuration",
    subtitle: "The full physical state of a human brain at a specific point in time.",
    body: "Every moment of thought, memory, and skill lives in a unique configuration of neural activity. Understanding learning means understanding how one configuration relates to another — not just what was answered on a test.",
  },
  {
    number: "02",
    title: "Knowledge = Proximity",
    subtitle: "A useful configuration is close enough to retrieve, apply, and transform.",
    body: "Knowledge is not a binary flag. It is how near your current brain state is to a configuration where you can reliably retrieve, apply, and transform what you need. Closeness — not completion percentage — is the meaningful signal.",
  },
  {
    number: "03",
    title: "Learning = Transformation",
    subtitle: "Learning is movement through configuration space, ideally with less wasted effort.",
    body: "To learn is to move from one configuration toward another useful one. The goal of educational technology should be to shorten that path — reducing wasted effort while preserving depth of understanding.",
  },
  {
    number: "04",
    title: "Non-Invasive Path",
    subtitle: "Start with software attention loops, then add world models, stimulation, and biofeedback.",
    body: "We begin with software: attention loops, Socratic questioning, and proof-of-work verification. Over time we layer world models, non-invasive stimulation, and biofeedback — building toward self-driving learning without asking humans to burn proportionally more energy.",
  },
] as const;

function classTokens(tag: string): string[] {
  const match = tag.match(/className="([^"]*)"/);
  expect(match, tag).not.toBeNull();
  return match![1].split(/\s+/).filter(Boolean);
}

describe("science principles layout", () => {
  const src = readFileSync(join(ROOT, "app/science/page.tsx"), "utf8");

  it("keeps principles 01–04 in order with the same titles, subtitles, and bodies", () => {
    let cursor = src.indexOf("const PRINCIPLES");
    expect(cursor).toBeGreaterThan(-1);
    for (const principle of PRINCIPLE_COPY) {
      const numberAt = src.indexOf(`number: "${principle.number}"`, cursor);
      const titleAt = src.indexOf(`title: "${principle.title}"`, numberAt);
      const subtitleAt = src.indexOf(`subtitle: "${principle.subtitle}"`, titleAt);
      const bodyAt = src.indexOf(`body: "${principle.body}"`, subtitleAt);
      expect(numberAt).toBeGreaterThan(-1);
      expect(titleAt).toBeGreaterThan(numberAt);
      expect(subtitleAt).toBeGreaterThan(titleAt);
      expect(bodyAt).toBeGreaterThan(subtitleAt);
      cursor = bodyAt + principle.body.length;
    }
  });

  it("renders the four principles from one sm two-column grid of lighter cells", () => {
    const maps = src.split("PRINCIPLES.map").length - 1;
    expect(maps).toBe(1);

    const mapAt = src.indexOf("{PRINCIPLES.map");
    expect(mapAt).toBeGreaterThan(-1);
    const wrapperStart = src.lastIndexOf("<", mapAt);
    const wrapperEnd = src.indexOf(">", wrapperStart);
    const wrapperTag = src.slice(wrapperStart, wrapperEnd + 1);
    expect(src.slice(wrapperEnd + 1, mapAt).trim()).toBe("");

    const wrapperClass = classTokens(wrapperTag);
    expect(wrapperClass).toContain("grid");
    expect(wrapperClass).toContain("grid-cols-1");
    expect(wrapperClass).toContain("sm:grid-cols-2");
    expect(wrapperClass).not.toContain("grid-cols-2");
    expect(wrapperClass.some((token) => token.startsWith("md:grid-cols-"))).toBe(false);
    expect(wrapperClass.some((token) => token.startsWith("lg:grid-cols-"))).toBe(false);

    const afterMap = src.slice(mapAt);
    const arrowAt = afterMap.indexOf("=>");
    const itemStart = afterMap.indexOf("<", arrowAt);
    const itemEnd = afterMap.indexOf(">", itemStart);
    const itemTag = afterMap.slice(itemStart, itemEnd + 1);
    const itemClass = classTokens(itemTag);
    const heavyCard =
      itemClass.includes("border") &&
      itemClass.includes("bg-zinc-950/70") &&
      itemClass.includes("p-6") &&
      itemClass.includes("sm:p-8");
    expect(heavyCard).toBe(false);
    expect(itemClass).toContain("bg-zinc-950/70");
    expect(itemClass).not.toContain("p-6");
    expect(itemClass).not.toContain("sm:p-8");

    const mapBody = afterMap.slice(0, afterMap.indexOf("))}"));
    const numberAt = mapBody.indexOf("{principle.number}");
    const titleAt = mapBody.indexOf("{principle.title}");
    const subtitleAt = mapBody.indexOf("{principle.subtitle}");
    const bodyAt = mapBody.indexOf("{principle.body}");
    expect(numberAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(numberAt);
    expect(subtitleAt).toBeGreaterThan(titleAt);
    expect(bodyAt).toBeGreaterThan(subtitleAt);

    const foragingAt = src.indexOf("data-science-epistemic-foraging");
    const researchAt = src.indexOf("data-science-research");
    expect(foragingAt).toBeGreaterThan(-1);
    expect(researchAt).toBeGreaterThan(-1);
    expect(foragingAt).toBeLessThan(mapAt);
    expect(mapAt).toBeLessThan(researchAt);
  });
});
