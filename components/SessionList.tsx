"use client";

import { useState, useMemo } from "react";
import { SessionItem } from "./SessionItem";
import { createBrowserClient } from "@supabase/ssr";
import { useI18n } from "@/lib/i18n";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionListProps {
  nodes: PlanNode[];
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onFork: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  highlightOpacity?: number;
  isOwner?: boolean;
  isGroupPlan?: boolean;
  supabase?: ReturnType<typeof createBrowserClient>;
  planTopic?: string;
  planId?: string;
}

function getOrderedSessions(nodes: PlanNode[]): PlanNode[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: PlanNode[] = [];
  
  const startNodes = nodes.filter(n => n.is_start);
  const queue = [...startNodes];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    
    visited.add(node.id);
    ordered.push(node);
    
    const children = nodes.filter(n => 
      node.next_node_ids?.includes(n.id)
    );
    
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }
  
  return ordered;
}

export function SessionList({ nodes, onSelect, onDelete, onFork, highlightedNodes, highlightOpacity = 1, isOwner = true, isGroupPlan = false, supabase, planTopic, planId }: SessionListProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const { t } = useI18n();

  const { activeSessions, completedSessions } = useMemo(() => {
    const ordered = getOrderedSessions(nodes);
    const active = ordered.filter(n => n.status !== "completed");
    const completed = ordered.filter(n => n.status === "completed");
    return { activeSessions: active, completedSessions: completed };
  }, [nodes]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodeId(prev => prev === nodeId ? null : nodeId);
  };

  const navigateToNode = (nodeId: string) => {
    setExpandedNodeId(nodeId);
    // Scroll the node into view
    setTimeout(() => {
      const element = document.getElementById(`session-item-${nodeId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const visibleCompleted = showCompleted ? completedSessions : [];

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-white">{t('sessionList.sessions')}</h2>
        <span className="text-[11px] text-neutral-500">
          {t('sessionList.progressDone', { completed: completedSessions.length, total: nodes.length })}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {activeSessions.map((node, index) => (
          <SessionItem
            key={node.id}
            node={node}
            index={index}
            onSelect={() => onSelect(node.id)}
            onDelete={onDelete}
            onFork={onFork}
            highlighted={highlightedNodes?.has(node.id)}
            highlightOpacity={highlightOpacity}
            isExpanded={expandedNodeId === node.id}
            onToggleExpand={() => toggleExpand(node.id)}
            allNodes={nodes}
            isOwner={isOwner}
            isGroupPlan={isGroupPlan}
            supabase={supabase}
            onNavigateToNode={navigateToNode}
            planTopic={planTopic}
            planId={planId}
          />
        ))}

        {activeSessions.length === 0 && completedSessions.length === 0 && (
          <div className="text-center py-8 text-neutral-500 text-sm">
            {t('sessionList.noSessions')}
          </div>
        )}

        {completedSessions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-800/50">
              <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors w-full px-1 py-1.5"
            >
              <svg 
                className={`w-3 h-3 transition-transform ${showCompleted ? "rotate-90" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {t('sessionList.completed')} ({completedSessions.length})
            </button>

            {showCompleted && (
              <div className="space-y-1 mt-2 opacity-60">
                {completedSessions.map((node, index) => (
                  <SessionItem
                    key={node.id}
                    node={node}
                    index={activeSessions.length + index}
                    onSelect={() => onSelect(node.id)}
                    onDelete={() => {}}
                    onFork={() => {}}
                    highlighted={highlightedNodes?.has(node.id)}
                    highlightOpacity={highlightOpacity}
                    isExpanded={expandedNodeId === node.id}
                    onToggleExpand={() => toggleExpand(node.id)}
                    allNodes={nodes}
                    isOwner={isOwner}
                    isGroupPlan={isGroupPlan}
                    supabase={supabase}
                    onNavigateToNode={navigateToNode}
                    planTopic={planTopic}
                    planId={planId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}