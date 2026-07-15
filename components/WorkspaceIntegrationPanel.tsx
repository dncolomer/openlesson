"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { slugifyIntegrationName } from "@/lib/agent-v2/integration-skill";
import { IntegrationQuickAccess } from "@/components/IntegrationQuickAccess";
import { readJsonResponse } from "@/lib/read-json-response";

interface WorkspaceIntegrationPanelProps {
  workspaceId: string;
  workspaceTitle: string;
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
  workspaceId,
  workspaceTitle,
  planTopic,
  planDescription,
  planNotes,
  isOwner,
  currentUserId,
}: WorkspaceIntegrationPanelProps) {
  const { t } = useI18n();
  const [integrationName, setIntegrationName] = useState(() =>
    slugifyIntegrationName(workspaceTitle || planTopic || "workspace")
  );
  const [evalDefinition, setEvalDefinition] = useState(
    () => planNotes?.trim() || planDescription?.trim() || planTopic || workspaceTitle || ""
  );
  const [generatingSkill, setGeneratingSkill] = useState(false);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [error, setError] = useState("");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://uncertain.systems";

  const handleDownloadSkill = async () => {
    if (!integrationName.trim()) return;
    setGeneratingSkill(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/integration-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          integration_name: integrationName.trim(),
          partner_description: planDescription || planNotes || planTopic,
          eval_definition: evalDefinition.trim(),
          integration_hints: {
            tool_name: integrationName.trim(),
            partner_agent: integrationName.trim(),
          },
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        code?: string;
        skill_md?: string;
      }>(res);
      if (!res.ok) {
        if (data.code === "teams_required" || data.code === "api_plan_required") {
          throw new Error(t("workspaceIntegration.teamsRequired"));
        }
        throw new Error(data.error || t("workspaceIntegration.errorGeneric"));
      }
      if (!data.skill_md) {
        throw new Error(t("workspaceIntegration.errorGeneric"));
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
      const res = await fetch("/api/workspace/proof-of-work-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          definition: evalDefinition.trim(),
          integration_hints: {
            tool_name: integrationName.trim(),
            partner_agent: integrationName.trim(),
          },
        }),
      });
      const data = await readJsonResponse<{ error?: string; code?: string }>(res);
      if (!res.ok) {
        if (data.code === "teams_required" || data.code === "api_plan_required") {
          throw new Error(t("workspaceIntegration.teamsRequired"));
        }
        throw new Error(data.error || t("workspaceIntegration.errorGeneric"));
      }
      const filename = `${integrationName.trim() || "workspace"}-proof-of-work-spec.json`;
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

  const skillSection = (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-white">{t("integrationAccess.skillTitle")}</h3>
        <p className="mt-1 text-sm text-neutral-400">{t("workspaceIntegration.skillSectionDescription")}</p>
        <p className="mt-2 text-xs text-neutral-500">{t("workspaceIntegration.generateHint")}</p>
      </div>

      <div>
        <label htmlFor="integration-name" className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
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
        <label htmlFor="eval-definition" className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
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

      <p className="text-xs text-neutral-500">
        {t("workspaceIntegration.apiKeyLink")} ·{" "}
        <Link href="/docs/proof-of-work-api" className="text-neutral-300 underline decoration-neutral-600 underline-offset-2 hover:text-white">
          {t("workspaceIntegration.docsLink")}
        </Link>
      </p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-medium text-white">{t("workspaceIntegration.title")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">{t("workspaceIntegration.description")}</p>
        </div>

        <IntegrationQuickAccess
          origin={origin}
          workspaceId={workspaceId}
          idPrefix={`workspace-${workspaceId}`}
          layout="stack"
          showHeader={false}
          skillSection={skillSection}
        />
      </div>
    </div>
  );
}