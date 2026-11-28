"use client";

import { useState } from "react";
import { ArrowLeft, Check, Contrast, Moon, RotateCcw, Sun } from "lucide-react";
import { CustomAestheticsStyler } from "@/components/organization/custom-aesthetics-styler";
import { ProtocolSettingsCanvasMock } from "@/components/organization/protocol-settings-canvas-mock";
import type { OrgProtocolStyleController } from "@/components/organization/use-org-protocol-style";
import { useI18n } from "@/lib/i18n";
import { protocolSettingLocked } from "@/lib/organization/protocol-settings";
import {
  matchingProtocolStylePreset,
  PROTOCOL_STYLE_PRESET_IDS,
  type ProtocolStylePresetId,
} from "@/lib/organization/protocol-style-presets";

const RAIL_ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-white/40 text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const RAIL_ICON_BTN_PRIMARY =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-white text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50";

const PRESET_ICONS = {
  dark: Moon,
  light: Sun,
  high_contrast: Contrast,
} as const;

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
  const brandStill =
    !locked && style.sidebarStyle.backgroundImage ? [style.sidebarStyle.backgroundImage] : [];
  const activePreset = matchingProtocolStylePreset(style.sidebarStyle);
  const presetLabel = (id: ProtocolStylePresetId) =>
    id === "dark"
      ? t("organization.protocolSettingsPresetDark")
      : id === "light"
        ? t("organization.protocolSettingsPresetLight")
        : t("organization.protocolSettingsPresetHighContrast");

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
            urls={brandStill}
            viewOnly={locked}
          />
        </div>
      </section>
      <aside
        className="console-copy flex w-full min-h-0 min-w-0 shrink-0 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3 py-3 lg:h-full lg:w-[18rem]"
        data-org-protocol-settings-rail=""
      >
        <div className="flex min-w-0 items-center gap-1" data-org-protocol-settings-name="">
          <button
            type="button"
            className={RAIL_ICON_BTN}
            onClick={onBack}
            data-org-protocol-settings-back=""
            aria-label={t("organization.protocolSettingsBack")}
            title={t("organization.protocolSettingsBack")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          {canEdit && style.selected?.id ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
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
                className="h-8 min-w-0 flex-1 rounded-none border border-white/40 bg-black px-2 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none"
              />
              <button
                type="submit"
                className={RAIL_ICON_BTN_PRIMARY}
                data-org-protocol-settings-save=""
                disabled={style.mutatingSettings || style.stylingSidebar || !name.trim()}
                aria-label={t("organization.protocolSettingsSaveStyle")}
                title={t("organization.protocolSettingsSaveStyle")}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm text-white">{style.selected?.name}</p>
          )}
          {canEdit ? (
            <button
              type="button"
              className={RAIL_ICON_BTN}
              data-org-protocol-settings-reset-default=""
              disabled={style.stylingSidebar}
              onClick={() => void style.handleResetSidebarStyle()}
              aria-label={t("organization.protocolSettingsResetToDefault")}
              title={t("organization.protocolSettingsResetToDefault")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {canEdit ? (
          <div className="min-w-0" data-org-protocol-settings-presets="">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              {t("organization.protocolSettingsPresets")}
            </p>
            <div className="mt-1.5 flex gap-1">
              {PROTOCOL_STYLE_PRESET_IDS.map((id) => {
                const Icon = PRESET_ICONS[id];
                const active = activePreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-org-protocol-settings-preset={id}
                    aria-pressed={active}
                    aria-label={presetLabel(id)}
                    title={presetLabel(id)}
                    disabled={style.stylingSidebar}
                    onClick={() => style.handleApplyPreset(id)}
                    className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-none border px-1 py-1.5 font-mono text-[9px] uppercase leading-tight tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-white bg-white text-black"
                        : "border-white/40 text-neutral-300 hover:border-white/80 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {presetLabel(id)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="min-w-0" data-org-protocol-settings-editor-actions="">
          <CustomAestheticsStyler
              compact
              urls={brandStill}
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
                apply: t("organization.protocolSettingsGenerate"),
                applying: t("organization.protocolSettingsGenerating"),
                reset: t("organization.protocolSettingsResetToDefault"),
                upload: t("organization.protocolSettingsUploadImage"),
                uploading: t("organization.protocolSettingsUploadingImage"),
                empty: t("organization.noCustomAesthetics"),
                remove: t("organization.removeAesthetic"),
                removing: t("organization.removingAesthetic"),
                canvas: t("organization.canvasStyle"),
                canvasHelper: t("organization.canvasStyleHelper"),
                canvasBackground: t("organization.canvasBackground"),
                canvasStroke: t("organization.canvasStroke"),
                canvasZen: t("organization.protocolSettingsZen"),
                canvasGrid: t("organization.protocolSettingsGrid"),
              }}
            />
        </div>
      </aside>
    </div>
  );
}
