/**
 * Learning Calibrate entry: menu label, briefing, and live surface.
 * The stored launch id stays scout. The session does not mount the Prepare voice challenge.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_CIRCULAR_MENU_ACTIONS } from "@/lib/block-circular-menu";
import {
  CALIBRATE_DATA_DISABLED_LABEL,
  CALIBRATE_DONE_CLASSIFYING_LABEL,
  CALIBRATE_MODE_LABEL,
} from "@/lib/calibrate-session";
import { PRODUCT_INTENT_LABELS, productIntentClusterLabel, resolveProductIntent } from "@/lib/product-intent";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("learning Calibrate entry", () => {
  it("names the scout launch Calibrate and keeps the canvas procedure without a voice challenge", () => {
    expect(CALIBRATE_MODE_LABEL).toBe("Calibrate");
    expect(CALIBRATE_DONE_CLASSIFYING_LABEL).toBe("I'm done classifying");
    expect(CALIBRATE_DATA_DISABLED_LABEL).toBe("Disabled");

    expect(PRODUCT_INTENT_LABELS.styleScout).toBe(CALIBRATE_MODE_LABEL);
    expect(PRODUCT_INTENT_LABELS.scoutDialog).toBe(CALIBRATE_MODE_LABEL);
    expect(productIntentClusterLabel(resolveProductIntent("scout"))).toBe(CALIBRATE_MODE_LABEL);
    expect(PRODUCT_INTENT_LABELS.styleScout).not.toBe("Prepare");

    const prepareAction = WORKSPACE_CIRCULAR_MENU_ACTIONS.find((action) => action.id === "start_prepare");
    expect(prepareAction?.label).toBe(CALIBRATE_MODE_LABEL);
    expect(prepareAction?.id).toBe("start_prepare");

    const phases = read("components/scout-tap/scout-tap-phases.tsx");
    const surface = read("components/calibrate/calibrate-live-surface.tsx");
    const client = read("components/scout-tap/ScoutTapClient.tsx");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    const dictate = read("components/session-view/ile-canvas-dictate-button.tsx");
    const menu = read("lib/block-circular-menu.ts");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    const sessionItem = read("components/SessionItem.tsx");
    const edit = read("components/WorkspaceBlockEditPanel.tsx");
    const en = JSON.parse(read("messages/en.json")) as {
      onboardingGuide: { scout: { title: string } };
      scout: { briefing: { title: string; kicker: string; intro: string } };
      product?: { productIleHint?: string };
    };

    expect(menu).toContain('id: "start_prepare", label: "Calibrate"');
    expect(badges).toContain('"Calibrate"');
    expect(sessionItem).toContain('title="Start Calibrate"');
    expect(sessionItem).toContain("Calibrate");
    expect(edit).toContain(">Calibrate<");
    expect(edit).not.toContain(">Prepare<");
    expect(en.onboardingGuide.scout.title).toBe(CALIBRATE_MODE_LABEL);
    expect(en.scout.briefing.title).toBe(CALIBRATE_MODE_LABEL);
    expect(en.scout.briefing.kicker).toBe(CALIBRATE_MODE_LABEL);
    expect(en.scout.briefing.intro.toLowerCase()).toContain("no speaking");

    expect(phases).toContain("<CalibrateLiveSurface");
    expect(phases).toContain("onStart={() => void startSession()}");
    expect(phases).toContain("<TapBriefingConfig");
    expect(phases).not.toContain("PracticeVoiceChallenge");
    expect(phases).not.toContain('variant="prepare"');
    expect(phases).not.toContain("confirmPrepareStart");
    expect(phases).not.toContain("<TapSessionSignals");
    expect(client).toContain('interaction_kind: "scout"');
    expect(client).toContain('purpose: "calibrate"');
    expect(client).toContain("buildCalibrateProofMetadata");
    expect(client).toContain("buildCalibrateCompleteTranscript");
    expect(client).not.toContain("PracticeVoiceChallenge");
    expect(client).not.toContain("useSessionThoughtInterface");
    expect(client).not.toContain("seedScoutWorkCanvas");

    expect(surface).toContain("<SessionWorkSurface");
    expect(surface).toContain('mode="tap"');
    expect(surface).toContain("CALIBRATE_DONE_CLASSIFYING_LABEL");
    expect(surface).toContain("data-calibrate-done-classifying");
    expect(surface).toContain("dictateTranscript={transcript}");
    expect(surface).toContain("onDictateActive={onDictateActive}");
    expect(surface).toContain('data-calibrate-data="disabled"');
    expect(surface).toContain("CALIBRATE_DATA_DISABLED_LABEL");
    expect(surface).toContain("data-session-sidebar-signals");
    expect(surface).not.toContain("TapSessionSignals");
    expect(surface).not.toContain("getUserMedia");
    expect(surface).not.toContain("PracticeVoiceChallenge");
    expect(canvas).toContain("<IleCanvasDictateButton");
    expect(canvas).toContain("onActiveChange={onDictateActive}");
    expect(dictate).toContain("data-ile-canvas-dictate");
    expect(dictate).toContain("ILE_CANVAS_DICTATE_LABEL");
  });
});
