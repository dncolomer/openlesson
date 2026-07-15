"use client";

import { useState, useCallback, useEffect } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useI18n } from "../lib/i18n";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { BlockDetailCard } from "./BlockDetailCard";
import { PublicWorkspaceForkCallout } from "./PublicWorkspaceForkCallout";

interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionItemProps {
  node: Block;
  index: number;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
  highlighted?: boolean;
  highlightOpacity?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  allNodes?: Block[];
  isOwner?: boolean;
  isGroupPlan?: boolean;
  maskProgress?: boolean;
  onRequestFork?: () => void;
  forkLoginHref?: string;
  isLoggedIn?: boolean;
  supabase?: ReturnType<typeof createBrowserClient>;
  onNavigateToNode?: (blockId: string) => void;
  planTopic?: string;
  workspaceId?: string;
  variant?: "compact" | "detail";
  detailLayout?: "inline" | "drawer";
  hideTap?: boolean;
  onCustomStart?: (node: Block) => Promise<void>;
}

export function SessionItem({
  node,
  index,
  onSelect,
  onDelete,
  onFork,
  highlighted,
  highlightOpacity = 1,
  isExpanded = false,
  onToggleExpand,
  isOwner = true,
  isGroupPlan = false,
  maskProgress = false,
  onRequestFork,
  forkLoginHref,
  isLoggedIn = false,
  supabase: propSupabase,
  planTopic,
  workspaceId,
  variant = "compact",
  detailLayout = "inline",
  hideTap = false,
  onCustomStart,
}: SessionItemProps) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase =
    propSupabase ||
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const isDetail = variant === "detail";

  const [isStarting, setIsStarting] = useState(false);
  const [editedPlanningPrompt, setEditedPlanningPrompt] = useState(node.planning_prompt || "");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string; status: string } | null>(null);
  const [aestheticImages, setAestheticImages] = useState<string[] | null>(null);
  const isCompleted = node.status === "completed";
  const isLocked = node.status === "locked";
  const isInProgress = node.status === "in_progress";
  useEffect(() => {
    setEditedPlanningPrompt(node.planning_prompt || "");
  }, [node.id, node.planning_prompt]);

  useEffect(() => {
    if (!isDetail) return;
    fetchAestheticPackages()
      .then((packages) => {
        const images = packages.flatMap((pkg) => pkg.images);
        if (images.length > 0) setAestheticImages(images);
      })
      .catch(() => {});
  }, [isDetail]);

  useEffect(() => {
    if (!node.session_id) return;
    supabase
      .from("sessions")
      .select("id, status")
      .eq("id", node.session_id)
      .single()
      .then(({ data }: { data: { id: string; status: string } | null }) => {
        if (data && (data.status === "active" || data.status === "paused")) {
          setActiveSession(data);
        }
      });
  }, [node.session_id, supabase]);

  const handleStart = async () => {
    if (isStarting || isLocked) return;
    if (activeSession) {
      router.push(`/session?id=${activeSession.id}`);
      return;
    }

    setIsStarting(true);
    try {
      if (onCustomStart) {
        await onCustomStart(node);
        return;
      }

      if (isGroupPlan && !isOwner) {
        const res = await fetch("/api/group-workspace/start-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            blockId: node.id,
            blockTitle: node.title,
            planningPrompt: editedPlanningPrompt || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start session");
        router.push(`/session?id=${data.session.id}`);
      } else {
        if (editedPlanningPrompt !== (node.planning_prompt || "")) {
          await supabase.from("blocks").update({ planning_prompt: editedPlanningPrompt || null }).eq("id", node.id);
        }
        await supabase.from("blocks").update({ status: "in_progress" }).eq("id", node.id);
        const { createSession } = await import("@/lib/storage");
        const session = await createSession(
          node.title,
          undefined,
          editedPlanningPrompt || undefined,
          undefined,
          workspaceId || undefined,
        );
        await supabase.from("blocks").update({ session_id: session.id }).eq("id", node.id);

        if (workspaceId) {
          await supabase.from("block_sessions").insert({
            block_id: node.id,
            session_id: session.id,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            workspace_id: workspaceId,
          });
        }

        router.push(`/session?id=${session.id}`);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsStarting(false);
    }
  };

  const handleStartGhl = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!workspaceId) return;
    const params = new URLSearchParams({ blockId: node.id });
    const contextualSessionId = activeSession?.id || node.session_id;
    if (contextualSessionId) params.set("sessionId", contextualSessionId);
    router.push(`/workspace/${workspaceId}/tap?${params.toString()}`);
  };

  const savePlanningPrompt = useCallback(async () => {
    if (editedPlanningPrompt === (node.planning_prompt || "")) return;
    setSavingPrompt(true);
    setPromptSaved(false);
    try {
      await supabase.from("blocks").update({ planning_prompt: editedPlanningPrompt || null }).eq("id", node.id);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save planning prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }, [editedPlanningPrompt, node.planning_prompt, node.id, supabase]);

  const handleClick = () => {
    if (onToggleExpand) onToggleExpand();
    else onSelect();
  };

  const detailButtonClass =
    "w-full rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40";
  const actionButtons = !isLocked && (isOwner || isGroupPlan) && (
    <div className={`flex gap-1.5 ${isDetail ? "w-[10.5rem] shrink-0 flex-col" : "pt-0.5"}`}>
      {isCompleted ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            void handleStart();
          }}
          disabled={isStarting}
          className={
            isDetail
              ? `${detailButtonClass} bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400`
              : "min-w-0 flex-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400"
          }
        >
          {isStarting ? t("sessionItem.starting") : t("sessionItem.runAgain")}
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            void handleStart();
          }}
          disabled={isStarting}
          className={
            isDetail
              ? `${detailButtonClass} bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400`
              : "min-w-0 flex-1 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400"
          }
        >
          {isStarting ? t("sessionItem.starting") : activeSession ? t("sessionItem.resumeLesson") : t("sessionItem.startLesson")}
        </button>
      )}
      {!hideTap ? (
        <button
          onClick={handleStartGhl}
          className={
            isDetail
              ? `${detailButtonClass} border border-neutral-600 bg-neutral-900/80 text-white hover:border-neutral-400 hover:bg-neutral-800`
              : "shrink-0 rounded-md border border-neutral-700/80 bg-neutral-900/50 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
          }
          title={t("sessionItem.startEvaluationEnv")}
        >
          {t("sessionItem.startEvaluationEnv")}
        </button>
      ) : null}
    </div>
  );

  const promptSection = isOwner && (
    <div className={isDetail ? "min-w-0 flex-1 rounded-md border border-neutral-800/70 bg-black/25 p-2.5" : ""}>
      {!isDetail && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPromptEditor(!showPromptEditor);
          }}
          className="text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
          title={t("sessionItem.customInstructionsLabel")}
        >
          {showPromptEditor ? "− " : "+ "}
          {t("sessionItem.customInstructionsLabel")}
          {savingPrompt && <span className="text-neutral-700"> · {t("sessionItem.saving")}</span>}
          {promptSaved && <span className="text-green-500/80"> · {t("sessionItem.saved")}</span>}
        </button>
      )}
      {isDetail && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-400">
            {t("sessionItem.customInstructionsLabel")}
          </span>
          <span className="text-xs text-neutral-500">
            {savingPrompt && t("sessionItem.saving")}
            {!savingPrompt && promptSaved && <span className="text-neutral-300">{t("sessionItem.saved")}</span>}
          </span>
        </div>
      )}
      {(isDetail || showPromptEditor) && (
        <textarea
          value={editedPlanningPrompt}
          onChange={(e) => setEditedPlanningPrompt(e.target.value)}
          onBlur={savePlanningPrompt}
          placeholder={t("sessionItem.customInstructions")}
          className={`w-full resize-none rounded-lg border bg-neutral-950/70 text-white placeholder:text-neutral-600 focus:outline-none ${
            isDetail
              ? "border-neutral-700/60 px-2.5 py-2 text-xs leading-relaxed focus:border-neutral-500"
              : "mt-1.5 border-neutral-700/50 px-2.5 py-1.5 text-xs focus:border-neutral-600"
          }`}
          rows={isDetail ? 3 : 2}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );

  if (isDetail) {
    const progressRing = maskProgress
      ? "neutral"
      : isCompleted
        ? "completed"
        : isInProgress
          ? "in_progress"
          : "neutral";
    const thumbnailSrc = aestheticImageForId(node.id, aestheticImages ?? undefined);
    const detailPromptSection = isOwner ? (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {t("sessionItem.customInstructionsLabel")}
          </span>
          <span className="text-[10px] text-neutral-500">
            {savingPrompt && t("sessionItem.saving")}
            {!savingPrompt && promptSaved && <span className="text-neutral-300">{t("sessionItem.saved")}</span>}
          </span>
        </div>
        <textarea
          value={editedPlanningPrompt}
          onChange={(e) => setEditedPlanningPrompt(e.target.value)}
          onBlur={savePlanningPrompt}
          placeholder={t("sessionItem.customInstructions")}
          className="w-full resize-none rounded-lg border border-white/15 bg-neutral-950/70 px-2.5 py-2 text-xs leading-relaxed text-white placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
          rows={4}
        />
      </div>
    ) : node.planning_prompt ? (
      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {t("sessionItem.customInstructionsLabel")}
        </p>
        <p className="text-xs leading-relaxed text-neutral-400">{node.planning_prompt}</p>
      </div>
    ) : null;

    return (
      <div id={`session-item-${node.id}`}>
        <BlockDetailCard
          key={node.id}
          layout={detailLayout === "drawer" ? "modal" : "horizontal"}
          title={node.title}
          description={node.description}
          thumbnailSrc={thumbnailSrc}
          progressRing={progressRing}
          isStart={node.is_start}
          evalLabel={t("sessionItem.evalCtaLabel")}
          isStarting={isStarting}
          isLocked={isLocked}
          showActions={!isLocked && (isOwner || isGroupPlan) && !maskProgress}
          onStartIle={() => void handleStart()}
          onStartEval={hideTap ? undefined : handleStartGhl}
          forkCallout={
            maskProgress && onRequestFork && forkLoginHref ? (
              <PublicWorkspaceForkCallout
                isLoggedIn={isLoggedIn}
                loginHref={forkLoginHref}
                onFork={onRequestFork}
                variant="dark"
              />
            ) : undefined
          }
          promptSection={detailLayout === "drawer" ? undefined : detailPromptSection}
          highlighted={highlighted}
          highlightOpacity={highlightOpacity}
        />
      </div>
    );
  }

  const dotColor = isCompleted
    ? "bg-green-400"
    : isInProgress
      ? "bg-yellow-400 animate-pulse"
      : isLocked
        ? "bg-neutral-600"
        : "bg-neutral-400";

  return (
    <div
      id={`session-item-${node.id}`}
      className={`rounded-md transition-all duration-200 ${
        highlighted ? "ring-1 ring-neutral-300/40" : ""
      } ${
        isExpanded
          ? "border border-neutral-700/50 bg-neutral-800/60 shadow-lg shadow-black/20"
          : "border border-transparent hover:-translate-y-[1px] hover:bg-neutral-800/30 hover:shadow-md hover:shadow-black/10"
      }`}
      style={
        highlighted
          ? {
              boxShadow: `0 0 12px rgba(6, 182, 212, ${highlightOpacity * 0.3})`,
            }
          : undefined
      }
    >
      <div onClick={handleClick} className="group cursor-pointer px-2.5 py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                isCompleted
                  ? "bg-green-500/15 text-green-400"
                  : isInProgress
                    ? "bg-yellow-500/15 text-yellow-400"
                    : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {isCompleted ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            {!isCompleted && (
              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#0b0b0b] ${dotColor}`} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <span
              className={`block truncate text-[13px] font-medium leading-tight ${
                isCompleted ? "text-neutral-400" : isLocked ? "text-neutral-500" : "text-white"
              }`}
            >
              {node.title}
            </span>
          </div>

          <svg
            className={`h-3.5 w-3.5 flex-shrink-0 text-neutral-600 transition-transform duration-200 group-hover:text-neutral-400 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="ml-8 space-y-2.5 border-t border-neutral-700/30 px-2.5 pb-2.5 pt-2.5">
          {node.description && <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{node.description}</p>}
          {promptSection}
          {actionButtons}
        </div>
      </div>
    </div>
  );
}