/**
 * TAP Learning welcome Confirm Settings stays blocked only while start
 * is preparing the field. Chapter existence does not gate it.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isIleConfirmSettingsBlocked } from "@/components/session-view/learn-confirm-settings";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("isIleConfirmSettingsBlocked", () => {
  it("allows confirm while idle", () => {
    expect(isIleConfirmSettingsBlocked(false)).toBe(false);
  });

  it("still blocks while confirm prep is running", () => {
    expect(isIleConfirmSettingsBlocked(true)).toBe(true);
  });
});

describe("TAP Learning welcome modal wires Confirm Settings to the chapters check", () => {
  it("disables the confirm button with the shipped blocker and guards the click", () => {
    const src = read("components/session-view/session-welcome-modal.tsx");
    expect(src).toContain('from "@/components/session-view/learn-confirm-settings"');
    expect(src).toContain("isIleConfirmSettingsBlocked");
    expect(src).toContain("data-ile-confirm-settings");
    expect(src).toContain("data-ile-confirm-settings-footer");
    expect(src).toContain("disabled={confirmBlocked}");
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
    const guardAt = src.indexOf("isIleConfirmSettingsBlocked(isPreparing)", clickAt);
    const confirmHandlerAt = src.indexOf("onConfirmSettings()", clickAt);
    expect(confirmAt).toBeGreaterThan(-1);
    expect(clickAt).toBeGreaterThan(confirmAt);
    expect(guardAt).toBeGreaterThan(clickAt);
    expect(confirmHandlerAt).toBeGreaterThan(guardAt);
    expect(src.slice(guardAt, guardAt + 80)).not.toContain("planLoading");
  });
});
