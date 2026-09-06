"use client";

/**
 * Always-on-top mini window: paints the same Chapter widget the ILE
 * session shows (dialogue + chapter actions), filling the PiP / popup.
 * Share your Screen sits in the PiP footer so leave-tab still has a
 * gesture to start getDisplayMedia.
 */

import type { ReactNode } from "react";
import { Monitor } from "lucide-react";
import { IleChapterPipFrame } from "@/components/session-view/ile-chapter-widget-frame";
import {
  ileMiniModeShareCtaLabel,
  runIleMiniShareCta,
  shouldShowIleMiniShareCta,
} from "@/lib/ile-compact-chrome";

export type IleCompactStashItem = {
  id: string;
  text: string;
};

export function IleCompactStashWindow({
  children,
  isScreenSharing = false,
  onStartShare,
}: {
  children: ReactNode;
  isScreenSharing?: boolean;
  onStartShare?: () => void | Promise<boolean | void>;
}) {
  const showShare = shouldShowIleMiniShareCta(isScreenSharing);
  const shareLabel = ileMiniModeShareCtaLabel();

  return (
    <IleChapterPipFrame
      footer={
        showShare ? (
          <button
            type="button"
            data-ile-compact-share-cta
            aria-label={shareLabel}
            onClick={() => {
              void runIleMiniShareCta({
                isScreenSharing,
                startScreenshare: () => onStartShare?.() ?? Promise.resolve(),
              });
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-neutral-900 outline outline-1 outline-offset-2 outline-white/70 transition hover:bg-neutral-50"
          >
            <Monitor className="size-3.5 shrink-0" aria-hidden />
            {shareLabel}
          </button>
        ) : null
      }
    >
      {children}
    </IleChapterPipFrame>
  );
}
