"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useI18n } from "../lib/i18n";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionItemProps {
  node: PlanNode;
  index: number;
  onSelect: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
  highlighted?: boolean;
  highlightOpacity?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  allNodes?: PlanNode[];
  isOwner?: boolean;
  isGroupPlan?: boolean;
  supabase?: ReturnType<typeof createBrowserClient>;
  onNavigateToNode?: (nodeId: string) => void;
  planTopic?: string;
  planId?: string;
}

export function SessionItem({ 
  node, index, onSelect, onDelete, onFork, 
  highlighted, highlightOpacity = 1,
  isExpanded = false, onToggleExpand,
  allNodes = [], isOwner = true, isGroupPlan = false,
  supabase: propSupabase, onNavigateToNode, planTopic, planId
}: SessionItemProps) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = propSupabase || createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isStarting, setIsStarting] = useState(false);
  const [editedPlanningPrompt, setEditedPlanningPrompt] = useState(node.planning_prompt || "");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isCompleted = node.status === "completed";
  const isLocked = node.status === "locked";
  const isInProgress = node.status === "in_progress";
  const [activeSession, setActiveSession] = useState<{ id: string; status: string } | null>(null);

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

  const nextNodes = (node.next_node_ids || []).map(id => allNodes.find(n => n.id === id)).filter(Boolean) as PlanNode[];

  const handleStart = async () => {
    if (isStarting || isLocked) return;
    if (activeSession) { router.push(`/session?id=${activeSession.id}`); return; }

    setIsStarting(true);
    try {
      if (isGroupPlan && !isOwner) {
        // Group plan participant: use the dedicated API
        const res = await fetch("/api/group-plan/start-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            nodeId: node.id,
            nodeTitle: node.title,
            planningPrompt: editedPlanningPrompt || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to start session");
        }
        if (data.resumed) {
          router.push(`/session?id=${data.session.id}`);
        } else {
          router.push(`/session?id=${data.session.id}`);
        }
      } else {
        // Owner path: original flow
        if (editedPlanningPrompt !== (node.planning_prompt || "")) {
          await supabase.from("plan_nodes").update({ planning_prompt: editedPlanningPrompt || null }).eq("id", node.id);
        }
        await supabase.from("plan_nodes").update({ status: "in_progress" }).eq("id", node.id);
        const { createSession } = await import("@/lib/storage");
        const session = await createSession(node.title, undefined, editedPlanningPrompt || undefined, undefined, planId || undefined);
        await supabase.from("plan_nodes").update({ session_id: session.id }).eq("id", node.id);

        // Also record in plan_node_sessions for consistency (owner's sessions too)
        if (planId) {
          await supabase.from("plan_node_sessions").insert({
            plan_node_id: node.id,
            session_id: session.id,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            plan_id: planId,
          }).then(() => {});
        }

        router.push(`/session?id=${session.id}`);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsStarting(false);
    }
  };

  const savePlanningPrompt = useCallback(async () => {
    if (editedPlanningPrompt === (node.planning_prompt || "")) return;
    setSavingPrompt(true);
    setPromptSaved(false);
    try {
      await supabase.from("plan_nodes").update({ planning_prompt: editedPlanningPrompt || null }).eq("id", node.id);
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

  // Status dot color
  const dotColor = isCompleted 
    ? "bg-green-400" 
    : isInProgress 
      ? "bg-blue-400 animate-pulse" 
      : isLocked 
        ? "bg-neutral-600" 
        : "bg-neutral-400";

  return (
    <div 
      id={`session-item-${node.id}`}
      className={`
        rounded-xl transition-all duration-200 
        ${highlighted ? "ring-1 ring-cyan-400/50" : ""}
        ${isExpanded 
          ? "bg-neutral-800/60 shadow-lg shadow-black/20 border border-neutral-700/50" 
          : "hover:bg-neutral-800/30 hover:-translate-y-[1px] hover:shadow-md hover:shadow-black/10 border border-transparent"
        }
      `}
      style={highlighted ? { 
        boxShadow: `0 0 12px rgba(6, 182, 212, ${highlightOpacity * 0.3})`
      } : undefined}
    >
      {/* Collapsed/Header */}
      <div onClick={handleClick} className="px-3 py-2.5 cursor-pointer">
        <div className="flex items-center gap-3">
          {/* Step number circle + status dot */}
          <div className="relative flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              isCompleted 
                ? "bg-green-500/15 text-green-400" 
                : isInProgress 
                  ? "bg-blue-500/15 text-blue-400" 
                  : "bg-neutral-800 text-neutral-400"
            }`}>
              {isCompleted ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
          </div>
          
          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium block truncate ${
              isCompleted ? "text-neutral-400" : isLocked ? "text-neutral-500" : "text-white"
            }`}>
              {node.title}
            </span>
            {!isExpanded && node.description && (
              <p className="text-[11px] text-neutral-500 truncate mt-0.5">{node.description}</p>
            )}
          </div>

          {/* Right side: status label on hover + chevron */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isExpanded && !isCompleted && !isLocked && (isOwner || isGroupPlan) && (
              <span className="text-[10px] text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                {activeSession ? t('sessionItem.resume') : t('sessionItem.expand')}
              </span>
            )}
            <svg 
              className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} 
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Collapsed: next nodes pills */}
        {!isExpanded && nextNodes.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-10 flex-wrap">
            <span className="text-[10px] text-neutral-600">{t('sessionItem.next')}</span>
            {nextNodes.map((n) => (
              <button
                key={n.id}
                onClick={(e) => { e.stopPropagation(); onNavigateToNode?.(n.id); }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800/60 text-neutral-500 hover:text-blue-400 transition-colors"
              >
                {n.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content with smooth animation */}
      <div 
        ref={contentRef}
        className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-3 pb-3 space-y-3 border-t border-neutral-700/30 pt-3 ml-10">
          {/* Description */}
          {node.description && (
            <p className="text-sm text-neutral-400 leading-relaxed">{node.description}</p>
          )}
          
          {/* Sequence navigation — inline pills */}
          {nextNodes.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide">{t('sessionItem.leadsTo')}</span>
              {nextNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={(e) => { e.stopPropagation(); onNavigateToNode?.(n.id); }}
                  className="text-xs px-2 py-0.5 rounded-md bg-neutral-800/60 text-neutral-400 hover:text-blue-400 hover:bg-neutral-700/60 transition-colors"
                >
                  {n.title} &rarr;
                </button>
              ))}
            </div>
          )}

          {/* Planning prompt — disclosure toggle */}
          {isOwner && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowPromptEditor(!showPromptEditor); }}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showPromptEditor ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {t('sessionItem.customInstructionsLabel')}
                {savingPrompt && <span className="text-neutral-600">{t('sessionItem.saving')}</span>}
                {promptSaved && <span className="text-green-500">{t('sessionItem.saved')}</span>}
              </button>
              {showPromptEditor && (
                <textarea
                  value={editedPlanningPrompt}
                  onChange={(e) => setEditedPlanningPrompt(e.target.value)}
                  onBlur={savePlanningPrompt}
                  placeholder={t('sessionItem.customInstructions')}
                  className="w-full mt-2 px-3 py-2 bg-neutral-900/60 border border-neutral-700/50 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
                  rows={2}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          )}

          {/* Actions */}
          {!isLocked && (isOwner || isGroupPlan) && (
            <div className="flex gap-2 pt-1">
              {isCompleted ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStart(); }}
                  disabled={isStarting}
                  className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isStarting ? t('sessionItem.starting') : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('sessionItem.runAgain')}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStart(); }}
                  disabled={isStarting}
                  className={`flex-1 px-4 py-2 disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors ${
                    activeSession ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  {isStarting ? t('sessionItem.starting') : activeSession ? t('sessionItem.resumeLesson') : t('sessionItem.startLesson')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
