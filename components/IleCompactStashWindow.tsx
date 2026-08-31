"use client";

/**
 * Always-on-top mini window: paints the same Chapter widget the ILE
 * session shows (Helios + chapter actions), filling the PiP / popup.
 */

import type { ReactNode } from "react";
import { IleChapterPipFrame } from "@/components/session-view/ile-chapter-widget-frame";

export type IleCompactStashItem = {
  id: string;
  text: string;
};

export function IleCompactStashWindow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <IleChapterPipFrame>
      {children}
    </IleChapterPipFrame>
  );
}
