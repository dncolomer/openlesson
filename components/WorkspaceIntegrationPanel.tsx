"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  knowledgeRegionIntegrationCopy,
  learningWorkspaceIntegrationCopy,
  slugifyIntegrationName,
} from "@/lib/pow-api/integration-skill";
import { IntegrationQuickAccess } from "@/components/IntegrationQuickAccess";
import { WorkspaceAccessSettings } from "@/components/WorkspaceAccessSettings";
import { WorkspaceAyclMarketplaceSettings } from "@/components/WorkspaceAyclMarketplaceSettings";
import { WorkspaceCopyToVerification } from "@/components/WorkspaceCopyToVerification";
import { WorkspaceIdentitySettings } from "@/components/WorkspaceIdentitySettings";
import { CustomVerificationModelsPanel } from "@/components/CustomVerificationModelsPanel";
import { WorkspaceDataStudioPanel } from "@/components/WorkspaceDataStudioPanel";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import { readJsonResponse } from "@/lib/read-json-response";
import { SECTION_TAB_CONTENT_CLASS } from "@/lib/workspace-section-surface";
import type { Workspace } from "@/components/WorkspaceView";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import {
  resolveSettingsSubview,
  settingsShowsMakePublic,
  settingsSubTabsForKind,
  type SettingsSubview,
} from "@/lib/workspace-settings-tabs";

interface WorkspaceIntegrationPanelProps {
  workspaceId: string;
  workspaceTitle: string;
  planTopic: string;
  planDescription?: string;
  planNotes?: string;
  isOwner: boolean;
  currentUserId: string | null;
  /** When provided, mounts public / group / Paid(AYCL) access controls. */
  plan?: Workspace;
  onPlanUpdate?: (plan: Workspace) => void;
  /** Optional initial Settings subtab (e.g. deep-link). */
  initialSubview?: SettingsSubview;
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
  plan,
  onPlanUpdate,
  initialSubview,
}: WorkspaceIntegrationPanelProps) {
  const { t } = useI18n();
  const [generatingSkill, setGeneratingSkill] = useState(false);
  const [error, setError] = useState("");
  const workspaceKind = plan?.workspace_kind;
  const [activeSubview, setActiveSubview] = useState<SettingsSubview>(() =>
    resolveSettingsSubview(initialSubview, plan?.workspace_kind),
  );

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://uncertain.systems";

  const skillSlug = slugifyIntegrationName(workspaceTitle || planTopic || "workspace");

  const subTabs = useMemo(
    () => settingsSubTabsForKind(workspaceKind, t),
    [t, workspaceKind],
  );

  const showMakePublic = settingsShowsMakePublic(workspaceKind);
  const isKnowledgeRegion = isKnowledgeRegionWorkspace(workspaceKind);

  const handleDownloadSkill = async () => {
    setGeneratingSkill(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/integration-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          // Name/eval derived server-side from live workspace title, notes, goal, blocks.
          partner_description: planDescription || planNotes || planTopic || undefined,
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
      downloadText(`${skillSlug}-skill.md`, data.skill_md, "text/markdown;charset=utf-8");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspaceIntegration.errorGeneric"));
    } finally {
      setGeneratingSkill(false);
    }
  };

  if (!currentUserId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-neutral-500">
          {t("workspaceIntegration.signInRequired")}
        </p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-neutral-500">
          {t("workspaceIntegration.ownerOnly")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-settings-layout="tabs"
      data-settings-panel
    >
      <WorkspaceSectionSubTabs
        activeId={activeSubview}
        onChange={setActiveSubview}
        tabs={subTabs}
        ariaLabel="Settings sections"
        dataAttr="settings"
      />

      <div className={SECTION_TAB_CONTENT_CLASS} data-settings-tab-body={activeSubview}>
        {activeSubview === "general" ? (
          <div className="space-y-4" data-settings-tab-panel="general">
            {plan && onPlanUpdate ? (
              <div data-settings-section="identity">
                <WorkspaceIdentitySettings
                  plan={plan}
                  workspaceId={workspaceId}
                  isOwner={isOwner}
                  onPlanUpdate={onPlanUpdate}
                />
              </div>
            ) : null}

            {plan && onPlanUpdate && showMakePublic ? (
              <div data-settings-section="access">
                <WorkspaceAccessSettings
                  plan={plan}
                  workspaceId={workspaceId}
                  isOwner={isOwner}
                  onPlanUpdate={onPlanUpdate}
                />
              </div>
            ) : null}

            {plan && onPlanUpdate && !isKnowledgeRegion ? (
              <WorkspaceCopyToVerification
                workspaceId={workspaceId}
                workspaceTitle={plan.title || plan.root_topic || ""}
                isOwner={isOwner}
              />
            ) : null}

            {!plan || !onPlanUpdate ? (
              <p className="text-xs text-neutral-500">
                Workspace identity and access settings are unavailable in this context.
              </p>
            ) : null}
          </div>
        ) : null}

        {activeSubview === "aycl" ? (
          <div className="space-y-4" data-settings-tab-panel="aycl">
            {plan && onPlanUpdate ? (
              <WorkspaceAyclMarketplaceSettings
                plan={plan}
                workspaceId={workspaceId}
                isOwner={isOwner}
                onPlanUpdate={onPlanUpdate}
              />
            ) : (
              <p className="text-xs text-neutral-500">
                AYCL marketplace settings are unavailable in this context.
              </p>
            )}
          </div>
        ) : null}

        {activeSubview === "regions" ? (
          <section
            className="space-y-3"
            data-settings-section="custom-knowledge-regions"
            data-settings-tab-panel="regions"
          >
            <div className="min-w-0 shrink-0">
              <h2 className="text-sm font-medium text-white">Knowledge Regions</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                Regions in knowledgecfg-v1-d64. Build them from verification flows, synthetic agents, or proof-of-work sources, then overlay them on Embeddings.
              </p>
            </div>
            <CustomVerificationModelsPanel
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              ayclToken={undefined}
              verificationWorkspace={isKnowledgeRegion}
            />
          </section>
        ) : null}

        {activeSubview === "data-studio" ? (
          <section
            className="space-y-3"
            data-settings-section="data-studio"
            data-settings-tab-panel="data-studio"
          >
            <h2 className="text-sm font-medium text-white">Data Studio</h2>
            <WorkspaceDataStudioPanel workspaceId={workspaceId} isOwner={isOwner} />
          </section>
        ) : null}

        {activeSubview === "integrations" ? (
          <div className="space-y-4" data-settings-tab-panel="integrations">
            <section className="space-y-3" data-settings-section="skill">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-white">
                    {t("workspaceIntegration.skillTitle")}
                  </h2>
                  <p
                    className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500"
                    data-kr-integration-skill={isKnowledgeRegion ? "true" : undefined}
                  >
                    {isKnowledgeRegion
                      ? knowledgeRegionIntegrationCopy().skillDescription
                      : learningWorkspaceIntegrationCopy().skillDescription}
                  </p>
                </div>
                {isKnowledgeRegion ? (
                  <Link
                    href="/docs/proof-of-work-api"
                    className="shrink-0 text-xs text-neutral-400 underline decoration-neutral-700 underline-offset-2 hover:text-neutral-200"
                  >
                    {t("workspaceIntegration.docsLink")}
                  </Link>
                ) : null}
              </div>

              <div className="space-y-2">
                {error ? <p className="text-xs text-red-400">{error}</p> : null}

                <button
                  type="button"
                  onClick={handleDownloadSkill}
                  disabled={generatingSkill}
                  className="w-full rounded-none bg-white px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 sm:w-auto"
                >
                  {generatingSkill
                    ? t("workspaceIntegration.generatingSkill")
                    : t("workspaceIntegration.downloadSkill")}
                </button>

                <p className="text-[11px] text-neutral-600">
                  {t("workspaceIntegration.generateHint")}
                </p>
                <p className="text-[11px] text-neutral-600">
                  {t("workspaceIntegration.apiKeyLink")}
                </p>
              </div>
            </section>

            <section className="space-y-3" data-settings-section="mcp">
              <p
                className="text-xs leading-relaxed text-neutral-500"
                data-kr-integration-mcp-note={isKnowledgeRegion ? "true" : undefined}
                data-learning-integration-mcp-note={isKnowledgeRegion ? undefined : "true"}
              >
                {isKnowledgeRegion
                  ? knowledgeRegionIntegrationCopy().mcpNote
                  : learningWorkspaceIntegrationCopy().mcpNote}
              </p>
              <IntegrationQuickAccess
                origin={origin}
                workspaceId={workspaceId}
                idPrefix={`workspace-${workspaceId}`}
                layout="stack"
                showHeader
                sections={["bearer", "oauth"]}
                workspaceKind={workspaceKind}
              />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
