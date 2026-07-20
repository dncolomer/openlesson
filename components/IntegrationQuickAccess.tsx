"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  buildMcpClientConfig,
  buildMcpEndpointUrl,
  buildMcpOAuthClientConfig,
  buildMcpOAuthDiscovery,
  buildSkillFileUrl,
} from "@/lib/agent-v2/mcp-proof-of-work-catalog";

type IntegrationSection = "skill" | "bearer" | "oauth";

type IntegrationQuickAccessProps = {
  origin: string;
  apiKeyPlaceholder?: string;
  workspaceId?: string;
  showWorkspaceLevelNote?: boolean;
  idPrefix?: string;
  layout?: "grid" | "stack";
  showHeader?: boolean;
  sections?: IntegrationSection[];
  skillSection?: ReactNode;
};

export function IntegrationQuickAccess({
  origin,
  apiKeyPlaceholder = "YOUR_API_KEY",
  workspaceId,
  showWorkspaceLevelNote = false,
  idPrefix = "integration",
  layout = "grid",
  showHeader = true,
  sections = ["skill", "bearer", "oauth"],
  skillSection,
}: IntegrationQuickAccessProps) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const skillUrl = useMemo(() => buildSkillFileUrl(origin), [origin]);
  const mcpEndpointUrl = useMemo(() => buildMcpEndpointUrl(origin), [origin]);
  const bearerConfig = useMemo(
    () => buildMcpClientConfig(origin, apiKeyPlaceholder),
    [origin, apiKeyPlaceholder]
  );
  const oauthConfig = useMemo(() => buildMcpOAuthClientConfig(origin), [origin]);
  const oauthDiscovery = useMemo(
    () => JSON.stringify(buildMcpOAuthDiscovery(origin), null, 2),
    [origin]
  );

  const copyText = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const cardClass =
    layout === "stack"
      ? "rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-5 flex flex-col gap-4"
      : "rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4 flex flex-col gap-3 h-full";
  const buttonClass =
    "rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white";
  const codeClass =
    "block overflow-x-auto rounded border border-neutral-800 bg-black/50 px-2 py-2 font-mono text-[11px] text-neutral-300 break-all";
  const sectionTitleClass =
    layout === "stack"
      ? "text-sm font-medium text-white"
      : "text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600";

  const copyLabel = (field: string) =>
    copiedField === field ? t("integrationAccess.copied") : t("common.copy");

  const showSkill = sections.includes("skill");
  const showBearer = sections.includes("bearer");
  const showOAuth = sections.includes("oauth");

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div>
          <h3 className="text-base font-medium text-white">{t("integrationAccess.quickStartTitle")}</h3>
          <p className="mt-1 text-sm text-neutral-500">{t("integrationAccess.quickStartSubtitle")}</p>
        </div>
      ) : null}

      {showWorkspaceLevelNote ? (
        <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100/90">
          {t("integrationAccess.workspaceLevelNote")}
        </div>
      ) : null}

      {workspaceId ? (
        <p className="text-xs text-neutral-500">
          {t("integrationAccess.mcpWorkspaceHint", { workspaceId })}
        </p>
      ) : null}

      <div className={layout === "stack" ? "flex flex-col gap-5" : "grid gap-4 lg:grid-cols-3"}>
        {showSkill ? (
          skillSection ? (
            <div className={cardClass}>{skillSection}</div>
          ) : (
            <div className={cardClass}>
              <div>
                <p className={sectionTitleClass}>{t("integrationAccess.skillTitle")}</p>
                <p className="mt-2 text-sm text-neutral-400">{t("integrationAccess.skillDescription")}</p>
              </div>
              <code className={codeClass}>{skillUrl}</code>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href="/skill.md" className={buttonClass}>
                  {t("integrationAccess.skillOpen")}
                </Link>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void copyText(skillUrl, `${idPrefix}-skill-url`)}
                >
                  {copyLabel(`${idPrefix}-skill-url`)}
                </button>
              </div>
            </div>
          )
        ) : null}

        {showBearer ? (
          <div className={cardClass}>
            <div>
              <p className={sectionTitleClass}>{t("integrationAccess.mcpBearerTitle")}</p>
              <p className="mt-2 text-sm text-neutral-400">{t("integrationAccess.mcpBearerDescription")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600">
                {t("integrationAccess.mcpBearerEndpoint")}
              </p>
              <code className={`${codeClass} mt-1`}>{mcpEndpointUrl}</code>
            </div>
            <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-neutral-500">
              {`Authorization: Bearer ${apiKeyPlaceholder}`}
            </pre>
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => void copyText(mcpEndpointUrl, `${idPrefix}-bearer-endpoint`)}
              >
                {copiedField === `${idPrefix}-bearer-endpoint`
                  ? t("integrationAccess.copied")
                  : t("integrationAccess.mcpBearerCopyEndpoint")}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void copyText(bearerConfig, `${idPrefix}-bearer-config`)}
              >
                {copiedField === `${idPrefix}-bearer-config`
                  ? t("integrationAccess.copied")
                  : t("integrationAccess.mcpBearerCopyConfig")}
              </button>
            </div>
          </div>
        ) : null}

        {showOAuth ? (
          <div className={cardClass}>
            <div>
              <p className={sectionTitleClass}>{t("integrationAccess.mcpOAuthTitle")}</p>
              <p className="mt-2 text-sm text-neutral-400">{t("integrationAccess.mcpOAuthDescription")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600">
                {t("integrationAccess.mcpOAuthServerUrl")}
              </p>
              <code className={`${codeClass} mt-1`}>{mcpEndpointUrl}</code>
            </div>
            <p className="text-xs text-neutral-500">{t("integrationAccess.mcpOAuthHint")}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => void copyText(mcpEndpointUrl, `${idPrefix}-oauth-url`)}
              >
                {copiedField === `${idPrefix}-oauth-url`
                  ? t("integrationAccess.copied")
                  : t("integrationAccess.mcpOAuthCopyUrl")}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void copyText(oauthConfig, `${idPrefix}-oauth-config`)}
              >
                {copiedField === `${idPrefix}-oauth-config`
                  ? t("integrationAccess.copied")
                  : t("integrationAccess.mcpOAuthCopyConfig")}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void copyText(oauthDiscovery, `${idPrefix}-oauth-discovery`)}
              >
                {copiedField === `${idPrefix}-oauth-discovery`
                  ? t("integrationAccess.copied")
                  : t("integrationAccess.mcpOAuthCopyDiscovery")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}