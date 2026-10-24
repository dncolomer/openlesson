/**
 * TAP Learning welcome Confirm Settings stays blocked only while start
 * is preparing the field. Chapter existence does not gate it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("TAP Learning welcome modal wires Confirm Settings to start prep", () => {
  it("disables the confirm button while isPreparing and guards the click", () => {
    expect(existsSync(join(ROOT, "components/session-view/learn-confirm-settings.ts"))).toBe(
      false,
    );
    const src = read("components/session-view/session-welcome-modal.tsx");
    expect(src).not.toContain("isIleConfirmSettingsBlocked");
    expect(src).not.toContain("learn-confirm-settings");
    expect(src).toContain("data-ile-confirm-settings");
    expect(src).toContain("data-ile-confirm-settings-footer");
    expect(src).toContain("disabled={isPreparing}");
    const footerAt = src.indexOf("data-ile-confirm-settings-footer");
    const confirmAt = src.indexOf(
      "data-ile-confirm-settings",
      footerAt + "data-ile-confirm-settings-footer".length,
    );
    expect(footerAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeGreaterThan(footerAt);
    const confirmSlice = src.slice(confirmAt, confirmAt + 1600);
    expect(confirmSlice).toContain("inline-flex w-full");
    expect(confirmSlice).toContain('t("session.confirmSettings")');
    expect(src.slice(footerAt, confirmAt)).toContain("mt-auto");
    expect(src.slice(footerAt, confirmAt)).toContain("shrink-0");
    expect(src).toContain("chapterPlanStatus === \"unknown\"");
    expect(src).toContain("chapterPlanStatus === \"failed\"");

    const clickAt = src.indexOf("onClick={() => {", confirmAt);
    const guardAt = src.indexOf("if (isPreparing)", clickAt);
    const confirmHandlerAt = src.indexOf("onConfirmSettings()", clickAt);
    expect(confirmAt).toBeGreaterThan(-1);
    expect(clickAt).toBeGreaterThan(confirmAt);
    expect(guardAt).toBeGreaterThan(clickAt);
    expect(confirmHandlerAt).toBeGreaterThan(guardAt);
    expect(src.slice(guardAt, confirmHandlerAt)).not.toContain("planLoading");
    expect(src.slice(guardAt, confirmHandlerAt)).not.toContain("chapterPlanStatus");
  });
});
