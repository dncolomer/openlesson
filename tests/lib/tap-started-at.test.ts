import { describe, expect, it } from "vitest";
import { buildTapInProgressPatch, shouldSetTapStartedAt } from "@/lib/tap-started-at";

describe("shouldSetTapStartedAt / buildTapInProgressPatch", () => {
  it("sets started_at only on first pending→in_progress transition", () => {
    expect(shouldSetTapStartedAt(null)).toBe(true);
    expect(shouldSetTapStartedAt({ status: "pending", started_at: null })).toBe(true);
    expect(shouldSetTapStartedAt({ status: "pending" })).toBe(true);

    expect(
      shouldSetTapStartedAt({
        status: "in_progress",
        started_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);

    expect(shouldSetTapStartedAt({ status: "in_progress", started_at: null })).toBe(false);
    expect(shouldSetTapStartedAt({ status: "completed", started_at: null })).toBe(false);
  });

  it("buildTapInProgressPatch does not reset started_at when already set", () => {
    const first = buildTapInProgressPatch({ status: "pending", started_at: null });
    expect(first.status).toBe("in_progress");
    expect(first.started_at).toBeTruthy();

    const second = buildTapInProgressPatch({
      status: "in_progress",
      started_at: "2026-01-01T00:00:00.000Z",
    });
    expect(second).toEqual({ status: "in_progress" });
    expect(second.started_at).toBeUndefined();
  });
});
