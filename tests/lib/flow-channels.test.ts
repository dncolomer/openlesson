import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_FLOW_ENFORCED_CHANNELS,
  FLOW_CHANNEL_IDS,
  FLOW_CHANNEL_LABELS,
  nextFlowEnforcedChannels,
  parseFlowEnforcedChannels,
  sessionEnforcedChannels,
  withEnforcedChannelsMetadata,
} from "@/lib/flow-channels";
import {
  emptyProductFlowDraft,
  flowAuthorShowsEnforcedChannels,
  nextProductFlowWizardStep,
  previousProductFlowWizardStep,
  PRODUCT_FLOW_WIZARD_STEPS,
  productFlowWizardCanAdvance,
  productFlowWizardSteps,
} from "@/lib/product-flow";
import { completeFlowEmbedding, powRowsForCanvasEmbedding } from "@/lib/flow-embedding";
import { scoredTapBriefingStep, prepareBriefingStep } from "@/lib/practice-voice-challenge";
import { isIleSpeechCaptureEnabled } from "@/lib/useSessionThoughtInterface";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("flow enforced channels", () => {
  it("defaults to Audio on for null or missing values", () => {
    expect(parseFlowEnforcedChannels(null)).toEqual(DEFAULT_FLOW_ENFORCED_CHANNELS);
    expect(parseFlowEnforcedChannels(undefined)).toEqual({
      audio: true,
      muse: false,
      video: false,
      screenshots: false,
    });
    expect(sessionEnforcedChannels(null).audio).toBe(true);
    expect(sessionEnforcedChannels({}).audio).toBe(true);
    expect(sessionEnforcedChannels({ enforcedChannels: { audio: false } }).audio).toBe(false);
  });

  it("keeps the current value when a PATCH omits channels", () => {
    const current = parseFlowEnforcedChannels({ audio: false, muse: true });
    expect(nextFlowEnforcedChannels(current, undefined)).toEqual(current);
    expect(nextFlowEnforcedChannels(current, { audio: true }).audio).toBe(true);
  });

  it("stamps session metadata with camelCase enforcedChannels", () => {
    const stamped = withEnforcedChannelsMetadata(
      { block_id: "b1" },
      parseFlowEnforcedChannels({ audio: false }),
    );
    expect(stamped.enforcedChannels).toEqual({
      audio: false,
      muse: false,
      video: false,
      screenshots: false,
    });
    expect(FLOW_CHANNEL_IDS).toEqual(["audio", "muse", "video", "screenshots"]);
    expect(FLOW_CHANNEL_LABELS.muse).toBe("Muse (EEG)");
  });

  it("inserts a channels step between model and publish", () => {
    expect(PRODUCT_FLOW_WIZARD_STEPS).toEqual([
      "name",
      "author",
      "model",
      "channels",
      "publish",
    ]);
    expect(nextProductFlowWizardStep("model")).toBe("channels");
    expect(nextProductFlowWizardStep("channels")).toBe("publish");
    expect(previousProductFlowWizardStep("publish")).toBe("channels");
    const draft = {
      ...emptyProductFlowDraft("solve"),
      name: "Limits",
      topic: "epsilon-delta limits",
    };
    expect(productFlowWizardCanAdvance("channels", draft)).toBe(true);
    expect(read("components/product-flow/product-flow-wizard.tsx")).toContain(
      "data-flow-channels-step",
    );
    expect(read("components/product-flow/flow-channels-fields.tsx")).toContain(
      "data-flow-channel",
    );
    expect(read("components/product-flow/flow-channels-fields.tsx")).toContain(
      "data-flow-canvas-capture",
    );
    expect(
      existsSync(join(root, "supabase/migrations/20261117120000_flow_enforced_channels.sql")),
    ).toBe(true);
  });

  it("shows enforced channels on Protocol authoring", () => {
    expect(flowAuthorShowsEnforcedChannels()).toBe(true);
    expect(flowAuthorShowsEnforcedChannels("calibration")).toBe(true);
    expect(productFlowWizardSteps()).toEqual([
      "name",
      "author",
      "model",
      "channels",
      "publish",
    ]);
    expect(nextProductFlowWizardStep("model")).toBe("channels");
    expect(previousProductFlowWizardStep("publish")).toBe("channels");
    expect(emptyProductFlowDraft().enforcedChannels).toEqual(
      DEFAULT_FLOW_ENFORCED_CHANNELS,
    );
    expect(read("components/product-flow/product-flow-wizard.tsx")).toContain(
      "data-flow-channels-step",
    );
  });

  it("skips the voice challenge when audio is not enforced", () => {
    expect(
      scoredTapBriefingStep({
        choice: "topic",
        challengePassed: false,
        audioEnforced: false,
      }),
    ).toBe("live");
    expect(
      prepareBriefingStep({
        startConfirmed: true,
        challengePassed: false,
        audioEnforced: false,
      }),
    ).toBe("live");
    expect(
      isIleSpeechCaptureEnabled({
        isRecording: true,
        isPaused: false,
        showWelcomePanel: false,
        audioEnforced: false,
      }),
    ).toBe(false);
  });

  it("drops spoken PoW so Path+Text matches Path when audio is off", () => {
    const pow = powRowsForCanvasEmbedding([
      { type: "tool", tool_name: "speech-segment", tool_action: "speech_stop", payload: "hello" },
      { type: "tool", tool_name: "tap-draw", tool_action: "draw", payload: "{}" },
    ]);
    expect(pow).toHaveLength(1);
    expect(pow[0]?.tool_name).toBe("tap-draw");
    const withSpeech = completeFlowEmbedding({
      flowKind: "solve",
      pow: [
        { type: "tool", tool_name: "speech-segment", tool_action: "speech_stop", payload: "hello" },
      ],
    });
    const canvasOnly = completeFlowEmbedding({
      flowKind: "solve",
      audioEnforced: false,
      pow: [
        { type: "tool", tool_name: "speech-segment", tool_action: "speech_stop", payload: "hello" },
      ],
    });
    expect(canvasOnly.vector_path_text).toEqual(canvasOnly.vector);
    expect(withSpeech.vector_path_text).not.toEqual(canvasOnly.vector_path_text);
  });
});
