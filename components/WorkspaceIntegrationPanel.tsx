"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { slugifyIntegrationName } from "@/lib/agent-v2/integration-skill";

interface WorkspaceIntegrationPanelProps {
  planId: string;
  planTitle: string;
  planTopic: string;
  planDescription?: string;
  planNotes?: string;
  isOwner: boolean;
  currentUserId: string | null;
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceIntegrationPanel({
  planId,
  planTitle,
  planTopic,
  planDescription,
  planNotes,
  isOwner,
  currentUserId,
}: WorkspaceIntegrationPanelProps) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [integrationName, setIntegrationName] = useState(() =>
    slugifyIntegrationName(planTitle || planTopic || "workspace")
  );
  const [evalDefinition, setEvalDefinition] = useState(
    () => planNotes?.trim() || planDescription?.trim() || planTopic || planTitle || ""
  );
  const [generatingSkill, setGeneratingSkill] = useState(false);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [error, setError] = useState("");

  const basePath = "/api/v2/agent";
  const workspacePath = `${basePath}/workspaces/${planId}`;

  const endpoints = useMemo(
    () => [
      { method: "GET", path: `${workspacePath}/blocks`, note: t("workspaceIntegration.endpointBlocks") },
      { method: "POST", path: `${workspacePath}/evidence-schema`, note: t("workspaceIntegration.endpointSchema") },
      { method: "POST", path: `${workspacePath}/integration-skill`, note: t("workspaceIntegration.endpointSkill") },
      { method: "POST", path: `${workspacePath}/evidence`, note: t("workspaceIntegration.endpointEvidence") },
      { method: "POST", path: `${workspacePath}/performance`, note: t("workspaceIntegration.endpointPerformance") },
    ],
    [workspacePath, t]
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

  const handleDownloadSkill = async () => {
    if (!integrationName.trim()) return;
    setGeneratingSkill(true);
    setError("");
    try {
      const res = await fetch("/api/learning-plan/integration-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          integration_name: integrationName.trim(),
          partner_description: planDescription || planNotes || planTopic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "teams_required") {
          throw new Error(t("workspaceIntegration.teamsRequired"));
        }
        throw new Error(data.error || t("workspaceIntegration.errorGeneric"));
      }
      const filename = `${integrationName.trim()}-skill.md`;
      downloadText(filename, data.skill_md, "text/markdown;charset=utf-8");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspaceIntegration.errorGeneric"));
    } finally {
      setGeneratingSkill(false);
    }
  };

  const handleDownloadSpec = async () => {
    if (!evalDefinition.trim()) return;
    setGeneratingSpec(true);
    setError("");
    try {
      const res = await fetch("/api/learning-plan/evidence-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          definition: evalDefinition.trim(),
          integration_hints: {
            tool_name: integrationName.trim(),
            partner_agent: integrationName.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "teams_required") {
          throw new Error(t("workspaceIntegration.teamsRequired"));
        }
        throw new Error(data.error || t("workspaceIntegration.errorGeneric"));
      }
      const filename = `${integrationName.trim() || "workspace"}-evidence-spec.json`;
      downloadText(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspaceIntegration.errorGeneric"));
    } finally {
      setGeneratingSpec(false);
    }
  };

  if (!currentUserId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-neutral-500">{t("workspaceIntegration.signInRequired")}</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-neutral-500">{t("workspaceIntegration.ownerOnly")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-medium text-white">{t("workspaceIntegration.title")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{t("workspaceIntegration.description")}</p>
        </div>

        <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">
            {t("workspaceIntegration.workspaceId")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded border border-neutral-800 bg-black/50 px-2 py-1 font-mono text-xs text-neutral-300">
              {planId}
            </code>
            <button
              type="button"
              onClick={() => copyText(planId, "workspace-id")}
              className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              {copiedField === "workspace-id" ? t("workspaceIntegration.copied") : t("workspaceIntegration.copyId")}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/docs/agentic-v2"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              {t("workspaceIntegration.docsLink")}
            </Link>
            <Link
              href="/dashboard?tab=usage"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              {t("workspaceIntegration.apiKeyLink")}
            </Link>
            <Link
              href="/skill.md"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              {t("workspaceIntegration.skillFileLink")}
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4">
          <h3 className="text-sm font-medium text-white">{t("workspaceIntegration.endpointsTitle")}</h3>
          <p className="mt-1 text-xs text-neutral-500">{t("workspaceIntegration.endpointsHint")}</p>
          <div className="mt-3 space-y-2">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="rounded-md border border-neutral-800/70 bg-black/30 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-neutral-300">
                    {endpoint.method}
                  </span>
                  <code className="font-mono text-xs text-neutral-300">{endpoint.path}</code>
                  <button
                    type="button"
                    onClick={() => copyText(endpoint.path, endpoint.path)}
                    className="ml-auto text-[10px] text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    {copiedField === endpoint.path ? t("workspaceIntegration.copied") : t("workspaceIntegration.copyPath")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{endpoint.note}</p>
              </div>
            ))}
          </div>
          <pre className="mt-4 overflow-x-auto rounded-md border border-neutral-800 bg-black/50 p-3 font-mono text-[11px] text-neutral-400">
{`Authorization: Bearer <api_key>
Content-Type: application/json`}
          </pre>
        </div>

        <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-4 space-y-4">
          <div>
            <label htmlFor="integration-name" className="text-sm font-medium text-white">
              {t("workspaceIntegration.integrationName")}
            </label>
            <input
              id="integration-name"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
              placeholder={t("workspaceIntegration.integrationNamePlaceholder")}
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="eval-definition" className="text-sm font-medium text-white">
              {t("workspaceIntegration.evalDefinition")}
            </label>
            <textarea
              id="eval-definition"
              value={evalDefinition}
              onChange={(e) => setEvalDefinition(e.target.value)}
              placeholder={t("workspaceIntegration.evalDefinitionPlaceholder")}
              rows={4}
              className="mt-2 w-full resize-y rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
            />
          </div>

          <p className="text-xs text-neutral-500">{t("workspaceIntegration.generateHint")}</p>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadSkill}
              disabled={generatingSkill || !integrationName.trim()}
              className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {generatingSkill ? t("workspaceIntegration.generatingSkill") : t("workspaceIntegration.downloadSkill")}
            </button>
            <button
              type="button"
              onClick={handleDownloadSpec}
              disabled={generatingSpec || !evalDefinition.trim()}
              className="flex-1 rounded-md border border-neutral-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-neutral-400 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
            >
              {generatingSpec ? t("workspaceIntegration.generatingSpec") : t("workspaceIntegration.downloadSpec")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}