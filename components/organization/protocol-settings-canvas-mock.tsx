"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { SessionCommandBridgeProvider } from "@/components/session-view/session-command-bridge";
import { SessionDataCard } from "@/components/session-view/session-data-card";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionTopicCard } from "@/components/session-view/learn-work-dock-bar";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { FALLBACK_AESTHETIC_IMAGES } from "@/lib/aesthetics";
import { protocolSettingsPreviewScene } from "@/lib/organization/protocol-settings-preview";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import {
  parseSessionCanvasStyle,
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const LiveExcalidrawCanvas = dynamic(
  () => import("@/components/ExcalidrawCanvas").then((mod) => mod.ExcalidrawCanvas),
  { ssr: false },
);

export function ProtocolSettingsCanvasMock({
  style,
  urls,
  viewOnly = false,
}: {
  style: SessionSidebarStyle;
  urls: readonly string[];
  viewOnly?: boolean;
}) {
  const initialScene = useMemo(() => protocolSettingsPreviewScene(), []);
  const boardStyle = useMemo(() => {
    const next = parseSessionSidebarStyle(style);
    if (viewOnly) {
      return { ...next, backgroundImage: null };
    }
    return {
      ...next,
      canvas: { ...parseSessionCanvasStyle(next.canvas), zenMode: false },
    };
  }, [style, viewOnly]);
  const brandStill = viewOnly
    ? ""
    : String(boardStyle.backgroundImage || urls[0] || "").trim();
  const topicUrls = brandStill ? [brandStill] : [];
  const systemImages =
    viewOnly || topicUrls.length === 0 ? FALLBACK_AESTHETIC_IMAGES : undefined;
  return (
    <div data-org-protocol-settings-preview className="flex h-full min-h-0 min-w-0 flex-1">
      <SessionCommandBridgeProvider>
        <SessionWorkSurface
          mode="verification-tap"
          stackBelow
          sidebarStyle={boardStyle}
          chapters={
            <SessionTopicCard
              key={brandStill || "system"}
              id="protocol-settings"
              title="Protocol"
              image={brandStill || null}
              customUrls={topicUrls}
              systemImages={systemImages}
              sidebarStyle={boardStyle}
            />
          }
          focus={<SessionGuidePanel guide="verification" inertCommands />}
          signals={
            <SessionDataCard
              audioEnabled={false}
              museEnabled={false}
              videoEnabled={false}
              screenEnabled={false}
            />
          }
          actions={
            <button
              type="button"
              data-ile-bar-save
              className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full`}
            >
              Exit
            </button>
          }
          stage={
            <LiveExcalidrawCanvas
              boardId="protocol-settings-preview"
              sidebarStyle={boardStyle}
              liveCanvasChrome
              viewModeEnabled={viewOnly}
              initialSceneData={initialScene}
            />
          }
        />
      </SessionCommandBridgeProvider>
    </div>
  );
}
