"use client";

import { useCallback } from "react";
import type { IleLeaveFocusReason } from "@/lib/ile-blur-screenshare";

/**
 * Leave-tab notification for the ILE session.
 * It does not open a picture-in-picture window or a popup.
 */
export function useIleBlurScreenshare(input: {
  enabled: boolean;
  isScreenSharing: boolean;
  startScreenshare: () => Promise<boolean | void>;
  onDoneAnswering?: () => void | Promise<void>;
  captureStream?: MediaStream | null;
}): {
  notifyLeaveTab: (reason: IleLeaveFocusReason) => void;
} {
  const notifyLeaveTab = useCallback((reason: IleLeaveFocusReason) => {
    void reason;
    void input.enabled;
    void input.isScreenSharing;
    void input.startScreenshare;
    void input.onDoneAnswering;
    void input.captureStream;
  }, [
    input.enabled,
    input.isScreenSharing,
    input.startScreenshare,
    input.onDoneAnswering,
    input.captureStream,
  ]);

  return { notifyLeaveTab };
}
