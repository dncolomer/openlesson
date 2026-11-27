"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { SessionCommandBridgeProvider } from "@/components/session-view/session-command-bridge";
import { SessionDataCard } from "@/components/session-view/session-data-card";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionTopicCard } from "@/components/session-view/learn-work-dock-bar";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { protocolSettingsPreviewScene } from "@/lib/organization/protocol-settings-preview";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import type { SessionSidebarStyle } from "@/lib/session-sidebar-style";

const LiveExcalidrawCanvas = dynamic(
  () => import("@/components/ExcalidrawCanvas").then((mod) => mod.ExcalidrawCanvas),
  { ssr: false },
);

export function ProtocolSettingsCanvasMock({
  style,
  urls,
}: {
  style: SessionSidebarStyle;
  urls: readonly string[];
}) {
  const initialScene = useMemo(() => protocolSettingsPreviewScene(), []);
  return (
    <div data-org-protocol-settings-preview className="flex h-full min-h-0 min-w-0 flex-1">
      <SessionCommandBridgeProvider>
        <SessionWorkSurface
          mode="verification-tap"
          stackBelow
          sidebarStyle={style}
          chapters={
            <SessionTopicCard
              id="protocol-settings"
              title="Protocol"
              customUrls={urls}
              sidebarStyle={style}
            />
          }
          focus={<SessionGuidePanel guide="verification" />}
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
              sessionMarkMode="verification"
              sidebarStyle={style}
              liveCanvasChrome
              initialSceneData={initialScene}
            />
          }
        />
      </SessionCommandBridgeProvider>
    </div>
  );
}
