"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";
import { RemixModal } from "./RemixModal";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_MODEL } from "@/lib/xai-client";

const DIVIDER_STORAGE_KEY = "plan-divider-width";

interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
  planning_prompt?: string;
  session_id?: string;
}

interface Workspace {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  description?: string;
}

import { createBrowserClient } from "@supabase/ssr";

interface WorkspaceChatProps {
  plan: Workspace;
  nodes: Block[];
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: Block[]) => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  workspaceId?: string;
  isOwner?: boolean;
  currentUserId?: string | null;
  isGroupPlan?: boolean;
  hideSessions?: boolean;
  embedded?: boolean;
}

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

function nodesHaveChanged(oldNodes: Block[], newNodes: Block[]): Set<string> {
  const changedIds = new Set<string>();
  const oldMap = new Map(oldNodes.map(n => [n.id, n]));
  
  for (const newNode of newNodes) {
    const oldNode = oldMap.get(newNode.id);
    if (!oldNode) { changedIds.add(newNode.id); continue; }
    if (
      oldNode.title !== newNode.title ||
      oldNode.description !== newNode.description ||
      JSON.stringify(oldNode.next_block_ids) !== JSON.stringify(newNode.next_block_ids) ||
      oldNode.position_x !== newNode.position_x ||
      oldNode.position_y !== newNode.position_y ||
      oldNode.status !== newNode.status
    ) {
      changedIds.add(newNode.id);
    }
  }
  return changedIds;
}

export function WorkspaceChat({ plan, nodes: initialNodes, onRefresh, onNodesUpdate, supabase, workspaceId, isOwner = true, currentUserId, isGroupPlan = false, hideSessions = false, embedded = false }: WorkspaceChatProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [nodes, setNodes] = useState(initialNodes);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [model, setModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      return saved?.replace(/^x-ai\//, "") || DEFAULT_PLANNER_MODEL;
    }
    return DEFAULT_PLANNER_MODEL;
  });
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightOpacity, setHighlightOpacity] = useState(1);
  const [showRemixModal, setShowRemixModal] = useState(false);
  
  // Desktop draggable divider state
  const [leftWidth, setLeftWidth] = useState<number>(38);
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(65); // percentage of viewport
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetStartY = useRef(0);
  const sheetStartHeight = useRef(65);
  
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(DIVIDER_STORAGE_KEY);
    if (saved) setLeftWidth(parseFloat(saved));
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    const changedIds = nodesHaveChanged(nodes, initialNodes);
    if (changedIds.size > 0) {
      setHighlightedNodes(changedIds);
      setHighlightOpacity(1);
      setTimeout(() => setHighlightOpacity(0.7), 7000);
      setTimeout(() => setHighlightOpacity(0.4), 8500);
      setTimeout(() => { setHighlightedNodes(new Set()); setHighlightOpacity(1); }, 10000);
    }
    setNodes(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    const handleOpenRemix = () => setShowRemixModal(true);
    window.addEventListener("openRemixModal", handleOpenRemix);
    return () => window.removeEventListener("openRemixModal", handleOpenRemix);
  }, []);

  // Desktop draggable divider handlers
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(25, Math.min(65, newWidth)));
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem(DIVIDER_STORAGE_KEY, leftWidth.toString());
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
  }, [isDragging, leftWidth]);

  // Mobile sheet touch handlers
  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    setSheetDragging(true);
    sheetStartY.current = e.touches[0].clientY;
    sheetStartHeight.current = sheetHeight;
  }, [sheetHeight]);

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sheetDragging) return;
    const deltaY = sheetStartY.current - e.touches[0].clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.max(20, Math.min(92, sheetStartHeight.current + deltaPercent));
    setSheetHeight(newHeight);
  }, [sheetDragging]);

  const handleSheetTouchEnd = useCallback(() => {
    setSheetDragging(false);
    // Snap points: dismiss (<25%), half (~60%), full (~90%)
    if (sheetHeight < 25) {
      setSheetOpen(false);
      setSheetHeight(65);
    } else if (sheetHeight < 75) {
      setSheetHeight(65);
    } else {
      setSheetHeight(92);
    }
  }, [sheetHeight]);

  // Lock body scroll when sheet is open on mobile
  useEffect(() => {
    if (!isDesktop && sheetOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sheetOpen, isDesktop]);

  const handleModelChange = useCallback((newModel: string) => {
    const normalizedModel = newModel.replace(/^x-ai\//, "");
    setModel(normalizedModel);
    localStorage.setItem(MODEL_STORAGE_KEY, normalizedModel);
  }, []);

  const handleNodesUpdate = useCallback(
    (newNodes: Block[]) => {
      setNodes(newNodes);
      onNodesUpdate?.(newNodes);
    },
    [onNodesUpdate],
  );

  const handleDeleteClick = useCallback((blockId: string) => { setShowDeleteConfirm(blockId); }, []);

  const handleForkClick = useCallback(async (blockId: string) => {
    try {
      if (!blockId) {
        await fetch("/api/workspace/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: plan.id, userPrompt: "Add a new learning session at the end of the plan.", model }),
        });
      } else {
        await fetch("/api/workspace/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockId }),
        });
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to fork:", err);
    }
  }, [router, plan.id, model]);

  const handleDeleteConfirm = useCallback(async (blockId: string) => {
    setShowDeleteConfirm(null);
    try {
      await fetch("/api/workspace/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId, workspaceId: plan.id }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }, [plan.id, router]);

  return (
    <div 
      ref={containerRef}
      className={`h-full flex flex-col md:flex-row gap-2 ${isDragging ? "select-none" : ""}`}
    >
      {/* ─── DESKTOP LAYOUT ─── */}
      
      {/* Chat Panel - Desktop only (left, narrower) — hidden for group plan participants */}
      {isOwner && (
        <div 
          className="hidden md:flex flex-col h-full min-h-0 flex-none"
          style={{ width: hideSessions ? "100%" : `${leftWidth}%` }}
        >
          <div className={`flex-1 overflow-hidden flex flex-col ${hideSessions ? "" : "bg-neutral-900/50 rounded-md border border-neutral-800/60 p-4 shadow-lg shadow-black/10"}`}>
            <ChatPanel
              workspaceId={plan.id}
              model={model}
              onModelChange={handleModelChange}
              onRefresh={onRefresh}
              onNodesUpdate={handleNodesUpdate}
              supabase={supabase}
              isOwner={isOwner}
              currentUserId={currentUserId}
              embedded={embedded}
            />
          </div>
        </div>
      )}

      {/* Draggable Divider - Desktop only, owner only */}
      {isOwner && !hideSessions && (
        <div 
          className="hidden md:flex items-center justify-center w-1.5 cursor-col-resize group"
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
        >
          <div className={`w-0.5 h-full rounded-full transition-colors ${isDragging ? "bg-neutral-400" : "bg-neutral-700 group-hover:bg-neutral-500"}`} />
        </div>
      )}

      {/* Sessions Panel - Desktop (right, wider — full width for group participants) */}
      {!hideSessions && (
      <div 
        className="hidden md:flex flex-col h-full min-h-0 flex-none"
        style={{ width: isOwner ? `${100 - leftWidth - 0.5}%` : "100%" }}
      >
        <div className="flex-1 bg-neutral-900/50 rounded-md border border-neutral-800/60 overflow-hidden shadow-lg shadow-black/10">
          <SessionList
            nodes={nodes}
            onSelect={() => {}}
            onDelete={handleDeleteClick}
            onFork={handleForkClick}
            highlightedNodes={highlightedNodes}
            highlightOpacity={highlightOpacity}
            isOwner={isOwner}
            isGroupPlan={isGroupPlan}
            supabase={supabase}
            planTopic={plan.root_topic}
            workspaceId={workspaceId || plan.id}
            onRefresh={onRefresh}
            onNodesUpdate={handleNodesUpdate}
          />
        </div>
      </div>
      )}

      {/* ─── MOBILE LAYOUT ─── */}

      {hideSessions && isOwner && (
        <div className="md:hidden flex-1 min-h-0 overflow-hidden">
          <ChatPanel
            workspaceId={plan.id}
            model={model}
            onModelChange={handleModelChange}
            onRefresh={onRefresh}
            onNodesUpdate={handleNodesUpdate}
            supabase={supabase}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Sessions Panel - Mobile: always visible, full width */}
      {!hideSessions && (
      <div className="md:hidden flex-1 min-h-0 overflow-hidden">
        <div className="h-full bg-neutral-900/50 rounded-md border border-neutral-800/60 overflow-hidden shadow-lg shadow-black/10">
          <SessionList
            nodes={nodes}
            onSelect={() => {}}
            onDelete={handleDeleteClick}
            onFork={handleForkClick}
            highlightedNodes={highlightedNodes}
            highlightOpacity={highlightOpacity}
            isOwner={isOwner}
            isGroupPlan={isGroupPlan}
            supabase={supabase}
            planTopic={plan.root_topic}
            workspaceId={workspaceId || plan.id}
            onRefresh={onRefresh}
            onNodesUpdate={handleNodesUpdate}
          />
        </div>
      </div>
      )}

      {/* FAB - Mobile only: opens bottom sheet */}
      {isOwner && !hideSessions && !sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
            className="md:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 bg-white hover:bg-neutral-200 text-black text-sm font-medium rounded-md shadow-xl shadow-black/30 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          {t('planChat.aiPlanner')}
        </button>
      )}

      {/* Bottom Sheet - Mobile only */}
      {!hideSessions && sheetOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => { setSheetOpen(false); setSheetHeight(65); }}
          />

          {/* Sheet */}
          <div
            className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f] border-t border-neutral-800 rounded-t-2xl flex flex-col ${sheetDragging ? "" : "transition-all duration-300 ease-out"}`}
            style={{ height: `${sheetHeight}vh` }}
          >
            {/* Drag handle */}
            <div
              className="flex-shrink-0 flex justify-center py-3 cursor-grab active:cursor-grabbing"
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
            >
              <div className="w-10 h-1 rounded-full bg-neutral-600" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-sm font-semibold text-white">{t('planChat.aiPlanner')}</span>
              </div>
              <button
                onClick={() => { setSheetOpen(false); setSheetHeight(65); }}
                className="p-1.5 text-neutral-500 hover:text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat content */}
            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
              <div className="h-full bg-neutral-900/50 rounded-md border border-neutral-800/60 overflow-hidden flex flex-col p-3">
                <ChatPanel
                  workspaceId={plan.id}
                  model={model}
                  onModelChange={handleModelChange}
                  onRefresh={() => { onRefresh?.(); setSheetOpen(false); setSheetHeight(65); }}
                  onNodesUpdate={handleNodesUpdate}
                  supabase={supabase}
                  isOwner={isOwner}
                  currentUserId={currentUserId}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-neutral-800 border-t md:border border-neutral-700 rounded-t-md md:rounded-md p-4">
            <h3 className="text-lg font-semibold text-white mb-2">{t('planChat.deleteSession')}</h3>
            <p className="text-sm text-neutral-400 mb-4">
              {t('planChat.deleteSessionConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
              >
                {t('planChat.delete')}
              </button>
            </div>
          </div>
        </>
      )}

      {showRemixModal && (
        <RemixModal
          plan={{ id: plan.id, root_topic: plan.root_topic, remix_count: 0 }}
          onClose={() => setShowRemixModal(false)}
          onComplete={(newPlanId) => { setShowRemixModal(false); router.push(`/workspace/${newPlanId}`); }}
        />
      )}
    </div>
  );
}
