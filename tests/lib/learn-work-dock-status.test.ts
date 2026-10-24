import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ile-dock-status/implementer";

function read(rel: string) {
  expect(existsSync(join(ROOT, rel)), `missing ${rel}`).toBe(true);
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("docked chapter loading / attention chrome (shipped source)", () => {
  it("Learn host chips stay idle; Helios reply helpers are gone", () => {
    expect(existsSync(join(ROOT, "lib/learn-work-dock-status.ts"))).toBe(false);
    const view = read("components/SessionView.tsx");
    expect(view).not.toContain("handleSubmitTurn");
    expect(view).not.toContain("setDockLoadingIds");
    expect(view).not.toContain("ILE_SUBMIT_WORK_CONTINUE_TEXT");
    expect(view).not.toContain("chapterHasPendingHeliosReply");
    expect(view).not.toContain("resolveIleDockChipStatus");

    const dock = read("components/session-view/learn-work-dock-bar.tsx");
    expect(dock).toContain("data-ile-chapter-chip-status");
    expect(dock).toContain("data-ile-chapter-chip-loading");
    expect(dock).toContain("export function IleWorkDockChip");
    const craft = read("components/session-view/learn-turn-insight-craft.tsx");
    expect(craft).toContain("IleWorkDockChip");
    expect(craft).toContain('status: missing ? "attention"');
    expect(dock).toContain("data-ile-chapter-chip-attention");
    expect(dock).toContain("AlertTriangle");
    expect(dock).toContain("animate-ile-dock-indeterminate");
    expect(dock).not.toContain("w-full animate-pulse");
    const css = read("app/globals.css");
    expect(css).toContain("@keyframes ile-dock-indeterminate");

    writeScratch(
      "ile-work-dock-status.txt",
      "dock chips stay idle; Learn no longer waits on Helios replies",
    );
  });
});
