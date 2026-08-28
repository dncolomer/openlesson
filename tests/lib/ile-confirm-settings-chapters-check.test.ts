/**
 * ILE welcome Confirm Settings stays blocked until the cheap
 * existing-chapters check finishes (chapterPlanStatus leaves "unknown").
 * Hydrate / objectives / planLoading must not keep it blocked.
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
    expect(isIleConfirmSettingsBlocked("unknown", false)).toBe(true);
  });

  it("allows confirm once chapter status is known, even if planLoading would still be true", () => {
    const known: ChapterPlanStatus[] = ["empty", "exists", "failed"];
    for (const status of known) {
      expect(isIleConfirmSettingsBlocked(status, false)).toBe(false);
    }
  });

  it("still blocks while confirm prep is running", () => {
    expect(isIleConfirmSettingsBlocked("exists", true)).toBe(true);
    expect(isIleConfirmSettingsBlocked("empty", true)).toBe(true);
    expect(isIleConfirmSettingsBlocked("failed", true)).toBe(true);
  });
});

describe("ILE welcome modal wires Confirm Settings to the chapters check", () => {
  it("disables the confirm button with the shipped blocker and guards the click", () => {
    const src = read("components/session-view/session-welcome-modal.tsx");
    expect(src).toContain('from "@/components/session-view/ile-confirm-settings"');
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
    expect(src.slice(footerAt, confirmAt + 900)).toContain("w-full");
    expect(src.slice(footerAt, confirmAt)).toContain("shrink-0");
    expect(src).toContain("chapterPlanStatus === \"unknown\"");
    expect(src).toContain("chapterPlanStatus === \"failed\"");

    const clickAt = src.indexOf("onClick={() => {", confirmAt);
    const guardAt = src.indexOf("isIleConfirmSettingsBlocked(chapterPlanStatus", clickAt);
    const confirmHandlerAt = src.indexOf("onConfirmSettings()", clickAt);
    expect(confirmAt).toBeGreaterThan(-1);
    expect(clickAt).toBeGreaterThan(confirmAt);
    expect(guardAt).toBeGreaterThan(clickAt);
    expect(confirmHandlerAt).toBeGreaterThan(guardAt);
    expect(src.slice(guardAt, guardAt + 80)).not.toContain("planLoading");
  });
});
