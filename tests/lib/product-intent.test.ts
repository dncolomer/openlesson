/**
 * Product intent: Explore/Drill × Open-ended/Timed → technical ILE/TAP launch.
 * Drives shipped resolve helpers — no re-implementation of the matrix.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allProductLaunchTargets,
  productIntentClusterLabel,
  productIntentFromGuestLink,
  productIntentToCreateFields,
  PRODUCT_INTENT_LABELS,
  resolveProductIntent,
  resolveProductIntentFromAxes,
} from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("resolveProductIntent four combinations", () => {
  it("open-ended explore → ILE learning", () => {
    const t = resolveProductIntent("explore", "open_ended");
    expect(t).toEqual({
      id: "open_ended_explore",
      product: "ile",
      session_mode: "learning",
    });
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.openEndedExplore);
  });

  it("open-ended drill → ILE project", () => {
    const t = resolveProductIntent("drill", "open_ended");
    expect(t.product).toBe("ile");
    expect(t.session_mode).toBe("project");
    expect(t.id).toBe("open_ended_drill");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.openEndedDrill);
  });

  it("timed explore → TAP conversational", () => {
    const t = resolveProductIntent("explore", "timed");
    expect(t.product).toBe("tap");
    expect(t.interaction_kind).toBe("conversational");
    expect(t.id).toBe("timed_explore");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.timedExplore);
  });

  it("timed drill → TAP exercise", () => {
    const t = resolveProductIntent("drill", "timed");
    expect(t.product).toBe("tap");
    expect(t.interaction_kind).toBe("exercise");
    expect(t.id).toBe("timed_drill");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.timedDrill);
  });

  it("defaults invalid/missing to open-ended explore", () => {
    const t = resolveProductIntent(undefined, null);
    expect(t.id).toBe("open_ended_explore");
    expect(resolveProductIntentFromAxes({})).toEqual(t);
  });
});

describe("productIntentFromGuestLink / create fields", () => {
  it("infers clusters from technical link fields", () => {
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "learning" }).id,
    ).toBe("open_ended_explore");
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "project" }).id,
    ).toBe("open_ended_drill");
    expect(
      productIntentFromGuestLink({ kind: "tap", interaction_kind: "conversational" }).id,
    ).toBe("timed_explore");
    expect(
      productIntentFromGuestLink({ kind: "tap", interaction_kind: "exercise" }).id,
    ).toBe("timed_drill");
  });

  it("maps create fields for APIs", () => {
    expect(productIntentToCreateFields(resolveProductIntent("drill", "open_ended"))).toEqual({
      linkKind: "ile",
      session_mode: "project",
      project: true,
    });
    expect(productIntentToCreateFields(resolveProductIntent("drill", "timed"))).toEqual({
      linkKind: "tap",
      interaction_kind: "exercise",
      exercise: true,
    });
  });

  it("exposes all four targets", () => {
    expect(allProductLaunchTargets()).toHaveLength(4);
  });
});

describe("structural: workspace + settings hide TAP/ILE product names", () => {
  it("BlockDetailCard uses Explore/Drill + timebox, not ILE/TAP CTAs", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("product-intent");
    expect(card).toContain("resolveLaunchFromStyleAndTimebox");
    expect(card).toContain("data-style-option={id}");
    expect(card).toContain('id: "explore"');
    expect(card).toContain('id: "drill"');
    expect(card).toContain("data-timebox-toggle");
    // Select-only style tools; Start launches
    expect(card).toContain("data-style-select");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");
    expect(card).not.toContain("openEndedExploreHint");
    expect(card).not.toContain("timedExploreHint");
    // User-visible product brands removed from action grid
    expect(card).not.toMatch(/ILE · Learning Mode|ILE · Project Mode|Exercise TAP|Think Aloud Protocol/);
    expect(card).not.toContain('data-block-tool="ile-learning"');
    expect(card).not.toContain('data-block-tool="tap-exercise"');
  });

  it("WorkspaceGuestLinksPanel uses intent clusters; create still sets technical fields", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("productIntent");
    expect(panel).toContain("Open-ended Exploration");
    expect(panel).toContain("session_mode");
    expect(panel).toContain("interaction_kind");
    // Primary badges not TAP/ILE product names
    expect(panel).not.toMatch(/\{isTap \? "TAP" : "ILE"\}/);
    expect(panel).not.toContain("Exercise TAP (no dialogue)");
  });

  it("Settings / dashboard / workspace chrome avoid TAP/ILE product brands", () => {
    const integration = read("components/WorkspaceIntegrationPanel.tsx");
    expect(integration).not.toContain("Create shareable TAP and ILE guest links");
    expect(integration).toMatch(/shareable practice links/i);

    const dashboard = read("app/dashboard/page.tsx");
    expect(dashboard).not.toContain(">TAP sessions<");
    expect(dashboard).not.toContain(">ILE sessions<");
    expect(dashboard).toContain("Timed sessions");
    expect(dashboard).toContain("Open-ended sessions");
    expect(dashboard).not.toContain("TAP/ILE PoW not billed");

    const en = read("messages/en.json");
    expect(en).toContain('"productIle": "Open-ended practice"');
    expect(en).toContain('"productTap": "Timed practice"');
    expect(en).not.toContain('"productIle": "Integrated Learning Environment"');
    expect(en).toMatch(/forkToEditBody.*practice sessions/);

    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("Open-ended only");
    expect(aycl).not.toContain("ILE only");

    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toMatch(/double-click block for (detail|practice)/);
    expect(grid).not.toContain("double-click block for TAP/ILE");
  });

  it("labels never use TAP/ILE as product names", () => {
    const labels = Object.values(PRODUCT_INTENT_LABELS).join(" ");
    expect(labels).not.toMatch(/\bTAP\b|\bILE\b/);
  });

  it("workspace TAP route accepts minutes and locks duration in the client", () => {
    const page = read("app/workspace/[id]/tap/page.tsx");
    expect(page).toContain("minutes");
    expect(page).toContain("initialMinutes");
    expect(page).toContain("lockDuration");
    const score = read("components/TapScoreClient.tsx");
    expect(score).toContain("lockDuration");
    expect(score).toContain("showDurationPicker={!privateToken && !durationLocked}");
    const exercise = read("components/ExerciseTapClient.tsx");
    expect(exercise).toContain("lockDuration");
    expect(exercise).toContain("showDurationPicker={!privateToken && !durationLocked}");
  });
});
