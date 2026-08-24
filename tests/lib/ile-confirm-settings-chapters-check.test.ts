/**
 * ILE welcome Confirm Settings stays blocked until the existing-chapters
 * check finishes (chapterPlanStatus leaves "unknown").
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isIleConfirmSettingsBlocked } from "@/components/session-view/ile-confirm-settings";
import type { ChapterPlanStatus } from "@/components/session-view/types";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("isIleConfirmSettingsBlocked", () => {
  it("blocks confirm while the chapters check is still unknown", () => {
    expect(isIleConfirmSettingsBlocked("unknown", false, false)).toBe(true);
  });

  it("allows confirm once chapter status is known and prep is idle", () => {
    const known: ChapterPlanStatus[] = ["empty", "exists"];
    for (const status of known) {
      expect(isIleConfirmSettingsBlocked(status, false, false)).toBe(false);
    }
  });

  it("still blocks while the plan is loading or preparing, even after the check", () => {
    expect(isIleConfirmSettingsBlocked("empty", true, false)).toBe(true);
    expect(isIleConfirmSettingsBlocked("exists", false, true)).toBe(true);
    expect(isIleConfirmSettingsBlocked("exists", true, true)).toBe(true);
  });
});

describe("ILE welcome modal wires Confirm Settings to the chapters check", () => {
  it("disables the confirm button with the shipped blocker and guards the click", () => {
    const src = read("components/session-view/session-welcome-modal.tsx");
    expect(src).toContain('from "@/components/session-view/ile-confirm-settings"');
    expect(src).toContain("isIleConfirmSettingsBlocked");
    expect(src).toContain("data-ile-confirm-settings");
    expect(src).toContain("disabled={confirmBlocked}");
    expect(src).toContain("chapterPlanStatus === \"unknown\"");

    const confirmAt = src.indexOf("data-ile-confirm-settings");
    const clickAt = src.indexOf("onClick={() => {", confirmAt);
    const guardAt = src.indexOf("isIleConfirmSettingsBlocked(chapterPlanStatus", clickAt);
    const confirmHandlerAt = src.indexOf("onConfirmSettings()", clickAt);
    expect(confirmAt).toBeGreaterThan(-1);
    expect(clickAt).toBeGreaterThan(confirmAt);
    expect(guardAt).toBeGreaterThan(clickAt);
    expect(confirmHandlerAt).toBeGreaterThan(guardAt);
  });
});
