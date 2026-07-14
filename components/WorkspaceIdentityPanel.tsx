"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  GitBranch,
  Link2,
  MoreHorizontal,
  Pencil,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceIdentityPanelProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  copied: boolean;
  onShare: () => void;
  onPlanUpdate: (plan: Workspace) => void;
  onShowRemixModal: () => void;
  publicLoginHref: string;
  variant?: "embedded" | "compact" | "floating";
}

function planShareSlug(plan: Workspace) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan");
}

export function WorkspaceIdentityPanel({
  plan,
  workspaceId,
  isOwner,
  currentUserId,
  copied,
  onShare,
  onPlanUpdate,
  onShowRemixModal,
  publicLoginHref,
  variant = "embedded",
}: WorkspaceIdentityPanelProps) {
  const { t } = useI18n();
  const isCompact = variant === "compact";
  const isFloating = variant === "floating";
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(plan.title || plan.root_topic);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(plan.description || "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [isEditingConversionGoal, setIsEditingConversionGoal] = useState(false);
  const [editConversionGoal, setEditConversionGoal] = useState(plan.conversion_goal || "");
  const [savingConversionGoal, setSavingConversionGoal] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setEditTitle(plan.title || plan.root_topic);
  }, [plan.title, plan.root_topic]);

  useEffect(() => {
    setEditDescription(plan.description || "");
  }, [plan.description]);

  useEffect(() => {
    setEditConversionGoal(plan.conversion_goal || "");
  }, [plan.conversion_goal]);

  const showShare = plan.is_public || plan.is_group;
  const showFork =
    (isOwner && plan.is_public) ||
    (currentUserId && !isOwner && !plan.is_group) ||
    (!currentUserId && !plan.is_group);
  const showGroupParticipant = currentUserId && !isOwner && plan.is_group;
  const showSignInToJoin = !currentUserId && plan.is_group;

  const saveTitle = async () => {
    if (!editTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, root_topic: editTitle.trim(), title: editTitle.trim() });
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error("Error updating title:", err);
    }
  };

  const saveConversionGoal = async () => {
    setSavingConversionGoal(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversion_goal: editConversionGoal.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, conversion_goal: data.conversion_goal || undefined });
        setIsEditingConversionGoal(false);
      }
    } catch (err) {
      console.error("Error updating conversion goal:", err);
    } finally {
      setSavingConversionGoal(false);
    }
  };

  const saveDescription = async () => {
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, description: editDescription || undefined });
        setIsEditingDescription(false);
      }
    } catch (err) {
      console.error("Error updating description:", err);
    } finally {
      setSavingDescription(false);
    }
  };

  const toggleGroup = async () => {
    try {
      const isGroup = plan.is_group ?? false;
      const res = await fetch(`/api/workspaces/${workspaceId}/group`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_group: !isGroup }),
      });
      const data = await res.json();
      if (data.success) onPlanUpdate({ ...plan, is_group: !isGroup });
    } catch (err) {
      console.error("Error toggling group mode:", err);
    }
    setMenuOpen(false);
  };

  const togglePublic = async () => {
    try {
      const isPublic = plan.is_public ?? false;
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !isPublic }),
      });
      const data = await res.json();
      if (data.success) onPlanUpdate({ ...plan, is_public: !isPublic });
    } catch (err) {
      console.error("Error toggling visibility:", err);
    }
    setMenuOpen(false);
  };

  const iconButtonClass =
    "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white";

  const badges = (
    <>
      {plan.is_group && (
        <span className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300">
          {t("planView.group")}
        </span>
      )}
      {plan.is_public && (
        <span className="rounded border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400/90">
          {t("planView.public")}
        </span>
      )}
      {plan.is_public && (plan.remix_count ?? 0) > 0 && (
        <span className="text-[10px] text-neutral-500">
          {plan.remix_count}{" "}
          {(plan.remix_count || 0) === 1 ? t("planView.fork") : t("planView.forks", { count: plan.remix_count || 0 })}
        </span>
      )}
      {plan.original_workspace_id && (
        <span className="text-[10px] font-medium text-neutral-400">{t("planView.remixed")}</span>
      )}
    </>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      {showShare && (
        <button
          type="button"
          onClick={onShare}
          className={iconButtonClass}
          title={copied ? t("planView.copied") : t("planView.share")}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      )}

      {showFork &&
        (currentUserId ? (
          <button
            type="button"
            onClick={onShowRemixModal}
            className={iconButtonClass}
            title={t("planView.forkRemix")}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link href="/pricing" className={iconButtonClass} title={t("planView.forkRemix")}>
            <GitBranch className="h-3.5 w-3.5" />
          </Link>
        ))}

      {isOwner && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={iconButtonClass}
            title={t("planView.sectionAccess")}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-neutral-800 bg-neutral-950 py-1 shadow-xl">
                <button
                  type="button"
                  onClick={toggleGroup}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-900"
                >
                  <Users className="h-3.5 w-3.5" />
                  {plan.is_group ? t("planView.groupPlan") : t("planView.makeGroupPlan")}
                </button>
                <button
                  type="button"
                  onClick={togglePublic}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-900"
                >
                  {plan.is_public ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {plan.is_public ? t("planView.makePrivate") : t("planView.makePublic")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showGroupParticipant && (
        <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-neutral-300">
          {t("planView.groupParticipant")}
        </span>
      )}

      {showSignInToJoin && (
        <Link
          href={`/login?redirect=/p/${workspaceId}/${planShareSlug(plan)}`}
          className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-neutral-200 transition-all hover:bg-white/15"
        >
          {t("planView.signInToJoin")}
        </Link>
      )}
    </div>
  );

  return (
    <div
      className={`shrink-0 px-3 sm:px-4 ${
        isFloating
          ? "py-2.5"
          : isCompact
            ? "border-b border-neutral-800/60 bg-black/25 py-2 backdrop-blur-sm"
            : "border-b border-neutral-800/60 bg-black/25 py-2.5 backdrop-blur-sm"
      }`}
    >
      <div className={`flex items-start justify-between gap-3 ${isCompact ? "items-center" : ""}`}>
        <div className="min-w-0 flex-1 space-y-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm font-semibold text-white focus:border-neutral-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveTitle}
                className="rounded-md bg-white px-2.5 py-1.5 text-xs text-black hover:bg-neutral-200"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => {
                  setEditTitle(plan.title || plan.root_topic);
                  setIsEditingTitle(false);
                }}
                className="rounded-md px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className={`flex min-w-0 items-center gap-2 ${isCompact ? "flex-wrap" : ""}`}>
              <h1 className={`truncate font-semibold text-white ${isCompact ? "text-sm" : "text-base"}`}>
                {plan.title || plan.root_topic}
              </h1>
              {isOwner && (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="shrink-0 text-white/35 transition-colors hover:text-white"
                  title={t("common.edit")}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">{badges}</div>
            </div>
          )}

          {!isCompact && (plan.description || isOwner) && !isEditingDescription && (
            plan.description ? (
              <button
                type="button"
                onClick={() => {
                  if (isOwner) setIsEditingDescription(true);
                  else setDescriptionExpanded((open) => !open);
                }}
                className={`block max-w-3xl text-left text-xs leading-relaxed text-neutral-500 transition-colors hover:text-neutral-400 ${
                  descriptionExpanded ? "" : "line-clamp-1"
                }`}
              >
                {plan.description}
              </button>
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => setIsEditingDescription(true)}
                className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                {t("planView.addDescriptionBtn")}
              </button>
            ) : null
          )}

          {!isCompact && isEditingDescription && (
            <div className="max-w-2xl space-y-1.5">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t("planView.addDescription")}
                className="min-h-14 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white focus:border-neutral-400 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={saveDescription}
                  disabled={savingDescription}
                  className="font-medium text-neutral-200 hover:text-white"
                >
                  {savingDescription ? "..." : t("common.save")}
                </button>
                <button
                  onClick={() => {
                    setEditDescription(plan.description || "");
                    setIsEditingDescription(false);
                  }}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {!isCompact && !isEditingConversionGoal && (plan.conversion_goal || isOwner) && (
            <div className="flex max-w-3xl items-start gap-2">
              {plan.conversion_goal ? (
                <p className="text-xs leading-relaxed text-neutral-500">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                    Conversion goal
                  </span>
                  <span className="mt-1 block text-neutral-400">{plan.conversion_goal}</span>
                </p>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => setIsEditingConversionGoal(true)}
                  className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
                >
                  Set conversion goal
                </button>
              ) : null}
              {isOwner && plan.conversion_goal ? (
                <button
                  type="button"
                  onClick={() => setIsEditingConversionGoal(true)}
                  className="shrink-0 text-white/35 transition-colors hover:text-white"
                  title="Edit conversion goal"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          )}

          {!isCompact && isEditingConversionGoal && (
            <div className="max-w-2xl space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                Conversion goal
              </label>
              <input
                type="text"
                value={editConversionGoal}
                onChange={(e) => setEditConversionGoal(e.target.value)}
                placeholder="e.g. Trial-to-paid activation"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-white focus:border-neutral-400 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={saveConversionGoal}
                  disabled={savingConversionGoal}
                  className="font-medium text-neutral-200 hover:text-white"
                >
                  {savingConversionGoal ? "..." : t("common.save")}
                </button>
                <button
                  onClick={() => {
                    setEditConversionGoal(plan.conversion_goal || "");
                    setIsEditingConversionGoal(false);
                  }}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>

        {actions}
      </div>
    </div>
  );
}