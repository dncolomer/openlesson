import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideIleChapterClose,
  planIleChapterClose,
  resolveIleChapterDoneIndex,
  reviewIleChapterClose,
  reviewIleChapterCloseInBatches,
  splitIlePowBatches,
} from "@/lib/ile-chapter-close-review";
import { buildIleChapterDonePowToolData } from "@/lib/ile-mode";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";

const ROOT = join(__dirname, "../..");

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a5fcb6d60ed5/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const chapter = { id: "ch-1", description: "Limits" };

describe("ILE chapter-close review", () => {
  it("concatenated PoW and batched PoW produce the same close decision", () => {
    const artifacts: IlePowCounterArtifact[] = [
      { type: "tool" },
      { type: "screen" },
      { type: "eeg" },
      { type: "tool", chapter_id: "other" },
      { type: "video" },
    ];
    const concatenated = reviewIleChapterClose({ artifacts, chapter });
    const batches = splitIlePowBatches(artifacts, 2);
    expect(batches.length).toBeGreaterThan(1);
    const batched = reviewIleChapterCloseInBatches({ batches, chapter });
    expect(batched.canClose).toBe(concatenated.canClose);
    expect(batched.counters).toEqual(concatenated.counters);
    expect(batched.canClose).toBe(true);

    const empty = reviewIleChapterClose({ artifacts: [], chapter });
    expect(empty.canClose).toBe(false);
    const emptyBatches = reviewIleChapterCloseInBatches({
      batches: splitIlePowBatches([], 2),
      chapter,
    });
    expect(emptyBatches.canClose).toBe(empty.canClose);

    writeScratch(
      "ile-chapter-close-review-concat.txt",
      JSON.stringify({ concatenated, batched, empty }),
    );
  });

  it("failing review does not close; close-override closes and records override on done payload", () => {
    const failing = planIleChapterClose({
      artifacts: [],
      chapter,
      closeOverride: false,
    });
    expect(failing.close).toBe(false);
    expect(failing.closeOverride).toBe(false);
    expect(failing.review.canClose).toBe(false);
    const blocked = decideIleChapterClose({ review: failing.review, closeOverride: false });
    expect(blocked.close).toBe(false);

    const forced = planIleChapterClose({
      artifacts: [],
      chapter,
      closeOverride: true,
    });
    expect(forced.close).toBe(true);
    expect(forced.closeOverride).toBe(true);
    expect(forced.review.canClose).toBe(false);

    const payload = buildIleChapterDonePowToolData({
      stepIndex: 0,
      stepId: chapter.id,
      stepDescription: chapter.description,
      sessionMode: "learning",
      closeOverride: forced.closeOverride,
      reviewCanClose: forced.review.canClose,
    });
    expect(payload.close_override).toBe(true);
    expect(payload.review_can_close).toBe(false);
    expect(payload.stepId).toBe("ch-1");

    const allowed = planIleChapterClose({
      artifacts: [{ type: "tool" }],
      chapter,
      closeOverride: false,
    });
    expect(allowed.close).toBe(true);
    expect(allowed.closeOverride).toBe(false);

    const mutatePath = join(ROOT, "components/session-view/use-session-mutate.ts");
    expect(existsSync(mutatePath)).toBe(true);
    const mutate = readFileSync(mutatePath, "utf8");
    const doneFn = mutate.slice(mutate.indexOf("const handleMarkChapterDone"));
    expect(resolveIleChapterDoneIndex(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      0,
      "c",
    )).toBe(2);
    expect(resolveIleChapterDoneIndex([{ id: "a" }, { id: "b" }], 1)).toBe(1);
    expect(resolveIleChapterDoneIndex([], 0, "c")).toBe(-1);
    expect(doneFn).toContain("resolveIleChapterDoneIndex");
    expect(doneFn).toContain("opts?.stepId");
    expect(doneFn).toContain("planIleChapterClose");
    expect(doneFn).toContain("if (!planned.close)");
    const reviewIdx = doneFn.indexOf("if (!planned.close)");
    const persistIdx = doneFn.indexOf("await persistPlanSteps(updatedPlan");
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(reviewIdx);
    expect(doneFn.slice(reviewIdx, persistIdx)).toContain("return false;");
    expect(doneFn).toContain("closeOverride: planned.closeOverride");
    expect(doneFn).toContain("reviewCanClose: planned.review.canClose");

    const chrome = readFileSync(join(ROOT, "components/session-view/session-chrome.tsx"), "utf8");
    expect(chrome).toContain("data-ile-chapter-close-blocked");
    expect(chrome).toContain("ConfirmDialog");
    expect(chrome).toContain('t("chapterMap.closeOverride")');
    const chapterPanel = readFileSync(join(ROOT, "components/ChapterMapPanel.tsx"), "utf8");
    expect(chapterPanel).not.toContain("data-ile-chapter-close-blocked");

    writeScratch(
      "ile-chapter-close-review-excerpts.txt",
      JSON.stringify({ failing, forced, payload, allowed }),
    );
  });
});
