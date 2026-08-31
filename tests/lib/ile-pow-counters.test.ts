import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendIlePowCounterArtifact,
  countIlePowByType,
  emptyIlePowTypeCounts,
  ilePowCounterTotal,
  type IlePowCounterArtifact,
} from "@/lib/ile-pow-counters";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a5fcb6d60ed5/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("countIlePowByType (session-global)", () => {
  it("counts zeros, mixed types, aliases, and ignores chapter partitioning", () => {
    expect(countIlePowByType([])).toEqual(emptyIlePowTypeCounts());
    expect(countIlePowByType(null)).toEqual({ tool: 0, screen: 0, video: 0, eeg: 0 });

    const mixed: IlePowCounterArtifact[] = [
      { type: "tool", chapter_id: "ch-a" },
      { proof_of_work_type: "screenshot", chapter_id: "ch-b" },
      { kind: "eeg", chapter_id: "ch-a" },
      { type: "video", chapter_id: "ch-c" },
      { type: "screen", chapter_id: "ch-a" },
      { type: "traces", chapter_id: "ch-z" },
      { type: "unknown" },
    ];
    const counts = countIlePowByType(mixed);
    expect(counts).toEqual({ tool: 2, screen: 2, video: 1, eeg: 1 });
    expect(ilePowCounterTotal(counts)).toBe(6);

    const focusedA = mixed.filter((row) => row.chapter_id === "ch-a");
    const focusedB = mixed.filter((row) => row.chapter_id === "ch-b");
    expect(countIlePowByType(mixed)).not.toEqual(countIlePowByType(focusedA));
    expect(countIlePowByType(mixed).tool).toBeGreaterThan(countIlePowByType(focusedA).tool);
    expect(countIlePowByType(focusedB).screen).toBe(1);
    expect(countIlePowByType(mixed).screen).toBe(2);

    const grown = appendIlePowCounterArtifact(mixed, { type: "eeg", chapter_id: "other" });
    expect(countIlePowByType(grown).eeg).toBe(2);
    expect(countIlePowByType(grown).tool).toBe(counts.tool);

    writeScratch(
      "ile-pow-counters-excerpts.txt",
      JSON.stringify({ zeros: emptyIlePowTypeCounts(), mixed: counts, total: ilePowCounterTotal(counts) }),
    );
  });
});
