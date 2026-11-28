import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Right-pane UX: narrow column, Explore/Drill×timebox launch, mini tabs, news widget.
 * Drives shipped pure helpers + structural checks of UI source.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveLaunchFromStyleAndModality,
  resolveProductIntent,
} from "@/lib/product-intent";
import {
  BLOCK_DETAIL_MINI_TABS,
  WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
  WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
  nextBlockDetailMiniTab,
  resolveExclusiveBlockDetailDrawer,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";
import { deriveBlockExampleTopics } from "@/lib/block-example-topics";
import { tmpdir } from "node:os";


const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.RIGHT_PANE_UX_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-a6b66a4f65ae/implementer");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("Explore|Drill × Dialog/Solo → four launch targets", () => {
  it("keeps UI launch on dialog while resolveProductIntent still distinguishes solo", () => {
    expect(resolveLaunchFromStyleAndModality("explore", false)).toEqual(
      resolveProductIntent("explore", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("drill", false)).toEqual(
      resolveProductIntent("drill", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("explore", true)).toEqual(
      resolveProductIntent("explore", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("drill", true)).toEqual(
      resolveProductIntent("drill", "dialog"),
    );
    expect(resolveProductIntent("explore", "solo")).toEqual({
      id: "explore_solo",
      product: "ile",
      session_mode: "project",
    });
    expect(resolveProductIntent("drill", "solo").id).toBe("drill_solo");
    expect(resolveLaunchFromStyleAndModality("explore", false).id).toBe(
      "explore_dialog",
    );
    expect(resolveLaunchFromStyleAndModality("drill", true).id).toBe("drill_dialog");

    writeEvidence(
      "launch-intent-timebox.log",
      [
        "explore dialog=" + resolveLaunchFromStyleAndModality("explore", false).id,
        "drill dialog=" + resolveLaunchFromStyleAndModality("drill", false).id,
        "explore solo=" + resolveLaunchFromStyleAndModality("explore", true).id,
        "drill solo=" + resolveLaunchFromStyleAndModality("drill", true).id,
      ].join("\n"),
    );
  });
});

describe("desktop layout + block detail chrome", () => {

  it("BlockDetailCard is Explore/Drill only; no ? help", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).toContain("data-style-option={id}");
    expect(card).toContain('id: "explore"');
    expect(card).not.toContain('id: "scout" as const');
    expect(card).not.toContain('data-style-option="verify"');
    expect(card).not.toContain('onClick={() => setStyle("verify")}');
    expect(card).not.toContain("data-modality-control");
    expect(card).not.toContain("data-modality-toggle");
    expect(card).not.toContain("data-modality-option");
    expect(card).not.toContain("data-product-intent-modality-grid");
    expect(card).toContain('data-style-icon="explore"');
    expect(card).not.toContain('data-style-icon="scout"');
    // Style is select-only; Start + duration live on the card
    expect(card).toContain("data-style-select");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");
    expect(card).not.toContain("openEndedExploreHint");
    // No "?" help control chrome
    expect(card).not.toContain("setShowHelp");
    expect(card).not.toContain("modesHelpTitle");
    expect(card).not.toMatch(/>\s*\?\s*</);
    expect(card).not.toContain("How context shapes practice");
  });

});

function cardHasHelp(card: string) {
  return card.includes("setShowHelp") || card.includes("modesHelpTitle");
}
