"use client";

/**
 * Always-on-top mini window: compact TAP / Helios surface
 * (background layers + live turn + forming context + share CTA).
 */

import { useEffect, useState } from "react";
import {
  THOUGHT_BACKGROUND_IMAGES,
  ThoughtBackgroundLayers,
  type HeliosTurnMode,
} from "@/components/thought-ui/ThoughtUi";
import {
  ileCompactChapterTitle,
  ileMiniModeShareCtaLabel,
  resolveIleCompactTranscript,
  shouldShowIleMiniShareCta,
} from "@/lib/ile-compact-chrome";
import { ILE_HELIOS_THINKING_ROTATE_MS, resolveIleDialogueTurn } from "@/lib/ile-dialogue-turn";
import { ileCompactRootFillStyle } from "@/lib/ile-compact-window";

export type IleCompactStashItem = {
  id: string;
  text: string;
};

export function IleCompactStashWindow({
  chapterLabel,
  formingText,
  transcriptText,
  isSending = false,
  heliosTurnMode = "idle",
  isScreenSharing = false,
  onStartShare,
  backgroundImage,
}: {
  chapterLabel?: string | null;
  formingText?: string | null;
  transcriptText?: string | null;
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnMode | string | null;
  isScreenSharing?: boolean;
  onStartShare?: () => void;
  backgroundImage?: string | null;
}) {
  const title = ileCompactChapterTitle(chapterLabel);
  const turn = resolveIleDialogueTurn({ isSending, heliosTurnMode });
  const [thinkTick, setThinkTick] = useState(0);
  const bgImage = backgroundImage?.trim() || THOUGHT_BACKGROUND_IMAGES[0];
  const live = String(formingText || "").trim();
  const showShare = shouldShowIleMiniShareCta(isScreenSharing);
  useEffect(() => {
    if (turn.kind !== "waiting") {
      setThinkTick(0);
      return;
    }
    const id = window.setInterval(() => {
      setThinkTick((n) => n + 1);
    }, ILE_HELIOS_THINKING_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [turn.kind]);

  const transcript = resolveIleCompactTranscript({
    lastHeliosText: transcriptText,
    isSending,
    heliosTurnMode,
    thinkingIndex: thinkTick,
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
        }}
      >
        {title ? (
          <p
            data-ile-compact-chapter
            style={{
              margin: "0 0 8px",
              flexShrink: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#fafafa",
            }}
          >
            {title}
          </p>
        ) : null}

        <div
          data-ile-compact-helios
          data-ile-dialogue-compact
          data-ile-dialogue-speaker="helios"
          data-ile-dialogue-kind={turn.kind}
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            data-ile-compact-transcript
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              width: "100%",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.45,
              color: "#f5f5f5",
              textShadow: "0 1px 16px rgb(0 0 0 / 0.92)",
            }}
          >
            {transcript.text}
          </div>
        </div>

        {live ? (
          <div
            data-ile-compact-forming
            style={{
              flexShrink: 0,
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(10,10,10,0.55)",
              fontSize: 12,
              lineHeight: 1.4,
              color: "#e5e5e5",
            }}
          >
            {live}
          </div>
        ) : null}

        {showShare ? (
          <button
            type="button"
            data-ile-compact-share-cta
            onClick={() => onStartShare?.()}
            style={{
              marginTop: 10,
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
