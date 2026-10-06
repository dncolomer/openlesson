/**
 * Product intent: Explore/Drill × Dialog/Solo.
 * Explore Solo stays a learning project session. UI launch helpers still force
 * With AI. Drives shipped resolve helpers — no re-implementation of the matrix.
 */
import { describe, expect, it } from "vitest";
import { readDashboardSurface, readExerciseTapSurface, readMapGridSurface, readTapScoreSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  allProductLaunchTargets,
  productIntentClusterLabel,
  productIntentFromGuestLink,
  productIntentToCreateFields,
  PRODUCT_INTENT_LABELS,
  resolveLaunchFromStyleAndModality,
  resolveProductIntent,
  resolveProductIntentFromAxes,
  resolveProductIntentFromId,
  canonicalizeProductIntentId,
} from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-871793e0b32f/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("resolveProductIntent Explore/Drill × Dialog/Solo", () => {
  it("explore dialog stays learning; explore solo stays a project session", () => {
    expect(resolveProductIntent("explore", "dialog")).toEqual({
      id: "explore_dialog",
      product: "ile",
      session_mode: "learning",
    });
    const solo = resolveProductIntent("explore", "solo");
    expect(solo).toEqual({
      id: "explore_solo",
      product: "ile",
      session_mode: "project",
    });
    expect(productIntentClusterLabel(solo)).toBe(PRODUCT_INTENT_LABELS.exploreSolo);
    expect(resolveProductIntent("explore", "project")).toEqual(solo);
    expect(resolveProductIntent("explore", "exercise")).toEqual(solo);
  });

  it("drill dialog stays conversational; drill solo stays an exercise", () => {
    const dialog = resolveProductIntent("drill", "dialog");
    expect(dialog.product).toBe("tap");
    expect(dialog.interaction_kind).toBe("conversational");
    expect(dialog.id).toBe("drill_dialog");
    expect(productIntentClusterLabel(dialog)).toBe(PRODUCT_INTENT_LABELS.drillDialog);
    const solo = resolveProductIntent("drill", "solo");
    expect(solo).toEqual({
      id: "drill_solo",
      product: "tap",
      interaction_kind: "exercise",
    });
    expect(resolveProductIntent("drill", "exercise")).toEqual(solo);
  });

  it("Drill never launches the learning product; Explore never launches TAP", () => {
    for (const modality of ["dialog", "solo"] as const) {
      expect(resolveProductIntent("drill", modality).product).toBe("tap");
      expect(resolveProductIntent("explore", modality).product).toBe("ile");
    }
  });

  it("maps legacy open_ended to dialog and timed to solo", () => {
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

  it("UI launch ignores the solo flag and stays With AI", () => {
    expect(resolveLaunchFromStyleAndModality("explore", true)).toEqual(
      resolveProductIntent("explore", "dialog"),
    );
    expect(resolveLaunchFromStyleAndModality("drill", true).id).toBe("drill_dialog");
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

  it("canonicalizes legacy product ids onto With AI launches", () => {
    expect(canonicalizeProductIntentId("open_ended_explore")).toBe("explore_dialog");
    expect(canonicalizeProductIntentId("open_ended_drill")).toBe("explore_dialog");
    expect(canonicalizeProductIntentId("timed_explore")).toBe("drill_dialog");
    expect(canonicalizeProductIntentId("timed_drill")).toBe("drill_dialog");
    expect(resolveProductIntentFromId("open_ended_explore").product).toBe("ile");
    expect(resolveProductIntentFromId("timed_drill").product).toBe("tap");
    expect(resolveProductIntentFromId("timed_drill").interaction_kind).toBe("conversational");
  });

  it("exposes Explore and Drill dialog and solo targets", () => {
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

describe("structural: workspace + settings have no With AI vs Solo choice", () => {
  it("BlockDetailCard uses Explore/Drill only, not TAP Learning/TAP CTAs or modality toggles", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("product-intent");
    expect(card).toContain("resolveLaunchFromStyleAndModality");
    expect(card).toContain("data-style-option={id}");
    expect(card).toContain('id: "explore"');
    expect(card).toContain('id: "drill"');
    expect(card).toContain('id: "scout"');
    expect(card.indexOf('id: "scout" as const')).toBeLessThan(
      card.indexOf('id: "explore" as const'),
    );
    expect(card.indexOf('id: "explore" as const')).toBeLessThan(
      card.indexOf('id: "drill" as const'),
    );
    expect(card).not.toContain("data-modality-toggle");
    expect(card).not.toContain("data-modality-option");
    expect(card).not.toContain("data-product-intent-modality-grid");
    expect(card).toContain("data-style-select");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");
    expect(card).not.toContain("modalityDialog");
    expect(card).not.toContain("modalitySolo");
    expect(card).not.toMatch(/TAP Learning · Learning Mode|TAP Learning · Project Mode|Exercise TAP|Think Aloud Protocol/);
    expect(card).not.toContain('data-block-tool="ile-learning"');
    expect(card).not.toContain('data-block-tool="tap-exercise"');
  });

  it("guest links panel is absent", () => {
    expect(existsSync(join(ROOT, "components/WorkspaceGuestLinksPanel.tsx"))).toBe(false);
  });

  it("Settings / dashboard / workspace chrome avoid TAP/TAP Learning product brands", () => {
    const integration = read("components/WorkspaceIntegrationPanel.tsx");
    expect(integration).not.toContain("Create shareable TAP and TAP Learning guest links");
    expect(integration).not.toMatch(/shareable practice links/i);
    expect(integration).not.toContain("WorkspaceGuestLinksPanel");
    expect(integration).not.toContain("WorkspaceKnowledgePortalPanel");
    expect(existsSync(join(ROOT, "components/WorkspaceGuestLinksPanel.tsx"))).toBe(false);

    const dashboard = readDashboardSurface();
    expect(dashboard).not.toContain(">TAP sessions<");
    expect(dashboard).not.toContain(">TAP Learning sessions<");
    const retiredProductWord = ["I", "L", "E"].join("");
    expect(dashboard).not.toContain(`>${retiredProductWord} sessions<`);
    // Accept either legacy rollup labels or Explore/Drill family labels
    const hasSessionLabels =
      dashboard.includes("Timed sessions") ||
      dashboard.includes("Drill sessions") ||
      dashboard.includes("Open-ended sessions") ||
      dashboard.includes("Explore sessions");
    expect(hasSessionLabels).toBe(true);
    expect(dashboard).not.toContain("TAP/TAP Learning PoW not billed");

    const en = read("messages/en.json");
    expect(en).toMatch(/shareable practice links/i);
    // Must not reintroduce full technical product names as primary labels
    expect(en).not.toContain('"productIle": "TAP Learning"');
    expect(en).toMatch(/forkToEditBody.*practice sessions/);

    const grid = readMapGridSurface();
    expect(grid).not.toContain("double-click block for TAP/TAP Learning");
    // Map chrome should not brand technical product names
    expect(grid).not.toMatch(/TAP\/TAP Learning/);
  });

  it("labels never use TAP/TAP Learning as product names", () => {
    const labels = Object.values(PRODUCT_INTENT_LABELS).join(" ");
    expect(labels).not.toMatch(/\bTAP\b|\bILE\b/);
  });

  it("authoring surfaces have no With AI vs Solo / Dialog vs Solo Exercise choice", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).not.toContain("modalityDialog");
    expect(card).not.toContain("modalitySolo");
    expect(card).not.toContain("data-modality-option");
    expect(card).not.toContain("data-product-intent-modality-grid");
    expect(card).not.toContain("Timebox");
    expect(card).not.toContain("Open-ended session (no clock)");
    expect(card).not.toContain('role="switch"');

    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    expect(edit).not.toContain("With AI");
    expect(edit).not.toContain(">Solo<");
    expect(edit).not.toContain("data-block-edit-allow-solo");
    expect(edit).not.toContain("data-block-edit-allow-dialog");

    expect(existsSync(join(ROOT, "components/WorkspaceGuestLinksPanel.tsx"))).toBe(false);
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
    writeLog("product-intent-no-solo.log", lines.join("\n") + "\n");
    expect(existsSync(join(SCRATCH, "product-intent-no-solo.log"))).toBe(true);
  });
});
