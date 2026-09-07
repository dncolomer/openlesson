import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  chapterHasPendingHeliosReply,
  latestSettledAssistantId,
  resolveIleDockChipStatus,
  sameIleIdList,
} from "@/lib/ile-work-dock-status";

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

describe("resolveIleDockChipStatus", () => {
  it("prefers loading over attention; idle otherwise", () => {
    expect(resolveIleDockChipStatus({ chapterId: "ch-a" })).toBe("idle");
    expect(
      resolveIleDockChipStatus({
        chapterId: "ch-a",
        loadingIds: ["ch-a"],
        attentionIds: ["ch-a"],
      }),
    ).toBe("loading");
    expect(
      resolveIleDockChipStatus({
        chapterId: "ch-a",
        loadingIds: ["ch-b"],
        attentionIds: ["ch-a"],
      }),
    ).toBe("attention");
  });

  it("reads pending vs settled assistant messages", () => {
    expect(chapterHasPendingHeliosReply([])).toBe(false);
    expect(
      chapterHasPendingHeliosReply([
        { role: "user", pending: false },
        { role: "assistant", pending: true },
      ]),
    ).toBe(true);
    expect(
      chapterHasPendingHeliosReply([
        { role: "assistant", pending: true },
        { role: "assistant", pending: false },
      ]),
    ).toBe(false);
    expect(
      latestSettledAssistantId([
        { role: "assistant", id: "a1", pending: false },
        { role: "assistant", id: "a2", pending: true },
      ]),
    ).toBe("a1");
    expect(sameIleIdList(["a"], ["a"])).toBe(true);
    expect(sameIleIdList(["a"], ["b"])).toBe(false);
  });
});

describe("docked chapter loading / attention chrome (shipped source)", () => {
  it("Submit work marks dock chips loading then attention until opened", () => {
    const view = read("components/SessionView.tsx");
    expect(view).toContain("setDockLoadingIds");
    expect(view).toContain("setDockAttentionIds");
    expect(view).toContain("const awaitingIds = [...openWorkIds]");
    expect(view).toContain("ILE_SUBMIT_WORK_CONTINUE_TEXT");
    expect(view).toContain("chapterHasPendingHeliosReply");
    expect(view).toContain("dockPendingSeenRef");
    expect(view).toContain("replyLanded");
    expect(view).toContain("resolveIleDockChipStatus");
    expect(view).toContain("status:");

    const dock = read("components/session-view/ile-work-dock-bar.tsx");
    expect(dock).toContain("data-ile-chapter-chip-status");
    expect(dock).toContain("data-ile-chapter-chip-loading");
    expect(dock).toContain("data-ile-chapter-chip-attention");
    expect(dock).toContain("AlertTriangle");
    expect(dock).toContain("animate-ile-dock-indeterminate");
    expect(dock).not.toContain("w-full animate-pulse");
    const css = read("app/globals.css");
    expect(css).toContain("@keyframes ile-dock-indeterminate");

    writeScratch(
      "ile-work-dock-status.txt",
      "loading bar while Helios pending; warning icon until opened",
    );
  });
});
