"use client";

import { AudioMiniPreview } from "@/components/ToolsPanel";

/**
 * Signals shelf for Prepare, Drill, conversational TAP, and Verify.
 * Those flows do not capture EEG, screen, or webcam. The audio tile stays idle.
 */
export function TapSessionSignals() {
  return (
    <div data-ile-tools-widget data-session-sidebar-signals className="w-full min-w-0">
      <div data-ile-sensor-pair className="grid w-full max-w-[20rem] grid-cols-2 gap-1.5">
        <AudioMiniPreview stream={null} muted />
      </div>
    </div>
  );
}
