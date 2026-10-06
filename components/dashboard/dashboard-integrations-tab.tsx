"use client";

import type { Dispatch, SetStateAction } from "react";
import { IntegrationQuickAccess } from "@/components/IntegrationQuickAccess";
import { default as Link } from "next/link";

interface AgentApiKey {
  id: string;
  key_prefix: string;
  label: string | null;
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  scopes?: string[];
}

export type DashboardIntegrationsTabProps = {
  apiKeys: AgentApiKey[];
  copyMcpText: (value: string, field: string) => Promise<void>;
  creatingKey: boolean;
  formatDate: (dateStr: string) => string;
  handleCreateApiKey: () => Promise<void>;
  handleDeleteApiKey: (id: string) => Promise<void>;
  keyCopied: boolean;
  mcpClientConfig: string;
  mcpCopiedField: string | null;
  mcpOrigin: string;
  newKeyName: string;
  newKeyValue: string | null;
  setKeyCopied: Dispatch<SetStateAction<boolean>>;
  setNewKeyName: Dispatch<SetStateAction<string>>;
  t: (key: string, params?: Record<string, string | number>) => string;
  usageCardClass: "console-copy rounded-none p-5 sm:p-6";
  usageLabelClass: "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
  usesAgenticV2Keys: boolean;
};

export function DashboardIntegrationsTab({
    apiKeys,
    copyMcpText,
    creatingKey,
    formatDate,
    handleCreateApiKey,
    handleDeleteApiKey,
    keyCopied,
    mcpClientConfig,
    mcpCopiedField,
    mcpOrigin,
    newKeyName,
    newKeyValue,
    setKeyCopied,
    setNewKeyName,
    t,
    usageCardClass,
    usageLabelClass,
    usesAgenticV2Keys,
}: DashboardIntegrationsTabProps) {
  return (
          <div className="space-y-8">
            <div className="console-copy flex flex-wrap items-center justify-between gap-3 px-6 py-5">
              <div>
                <p className={usageLabelClass}>Integrations</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">{t("dashboard.integrationsTab")}</h2>
                <p className="mt-1 text-sm text-neutral-500">{t("dashboard.integrationsSubtitle")}</p>
              </div>
              {usesAgenticV2Keys && (
                <Link
                  href="/docs/proof-of-work-api"
                  className="inline-flex h-10 items-center justify-center rounded-none border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                >
                  {t("dashboard.mcpDocsLink")} →
                </Link>
              )}
            </div>

            <div className={usageCardClass}>
              <IntegrationQuickAccess
                origin={mcpOrigin}
                apiKeyPlaceholder={newKeyValue || "YOUR_API_KEY"}
                showWorkspaceLevelNote
                idPrefix="dashboard"
              />
            </div>

            {/* Proof-of-Work API keys */}
            <div className={`${usageCardClass} space-y-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={usageLabelClass}>API keys</p>
                  <h2 className="mt-2 text-xl font-medium text-white">{t("dashboard.proofOfWorkApi")}</h2>
                </div>
                <div className="flex items-center gap-3">
                  {usesAgenticV2Keys && (
                    <Link
                      href="/docs/proof-of-work-api"
                      className="text-sm text-neutral-400 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
                    >
                      API docs →
                    </Link>
                  )}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                    {usesAgenticV2Keys ? "API Metered" : t("dashboard.experimental")}
                  </span>
                </div>
              </div>
              <p className="text-sm text-neutral-500">
                {usesAgenticV2Keys
                  ? t("dashboard.proofOfWorkApiDesc")
                  : t("dashboard.apiExperimentalDesc")}
              </p>
              {!usesAgenticV2Keys && (
                <div className="console-copy rounded-none p-4 text-sm text-neutral-400">
                  {`${t("dashboard.apiKeysAvailableOnPro")} `}
                  <Link href="/pricing" className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
                    {t("dashboard.upgradeToPro")}
                  </Link>{" "}
                  {t("dashboard.toCreateApiKeys")}
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t("dashboard.enterKeyName")}
                  className="flex-1 rounded-none border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                />
                <button
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="inline-flex h-10 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
                >
                  {creatingKey ? t("dashboard.creating") : t("dashboard.createNewKey")}
                </button>
              </div>

              {newKeyValue && (
                <div className="rounded-none border border-white/15 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-neutral-300">{t("dashboard.yourNewApiKey")}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newKeyValue);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      className="rounded-none border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                    >
                      {keyCopied ? t("common.copied") : t("common.copy")}
                    </button>
                  </div>
                  <code className="mt-3 block break-all rounded-none border border-neutral-800 bg-black p-3 font-mono text-xs text-neutral-300">
                    {newKeyValue}
                  </code>
                  {usesAgenticV2Keys ? (
                    <div className="mt-4 border-t border-neutral-800 pt-4">
                      <p className="text-xs text-neutral-400">{t("dashboard.mcpNewKeyConfig")}</p>
                      <pre className="mt-2 overflow-x-auto rounded-none border border-neutral-800 bg-black p-3 font-mono text-[11px] text-neutral-300">
                        {mcpClientConfig}
                      </pre>
                      <button
                        type="button"
                        onClick={() => void copyMcpText(mcpClientConfig, "mcp-new-key")}
                        className="mt-2 rounded-none border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                      >
                        {mcpCopiedField === "mcp-new-key"
                          ? t("common.copied")
                          : t("dashboard.mcpCopyConfig")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {apiKeys.length === 0 ? (
                <div className="rounded-none border border-dashed border-neutral-800 py-8 text-center text-sm text-neutral-500">
                  {t("dashboard.noApiKeysYet")}
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="console-copy flex items-center justify-between rounded-none p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200">
                          {key.label || t('dashboard.unnamedKey')}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                          {key.key_prefix}...
                        </p>
                        {key.scopes && key.scopes.length > 0 && (
                          <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                            {key.scopes.join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-neutral-600 mt-1">
                          {key.last_used_at
                            ? `Last used ${formatDate(key.last_used_at)}`
                            : "Not used yet"}
                          {" · "}
                          {t('dashboard.createdOn', { date: formatDate(key.created_at) })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-neutral-600">{t("dashboard.apiKeyRateLimit")}</p>
            </div>
          </div>
  );
}
