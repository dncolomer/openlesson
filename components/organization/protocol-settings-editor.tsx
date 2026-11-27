"use client";

import { useState } from "react";
import { CustomAestheticsStyler } from "@/components/organization/custom-aesthetics-styler";
import { ProtocolSettingsCanvasMock } from "@/components/organization/protocol-settings-canvas-mock";
import type { OrgProtocolStyleController } from "@/components/organization/use-org-protocol-style";
import {
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
} from "@/components/product-flow/product-flow-form";
import { useI18n } from "@/lib/i18n";
import { protocolSettingLocked } from "@/lib/organization/protocol-settings";

export function ProtocolSettingsEditor({
  style,
  onBack,
}: {
  style: OrgProtocolStyleController;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(style.selected?.name || "");
  const locked = protocolSettingLocked(style.selected);
  const canEdit = style.isOrgAdmin && !locked;

  return (
    <div
      className="flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-6rem)] lg:flex-row"
      data-org-protocol-settings-editor=""
    >
      <section
        className="console-copy relative min-h-[36rem] flex-1 overflow-hidden lg:min-h-0"
        data-org-protocol-settings-preview-frame=""
      >
        <div className="absolute inset-0">
          <ProtocolSettingsCanvasMock
            style={style.sidebarStyle}
            urls={locked ? [] : style.aestheticUrls}
            viewOnly={locked}
          />
        </div>
      </section>
      <aside
        className="console-copy flex w-full shrink-0 flex-col gap-4 overflow-y-auto px-4 py-4 lg:w-[18rem]"
        data-org-protocol-settings-rail=""
      >
        <div className="flex flex-col gap-2" data-org-protocol-settings-name="">
          <button
            type="button"
            className={`${FLOW_SECONDARY_BTN} w-full`}
            onClick={onBack}
            data-org-protocol-settings-back=""
          >
            {t("organization.protocolSettingsBack")}
          </button>
          {canEdit && style.selected?.id ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!style.selected?.id) return;
                void style.handleSaveSetting(style.selected.id, name);
              }}
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-org-protocol-setting-name=""
                className="h-12 w-full rounded-none border border-white/40 bg-black px-3 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none"
              />
              <button
                type="submit"
                className={`${FLOW_PRIMARY_BTN} w-full`}
                data-org-protocol-settings-save=""
                disabled={style.mutatingSettings || style.stylingSidebar || !name.trim()}
              >
                {t("organization.protocolSettingsSaveStyle")}
              </button>
            </form>
          ) : (
            <p className="text-sm text-white">{style.selected?.name}</p>
          )}
          {canEdit ? (
            <button
              type="button"
              className={`${FLOW_SECONDARY_BTN} w-full`}
              data-org-protocol-settings-reset-default=""
              disabled={style.stylingSidebar}
              onClick={() => void style.handleResetSidebarStyle()}
            >
              {t("organization.protocolSettingsResetToDefault")}
            </button>
          ) : null}
        </div>
        <div data-org-protocol-settings-editor-actions="">
          <CustomAestheticsStyler
              compact
              urls={locked ? [] : style.aestheticUrls}
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
              editable={canEdit}
              memberNote={
                locked
                  ? t("organization.protocolSettingsDefaultLocked")
                  : t("organization.protocolSettingsMemberNote")
              }
              labels={{
                kicker: t("organization.protocolSettings"),
                title: style.selected?.name || t("organization.protocolSettingsTitle"),
                helper: t("organization.protocolSettingsEditorHelper"),
                prompt: t("organization.sidebarStylePrompt"),
                promptPlaceholder: t("organization.sidebarStylePromptPlaceholder"),
                apply: t("organization.sidebarStyleApply"),
                applying: t("organization.sidebarStyleApplying"),
                reset: t("organization.protocolSettingsResetToDefault"),
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
      </aside>
    </div>
  );
}
