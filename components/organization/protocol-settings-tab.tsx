"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ProtocolSettingsEditor } from "@/components/organization/protocol-settings-editor";
import { useOrgProtocolStyle } from "@/components/organization/use-org-protocol-style";
import {
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
} from "@/components/product-flow/product-flow-form";
import { dashboardProtocolSettingsHref } from "@/lib/dashboard-nav";
import {
  nextUntitledProtocolSettingName,
  protocolSettingLocked,
} from "@/lib/organization/protocol-settings";

const chipClass =
  "console-chip px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-300";

/** Dashboard Protocol Settings: named styles list, then a prepare-board editor. */
export function ProtocolSettingsTab({ settingId }: { settingId?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const style = useOrgProtocolStyle();
  const editorId = String(settingId || "").trim();
  const { loading, selectedId, settings, selectSetting } = style;

  useEffect(() => {
    if (!editorId || loading) return;
    if (selectedId === editorId) return;
    const row = settings.find((item) => item.id === editorId);
    if (row) selectSetting(editorId);
  }, [editorId, loading, selectedId, selectSetting, settings]);

  const openSetting = (id: string) => {
    router.replace(dashboardProtocolSettingsHref(id), { scroll: false });
  };

  const closeEditor = () => {
    router.replace(dashboardProtocolSettingsHref(), { scroll: false });
  };

  if (style.loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <LoadingStatusMessage message={t("common.loading")} />
      </div>
    );
  }

  if (style.error) {
    return (
      <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <p className="text-sm text-neutral-400">{style.error}</p>
      </div>
    );
  }

  if (!style.hasOrganization) {
    return (
      <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <h2 className="text-2xl font-medium tracking-[-0.5px] text-white">
          {t("organization.protocolSettings")}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          {t("organization.noOrganizationDesc")}
        </p>
      </div>
    );
  }

  const canMutate = style.isOrgAdmin && style.tableAvailable;
  const canDelete = canMutate && style.settings.length > 1;
  const editing =
    Boolean(editorId) && style.settings.some((row) => row.id === editorId);

  if (editing) {
    return <ProtocolSettingsEditor key={editorId} style={style} onBack={closeEditor} />;
  }

  return (
    <div className="space-y-6" data-org-protocol-settings>
      <section className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
              {t("organization.protocolSettings")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
              {t("organization.protocolSettingsListHelper")}
            </p>
          </div>
          {canMutate ? (
            <button
              type="button"
              className={FLOW_PRIMARY_BTN}
              data-org-protocol-setting-new=""
              disabled={style.mutatingSettings}
              onClick={() => {
                void style
                  .handleCreateSetting(nextUntitledProtocolSettingName(style.settings))
                  .then((created) => {
                    if (created?.id) openSetting(created.id);
                  });
              }}
            >
              {t("organization.protocolSettingsNew")}
            </button>
          ) : null}
        </div>
      </section>

      {style.settings.length === 0 ? (
        <section className="console-copy px-6 py-14 sm:px-10 sm:py-16">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <h3 className="text-2xl font-medium tracking-[-0.8px] text-white">
              {t("organization.protocolSettingsEmptyTitle")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {t("organization.protocolSettingsEmptyHelper")}
            </p>
            {canMutate ? (
              <button
                type="button"
                className={`${FLOW_PRIMARY_BTN} mt-8 min-w-[220px]`}
                data-org-protocol-setting-empty-create=""
                disabled={style.mutatingSettings}
                onClick={() => {
                  void style
                    .handleCreateSetting(nextUntitledProtocolSettingName(style.settings))
                    .then((created) => {
                      if (created?.id) openSetting(created.id);
                    });
                }}
              >
                {t("organization.protocolSettingsNew")}
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="console-copy overflow-x-auto" data-org-protocol-settings-table="">
          <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[9.5rem]" />
              {style.isOrgAdmin ? <col className="w-[22rem]" /> : null}
            </colgroup>
            <thead>
              <tr className="border-b border-white/20 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3 font-medium">{t("organization.protocolSettingsName")}</th>
                <th className="px-4 py-3 font-medium">{t("organization.protocolSettingsDefault")}</th>
                {style.isOrgAdmin ? (
                  <th className="px-4 py-3 text-right font-medium">{t("organization.actions")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {style.settings.map((row) => (
                <tr
                  key={row.id || "default"}
                  data-org-protocol-setting-row={row.id || "default"}
                  className="border-b border-white/10 last:border-b-0"
                >
                  <td className="min-w-0 px-4 py-3">
                    <span className="block truncate font-medium text-white">{row.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.isDefault ? (
                      <span className={`${chipClass} text-white`}>
                        {t("organization.protocolSettingsDefault")}
                      </span>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  {style.isOrgAdmin ? (
                    <td className="px-4 py-3 text-right">
                      {row.id && protocolSettingLocked(row) ? (
                        <button
                          type="button"
                          className={FLOW_GHOST_BTN}
                          data-org-protocol-settings-view=""
                          onClick={() => openSetting(row.id)}
                        >
                          {t("organization.protocolSettingsView")}
                        </button>
                      ) : canMutate && row.id ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className={FLOW_GHOST_BTN}
                            data-org-protocol-settings-edit=""
                            disabled={style.mutatingSettings}
                            onClick={() => openSetting(row.id)}
                          >
                            {t("organization.protocolSettingsEdit")}
                          </button>
                          <button
                            type="button"
                            className={FLOW_GHOST_BTN}
                            disabled={style.mutatingSettings}
                            onClick={() => void style.handleSetDefault(row.id)}
                          >
                            {t("organization.protocolSettingsSetDefault")}
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              className={FLOW_GHOST_BTN}
                              disabled={style.mutatingSettings}
                              onClick={() => void style.handleDeleteSetting(row.id)}
                            >
                              {t("organization.protocolSettingsDelete")}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          {t("organization.protocolSettingsEditing")}
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
