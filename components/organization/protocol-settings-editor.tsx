"use client";

import { useMemo, useState } from "react";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import { CustomAestheticsStyler } from "@/components/organization/custom-aesthetics-styler";
import type { OrgProtocolStyleController } from "@/components/organization/use-org-protocol-style";
import {
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
} from "@/components/product-flow/product-flow-form";
import { useI18n } from "@/lib/i18n";
import { protocolSettingsPreviewScene } from "@/lib/organization/protocol-settings-preview";

export function ProtocolSettingsEditor({
  style,
  onBack,
}: {
  style: OrgProtocolStyleController;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(style.selected?.name || "");
  const initialScene = useMemo(() => protocolSettingsPreviewScene(), []);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-white/40 bg-black"
      data-org-protocol-settings-editor=""
    >
      <div
        className="absolute inset-x-3 top-3 z-20 max-h-[min(46vh,28rem)] overflow-y-auto border border-white/40 bg-black/90 p-3"
        data-org-protocol-settings-editor-actions=""
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={FLOW_SECONDARY_BTN}
            onClick={onBack}
            data-org-protocol-settings-back=""
          >
            {t("organization.protocolSettingsBack")}
          </button>
          {style.isOrgAdmin && style.selected?.id ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const next = name.trim();
                if (!next || !style.selected?.id) return;
                void style.handleRenameSetting(style.selected.id, next);
              }}
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-org-protocol-setting-rename=""
                className="h-12 min-w-0 flex-1 rounded-none border border-white/40 bg-black px-3 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none"
              />
              <button
                type="submit"
                className={FLOW_PRIMARY_BTN}
                disabled={style.mutatingSettings || !name.trim() || name.trim() === style.selected.name}
              >
                {t("organization.protocolSettingsRename")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-white">{style.selected?.name}</p>
          )}
        </div>
        <div className="mt-3">
          <CustomAestheticsStyler
            compact
            urls={style.aestheticUrls}
            style={style.sidebarStyle}
            prompt={style.sidebarPrompt}
            onPromptChange={style.setSidebarPrompt}
            uploading={style.uploadingAesthetics}
            generating={style.stylingSidebar}
            removingUrl={style.removingAestheticUrl}
            onUpload={(files) => void style.handleAestheticUpload(files)}
            onRemove={(url) => void style.handleRemoveAesthetic(url)}
            onCanvasChange={(canvas) => void style.handleCanvasStyle(canvas)}
            onGenerate={() => void style.handleStyleSidebar()}
            onReset={() => void style.handleResetSidebarStyle()}
            editable={style.isOrgAdmin}
            memberNote={t("organization.protocolSettingsMemberNote")}
            labels={{
              kicker: t("organization.protocolSettings"),
              title: style.selected?.name || t("organization.protocolSettingsTitle"),
              helper: t("organization.protocolSettingsEditorHelper"),
              prompt: t("organization.sidebarStylePrompt"),
              promptPlaceholder: t("organization.sidebarStylePromptPlaceholder"),
              apply: t("organization.sidebarStyleApply"),
              applying: t("organization.sidebarStyleApplying"),
              reset: t("organization.sidebarStyleReset"),
              upload: t("organization.uploadAesthetics"),
              uploading: t("organization.uploadingAesthetics"),
              empty: t("organization.noCustomAesthetics"),
              remove: t("organization.removeAesthetic"),
              removing: t("organization.removingAesthetic"),
              canvas: t("organization.canvasStyle"),
              canvasHelper: t("organization.canvasStyleHelper"),
              canvasBackground: t("organization.canvasBackground"),
              canvasStroke: t("organization.canvasStroke"),
              canvasZen: t("organization.canvasZenMode"),
              canvasGrid: t("organization.canvasGridMode"),
            }}
          />
        </div>
      </div>
      <div className="relative min-h-0 flex-1" data-ile-canvas-stage="">
        <div className="absolute inset-0 flex h-full min-h-0 w-full flex-col">
          <ExcalidrawCanvas
            boardId={`protocol-settings-${style.selected?.id || "preview"}`}
            sessionMarkMode="verification"
            sidebarStyle={style.sidebarStyle}
            liveCanvasChrome
            initialSceneData={initialScene}
          />
        </div>
      </div>
    </div>
  );
}
