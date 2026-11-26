import { readGridOpsSurface, readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCreateBlockIsStartField,
  buildUpdateBlockPayload,
  normalizeStarterFlag,
  resolveCreateBlockIsStart,
  resolveUpdateBlockIsStart,
} from "@/lib/block-starter-flag";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6cbbd3238dc4/implementer";

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("block-starter-flag pure payload mapping", () => {
  it("normalizeStarterFlag defaults false; truthy variants map true", () => {
    expect(normalizeStarterFlag(undefined)).toBe(false);
    expect(normalizeStarterFlag(null)).toBe(false);
    expect(normalizeStarterFlag(false)).toBe(false);
    expect(normalizeStarterFlag("false")).toBe(false);
    expect(normalizeStarterFlag(0)).toBe(false);
    expect(normalizeStarterFlag(true)).toBe(true);
    expect(normalizeStarterFlag("true")).toBe(true);
    expect(normalizeStarterFlag(1)).toBe(true);
    expect(normalizeStarterFlag("1")).toBe(true);
  });

  it("resolveCreateBlockIsStart: author opt-in, empty-map default, non-empty default false", () => {
    // Author flags starter on a populated map
    expect(
      resolveCreateBlockIsStart({ authorStarter: true, existingBlockCount: 5 }),
    ).toBe(true);
    // Author leaves off on populated map → not start
    expect(
      resolveCreateBlockIsStart({ authorStarter: false, existingBlockCount: 5 }),
    ).toBe(false);
    expect(
      resolveCreateBlockIsStart({ authorStarter: undefined, existingBlockCount: 2 }),
    ).toBe(false);
    // Empty map still starts even when author leaves control off (intentional)
    expect(
      resolveCreateBlockIsStart({ authorStarter: false, existingBlockCount: 0 }),
    ).toBe(true);
    expect(
      resolveCreateBlockIsStart({ authorStarter: undefined, existingBlockCount: 0 }),
    ).toBe(true);
    // Author opt-in on empty map
    expect(
      resolveCreateBlockIsStart({ authorStarter: true, existingBlockCount: 0 }),
    ).toBe(true);
  });

  it("buildCreateBlockIsStartField assembles { is_start } for create APIs", () => {
    expect(
      buildCreateBlockIsStartField({ authorStarter: true, existingBlockCount: 3 }),
    ).toEqual({ is_start: true });
    expect(
      buildCreateBlockIsStartField({ authorStarter: false, existingBlockCount: 3 }),
    ).toEqual({ is_start: false });
    expect(
      buildCreateBlockIsStartField({ authorStarter: false, existingBlockCount: 0 }),
    ).toEqual({ is_start: true });
  });

  it("resolveUpdateBlockIsStart uses author when provided; keeps existing when omitted", () => {
    expect(
      resolveUpdateBlockIsStart({ authorStarter: true, existingIsStart: false }),
    ).toBe(true);
    expect(
      resolveUpdateBlockIsStart({ authorStarter: false, existingIsStart: true }),
    ).toBe(false);
    expect(
      resolveUpdateBlockIsStart({ authorStarter: undefined, existingIsStart: true }),
    ).toBe(true);
    expect(
      resolveUpdateBlockIsStart({ authorStarter: undefined, existingIsStart: false }),
    ).toBe(false);
  });

  it("buildUpdateBlockPayload maps isStart → is_start for update_block body", () => {
    const withStart = buildUpdateBlockPayload({
      blockId: "b1",
      title: "Intro",
      description: "desc",
      isStart: true,
    });
    expect(withStart).toEqual({
      blockId: "b1",
      title: "Intro",
      description: "desc",
      is_start: true,
    });

    const clearStart = buildUpdateBlockPayload({
      blockId: "b1",
      title: "Intro",
      description: "",
      isStart: false,
    });
    expect(clearStart.is_start).toBe(false);

    const omitStart = buildUpdateBlockPayload({
      blockId: "b2",
      title: "Other",
      description: "x",
      includeIsStart: false,
    });
    expect(omitStart).toEqual({
      blockId: "b2",
      title: "Other",
      description: "x",
    });
    expect("is_start" in omitStart).toBe(false);
  });

  it("writes starter-flag-payload.log evidence", () => {
    const lines = [
      "normalize_true=" + normalizeStarterFlag(true),
      "normalize_false=" + normalizeStarterFlag(false),
      "create_author_true_pop=" +
        resolveCreateBlockIsStart({ authorStarter: true, existingBlockCount: 4 }),
      "create_author_false_pop=" +
        resolveCreateBlockIsStart({ authorStarter: false, existingBlockCount: 4 }),
      "create_empty_default=" +
        resolveCreateBlockIsStart({ authorStarter: false, existingBlockCount: 0 }),
      "update_set=" +
        JSON.stringify(
          buildUpdateBlockPayload({
            blockId: "x",
            title: "T",
            description: "D",
            isStart: true,
          }),
        ),
      "update_clear=" +
        JSON.stringify(
          buildUpdateBlockPayload({
            blockId: "x",
            title: "T",
            description: "D",
            isStart: false,
          }),
        ),
      "create_field=" +
        JSON.stringify(
          buildCreateBlockIsStartField({
            authorStarter: true,
            existingBlockCount: 1,
          }),
        ),
    ];
    mkdirSync(SCRATCH, { recursive: true });
    const path = join(SCRATCH, "starter-flag-payload.log");
    writeFileSync(path, lines.join("\n") + "\n", "utf8");
    const body = readFileSync(path, "utf8");
    expect(body).toContain("create_author_true_pop=true");
    expect(body).toContain("create_author_false_pop=false");
    expect(body).toContain("create_empty_default=true");
    expect(body).toContain('"is_start":true');
  });
});
