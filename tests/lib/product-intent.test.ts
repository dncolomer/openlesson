/**
 * Product intent: Explore/Drill × Dialog/Solo → technical ILE/TAP launch.
 * Drill always TAP; Explore always ILE.
 * Drives shipped resolve helpers — no re-implementation of the matrix.
 */
import { describe, expect, it } from "vitest";
import { readExerciseTapSurface, readMapGridSurface, readTapScoreSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  allProductLaunchTargets,
  productIntentClusterLabel,
  productIntentFromGuestLink,
  productIntentToCreateFields,
  PRODUCT_INTENT_LABELS,
  resolveProductIntent,
  resolveProductIntentFromAxes,
  resolveProductIntentFromId,
  canonicalizeProductIntentId,
} from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1a28af023b24/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("resolveProductIntent four combinations (Dialog/Solo axes)", () => {
  it("explore + dialog → ILE learning", () => {
    const t = resolveProductIntent("explore", "dialog");
    expect(t).toEqual({
      id: "explore_dialog",
      product: "ile",
      session_mode: "learning",
    });
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.exploreDialog);
  });

  it("explore + solo → ILE project", () => {
    const t = resolveProductIntent("explore", "solo");
    expect(t.product).toBe("ile");
    expect(t.session_mode).toBe("project");
    expect(t.id).toBe("explore_solo");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.exploreSolo);
  });

  it("drill + dialog → TAP conversational", () => {
    const t = resolveProductIntent("drill", "dialog");
    expect(t.product).toBe("tap");
    expect(t.interaction_kind).toBe("conversational");
    expect(t.id).toBe("drill_dialog");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.drillDialog);
  });

  it("drill + solo → TAP exercise", () => {
    const t = resolveProductIntent("drill", "solo");
    expect(t.product).toBe("tap");
    expect(t.interaction_kind).toBe("exercise");
    expect(t.id).toBe("drill_solo");
    expect(productIntentClusterLabel(t)).toBe(PRODUCT_INTENT_LABELS.drillSolo);
  });

  it("Drill never launches ILE; Explore never launches TAP", () => {
    for (const modality of ["dialog", "solo"] as const) {
      expect(resolveProductIntent("drill", modality).product).toBe("tap");
      expect(resolveProductIntent("explore", modality).product).toBe("ile");
    }
  });

  it("accepts legacy open_ended/timed second-arg tokens", () => {
    // open_ended → dialog; timed → solo under the new axes
    expect(resolveProductIntent("explore", "open_ended").id).toBe("explore_dialog");
    expect(resolveProductIntent("explore", "timed").id).toBe("explore_solo");
    expect(resolveProductIntent("drill", "open_ended").id).toBe("drill_dialog");
    expect(resolveProductIntent("drill", "timed").id).toBe("drill_solo");
  });

  it("defaults invalid/missing to explore dialog", () => {
    const t = resolveProductIntent(undefined, null);
    expect(t.id).toBe("explore_dialog");
    expect(resolveProductIntentFromAxes({})).toEqual(t);
  });
});

describe("productIntentFromGuestLink / create fields / id migration", () => {
  it("infers clusters from technical link fields", () => {
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "learning" }).id,
    ).toBe("explore_dialog");
    expect(
      productIntentFromGuestLink({ kind: "ile", session_mode: "project" }).id,
    ).toBe("explore_solo");
    expect(
      productIntentFromGuestLink({ kind: "tap", interaction_kind: "conversational" }).id,
    ).toBe("drill_dialog");
    expect(
      productIntentFromGuestLink({ kind: "tap", interaction_kind: "exercise" }).id,
    ).toBe("drill_solo");
  });

  it("maps create fields for APIs", () => {
    expect(productIntentToCreateFields(resolveProductIntent("explore", "solo"))).toEqual({
      linkKind: "ile",
      session_mode: "project",
      project: true,
    });
    expect(productIntentToCreateFields(resolveProductIntent("drill", "solo"))).toEqual({
      linkKind: "tap",
      interaction_kind: "exercise",
      exercise: true,
    });
    expect(productIntentToCreateFields(resolveProductIntent("drill", "dialog"))).toEqual({
      linkKind: "tap",
      interaction_kind: "conversational",
      exercise: false,
    });
  });

  it("canonicalizes legacy product ids", () => {
    expect(canonicalizeProductIntentId("open_ended_explore")).toBe("explore_dialog");
    expect(canonicalizeProductIntentId("open_ended_drill")).toBe("explore_solo");
    expect(canonicalizeProductIntentId("timed_explore")).toBe("drill_dialog");
    expect(canonicalizeProductIntentId("timed_drill")).toBe("drill_solo");
    expect(resolveProductIntentFromId("open_ended_explore").product).toBe("ile");
    expect(resolveProductIntentFromId("timed_drill").product).toBe("tap");
  });

  it("exposes all four targets", () => {
    expect(allProductLaunchTargets()).toHaveLength(4);
    const ids = allProductLaunchTargets().map((t) => t.id);
    expect(ids).toEqual([
      "explore_dialog",
      "explore_solo",
      "drill_dialog",
      "drill_solo",
    ]);
  });
});

describe("structural: workspace + settings use Dialog/Solo axes", () => {
  it("BlockDetailCard uses Explore/Drill + Dialog/Solo, not ILE/TAP CTAs", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("product-intent");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).toContain("data-style-option={id}");
    expect(card).toContain('id: "explore"');
    expect(card).toContain('id: "drill"');
    expect(card).toContain("data-modality-toggle");
    expect(card).toContain("data-modality-option");
    expect(card).toContain("data-product-intent-modality-grid");
    expect(card).toContain("data-style-select");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");
    // Second axis: With AI / Solo buttons (not Open-ended/Timed switch)
    expect(card).toContain("modalityDialog");
    expect(card).toContain("modalitySolo");
    expect(card).toContain("data-modality-option={id}");
    expect(card).not.toMatch(/ILE · Learning Mode|ILE · Project Mode|Exercise TAP|Think Aloud Protocol/);
    expect(card).not.toContain('data-block-tool="ile-learning"');
    expect(card).not.toContain('data-block-tool="tap-exercise"');
  });

  it("WorkspaceGuestLinksPanel uses intent clusters; create still sets technical fields", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("productIntent");
    expect(panel).toContain("exploreDialog");
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
    // Accept either legacy rollup labels or Explore/Drill family labels
    const hasSessionLabels =
      dashboard.includes("Timed sessions") ||
      dashboard.includes("Drill sessions") ||
      dashboard.includes("Open-ended sessions") ||
      dashboard.includes("Explore sessions");
    expect(hasSessionLabels).toBe(true);
    expect(dashboard).not.toContain("TAP/ILE PoW not billed");

    const en = read("messages/en.json");
    // Must not reintroduce full technical product names as primary labels
    expect(en).not.toContain('"productIle": "Integrated Learning Environment"');
    expect(en).toMatch(/forkToEditBody.*practice sessions/);

    const grid = readMapGridSurface();
    expect(grid).not.toContain("double-click block for TAP/ILE");
    // Map chrome should not brand technical product names
    expect(grid).not.toMatch(/TAP\/ILE/);
  });

  it("labels never use TAP/ILE as product names", () => {
    const labels = Object.values(PRODUCT_INTENT_LABELS).join(" ");
    expect(labels).not.toMatch(/\bTAP\b|\bILE\b/);
  });

  it("second product axis is With AI / Solo buttons not Open-ended/Timed on authoring surfaces", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("modalityDialog");
    expect(card).toContain("modalitySolo");
    expect(card).toContain("data-modality-option");
    expect(card).toContain("data-product-intent-modality-grid");
    // Timebox switch as the product axis is retired
    expect(card).not.toContain("Timebox");
    expect(card).not.toContain("Open-ended session (no clock)");
    expect(card).not.toContain('role="switch"');

    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    expect(edit).toContain("With AI");
    expect(edit).toContain("Solo");
  });

  it("workspace TAP route accepts minutes and locks duration in the client", () => {
    const page = read("app/workspace/[id]/tap/page.tsx");
    expect(page).toContain("minutes");
    expect(page).toContain("initialMinutes");
    expect(page).toContain("lockDuration");
    const score = readTapScoreSurface();
    expect(score).toContain("lockDuration");
    expect(score).toContain("showDurationPicker={!privateToken && !durationLocked}");
    const exercise = readExerciseTapSurface();
    expect(exercise).toContain("lockDuration");
    expect(exercise).toContain("showDurationPicker={!privateToken && !durationLocked}");
  });
});

describe("evidence: product-intent remap log", () => {
  it("writes resolver matrix evidence", () => {
    const lines = [
      "explore_dialog=" + JSON.stringify(resolveProductIntent("explore", "dialog")),
      "explore_solo=" + JSON.stringify(resolveProductIntent("explore", "solo")),
      "drill_dialog=" + JSON.stringify(resolveProductIntent("drill", "dialog")),
      "drill_solo=" + JSON.stringify(resolveProductIntent("drill", "solo")),
      "legacy_open_ended_explore=" + canonicalizeProductIntentId("open_ended_explore"),
      "legacy_timed_drill=" + canonicalizeProductIntentId("timed_drill"),
    ];
    writeLog("product-intent-remap.log", lines.join("\n") + "\n");
    expect(existsSync(join(SCRATCH, "product-intent-remap.log"))).toBe(true);
  });
});
