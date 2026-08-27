"use client";

/**
 * Always-on-top mini window: Share your Screen, I'm Done Answering,
 * and live forming/speech transcript.
 */

import {
  THOUGHT_BACKGROUND_IMAGES,
  ThoughtBackgroundLayers,
} from "@/components/thought-ui/ThoughtUi";
import {
  ileMiniModeDoneAnsweringLabel,
  ileMiniModeShareCtaLabel,
  resolveIleCompactTranscript,
  runIleMiniDoneAnswering,
  shouldShowIleMiniShareCta,
} from "@/lib/ile-compact-chrome";
import { ileCompactRootFillStyle } from "@/lib/ile-compact-window";

export type IleCompactStashItem = {
  id: string;
  text: string;
};

export function IleCompactStashWindow({
  formingText,
  speechDisplay,
  speechError = null,
  speechSupported = true,
  isListening = false,
  speechEnabled = true,
  isScreenSharing = false,
  onStartShare,
  onDoneAnswering,
  opener,
  tab,
  backgroundImage,
}: {
  formingText?: string | null;
  speechDisplay?: string | null;
  speechError?: string | null;
  speechSupported?: boolean | null;
  isListening?: boolean;
  speechEnabled?: boolean;
  isScreenSharing?: boolean;
  onStartShare?: () => void;
  onDoneAnswering?: () => void | Promise<void>;
  opener?: { focus?: () => void } | null;
  tab?: { focus?: () => void } | null;
  backgroundImage?: string | null;
}) {
  const bgImage = backgroundImage?.trim() || THOUGHT_BACKGROUND_IMAGES[0];
  const forming = String(formingText || "");
  const showShare = shouldShowIleMiniShareCta(isScreenSharing);
  const transcript = resolveIleCompactTranscript({
    formingText: forming,
    speechDisplay,
    speechError,
    speechSupported,
    isListening,
    speechEnabled,
  });

  return (
    <div
      data-ile-compact-stash
      data-ile-compact-anchor="bottom-right"
      data-ile-compact-always-on-top="true"
      data-ile-compact-tap
      style={{
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        ...ileCompactRootFillStyle(),
        overflow: "hidden",
        color: "#e5e5e5",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <ThoughtBackgroundLayers bgImage={bgImage} dimStrength="medium" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          padding: 12,
          gap: 10,
        }}
      >
        <div
          data-ile-compact-transcript
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflowX: "hidden",
            overflowY: "auto",
            textAlign: "left",
            fontSize: 13,
            lineHeight: 1.45,
            color: "#f5f5f5",
            textShadow: "0 1px 16px rgb(0 0 0 / 0.92)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {transcript.text || "\u00a0"}
        </div>

        <button
          type="button"
          data-ile-compact-done-answering
          data-ile-im-done-answering
          aria-label={ileMiniModeDoneAnsweringLabel()}
          onClick={() => {
            void runIleMiniDoneAnswering({
              closePath: () => onDoneAnswering?.() ?? Promise.resolve(),
              opener,
              tab,
            });
          }}
          style={{
            flexShrink: 0,
            width: "100%",
            border: "none",
            borderRadius: 0,
            padding: "10px 12px",
            background: "#fafafa",
            color: "#0a0a0a",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {ileMiniModeDoneAnsweringLabel()}
        </button>

        {showShare ? (
          <button
            type="button"
            data-ile-compact-share-cta
            onClick={() => onStartShare?.()}
            style={{
              flexShrink: 0,
              width: "100%",
              border: "none",
              borderRadius: 0,
              padding: "10px 12px",
              background: "#fafafa",
              color: "#0a0a0a",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {ileMiniModeShareCtaLabel()}
          </button>
        ) : null}
      </div>
    </div>
  );
}
