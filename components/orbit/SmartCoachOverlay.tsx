"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  GripHorizontal,
  Loader2,
  MessageCircle,
  Minus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { askOrbitPerformanceQuestion } from "@/lib/evidence-api-demo/orbit-learning-links";
import type { ConversionGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import { extractGameCoaching } from "@/lib/evidence-api-demo/game-tips";
import type { OrbitAppSnapshot } from "@/lib/evidence-api-demo/orbit-app-context";
import { formatOrbitSnapshotForPrompt } from "@/lib/evidence-api-demo/orbit-app-context";
import {
  getAffordanceForAction,
  matchCoachingHintToAction,
} from "@/lib/evidence-api-demo/orbit-coach-map";

const PANEL_STORAGE_KEY = "orbit-coach-panel";

type PanelLayout = {
  x: number;
  y: number;
  minimized: boolean;
};

type SmartCoachOverlayProps = {
  report: PerformanceReport | null;
  isReporting: boolean;
  connected?: boolean;
  planId?: string | null;
  blockId?: string | null;
  evidenceCount?: number;
  inferredGoal?: string | null;
  conversionGoalSource?: ConversionGoalSource;
  appSnapshot?: OrbitAppSnapshot | null;
  ileSessionUrl?: string | null;
  isOpeningIle?: boolean;
  onOpenIle?: () => void;
};

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function loadPanelLayout(): PanelLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PanelLayout;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return {
      x: parsed.x,
      y: parsed.y,
      minimized: Boolean(parsed.minimized),
    };
  } catch {
    return null;
  }
}

function savePanelLayout(layout: PanelLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(layout));
}

function clampPanelPosition(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

function formatChatAnswer(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function filterSuggestionsForSnapshot(
  suggestions: string[],
  snapshot: OrbitAppSnapshot | null
): string[] {
  if (!snapshot) return suggestions;
  return suggestions.filter((item) => {
    const lower = item.toLowerCase();
    if (lower.includes("triage") && snapshot.inbox_unread_count === 0) return false;
    if (lower.includes("inbox") && snapshot.inbox_unread_count === 0 && lower.includes("unread")) {
      return false;
    }
    return true;
  });
}

export function SmartCoachOverlay({
  report,
  isReporting,
  connected = false,
  planId = null,
  blockId = null,
  evidenceCount = 0,
  inferredGoal,
  conversionGoalSource,
  appSnapshot = null,
  ileSessionUrl,
  isOpeningIle = false,
  onOpenIle,
}: SmartCoachOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );

  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const coaching = useMemo(() => extractGameCoaching(report), [report]);
  const coachTarget = useMemo(
    () =>
      matchCoachingHintToAction(
        [...coaching.events, ...coaching.gapRepairs, ...coaching.directions],
        appSnapshot
      ),
    [appSnapshot, coaching]
  );

  const coachInstruction = useMemo(() => {
    if (!coachTarget) return null;
    return getAffordanceForAction(coachTarget.actionId, appSnapshot) ?? coachTarget.instruction;
  }, [appSnapshot, coachTarget]);

  const suggestions = useMemo(
    () =>
      filterSuggestionsForSnapshot(
        (report?.suggestions ?? []).map((item) => item.trim()).filter(Boolean),
        appSnapshot
      ),
    [appSnapshot, report]
  );

  const goalText =
    inferredGoal?.trim() ||
    report?.conversion_goal?.trim() ||
    null;

  const overallScore = clampScore(report?.overall_score);
  const conversionScore = clampScore(report?.conversion_score);
  const hasCoaching =
    coaching.directions.length > 0 ||
    coaching.events.length > 0 ||
    coaching.gapRepairs.length > 0;
  const hasScoreContent =
    isReporting ||
    goalText ||
    hasCoaching ||
    suggestions.length > 0 ||
    overallScore !== null ||
    coachTarget;
  const showCard = connected || hasScoreContent;

  useEffect(() => {
    const saved = loadPanelLayout();
    if (saved) {
      setPosition({ x: saved.x, y: saved.y });
      setMinimized(saved.minimized);
    }
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    if (!layoutReady || !position) return;
    savePanelLayout({ ...position, minimized });
  }, [layoutReady, minimized, position]);

  const syncPositionToViewport = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !position) return;
    const rect = panel.getBoundingClientRect();
    const next = clampPanelPosition(position.x, position.y, rect.width, rect.height);
    if (next.x !== position.x || next.y !== position.y) {
      setPosition(next);
    }
  }, [position]);

  useEffect(() => {
    if (!position) return;
    const onResize = () => syncPositionToViewport();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, syncPositionToViewport]);

  useLayoutEffect(() => {
    if (!layoutReady || !showCard) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const margin = 20;
    setPosition((prev) => {
      const base = prev ?? {
        x: Math.max(margin, window.innerWidth - rect.width - margin),
        y: Math.max(margin, window.innerHeight - rect.height - margin),
      };
      return clampPanelPosition(base.x, base.y, rect.width, rect.height);
    });
  }, [layoutReady, minimized, showCard]);

  const closeChat = () => {
    setChatOpen(false);
    setChatQuestion("");
    setChatAnswer(null);
    setChatError(null);
    setIsAsking(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (!target.closest("[data-drag-handle]")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const origin = position ?? { x: rect.left, y: rect.top };
    if (!position) setPosition(origin);

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 384;
    const height = panel?.offsetHeight ?? 200;
    const next = clampPanelPosition(
      drag.originX + (event.clientX - drag.startX),
      drag.originY + (event.clientY - drag.startY),
      width,
      height
    );
    setPosition(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!showCard || !layoutReady) return null;

  const primaryHint =
    coaching.gapRepairs[0] ??
    coaching.events[0] ??
    coaching.directions[0] ??
    null;

  const showIleCta = Boolean(onOpenIle && (hasCoaching || suggestions.length > 0 || (overallScore !== null && overallScore < 80)));
  const canAskQuestion = Boolean(planId && evidenceCount > 0 && !isReporting);

  const handleAskQuestion = async () => {
    const question = chatQuestion.trim();
    if (!planId || !question || isAsking) return;

    setIsAsking(true);
    setChatError(null);
    setChatAnswer(null);

    try {
      const answer = await askOrbitPerformanceQuestion(planId, question, {
        blockId: blockId ?? undefined,
        orbitUiContext: appSnapshot ? formatOrbitSnapshotForPrompt(appSnapshot) : undefined,
      });
      setChatAnswer(formatChatAnswer(answer));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not get an answer");
    } finally {
      setIsAsking(false);
    }
  };

  const panelStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y }
    : { right: 20, bottom: 20 };

  if (minimized) {
    return (
      <div
        ref={panelRef}
        style={panelStyle}
        className="pointer-events-auto fixed z-[90] w-[min(16rem,calc(100vw-2rem))]"
      >
        <div className="flex items-center gap-1 rounded-lg border border-[#2f2f3a] bg-[#14141a]/95 py-2 pl-2 pr-3 shadow-2xl backdrop-blur-md">
          <div
            data-drag-handle
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
            title="Drag scorecard"
          >
            <GripHorizontal className="size-3.5 shrink-0 text-[#6b6b80]" aria-hidden />
            {isReporting ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-[#5e6ad2]" />
            ) : (
              <Sparkles className="size-3.5 shrink-0 text-[#5e6ad2]" />
            )}
            <span className="min-w-0 truncate text-xs font-medium text-[#d6d6e8]">
              {isReporting ? "Scoring…" : "Scorecard"}
              {connected && evidenceCount > 0 ? ` · ${evidenceCount}` : ""}
              <span className="block truncate font-mono text-[9px] font-normal uppercase tracking-wide text-[#5c5c70]">
                openLesson
              </span>
            </span>
            {overallScore !== null ? (
              <span className="shrink-0 font-mono text-[10px] text-white">{overallScore}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-[#9b9bb8] transition hover:bg-white/5 hover:text-white"
            title="Expand scorecard"
          >
            Open
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className="pointer-events-auto fixed z-[90] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-[#2f2f3a] bg-[#14141a]/95 shadow-2xl backdrop-blur-md"
    >
      <div
        data-drag-handle
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex cursor-grab items-center justify-between gap-2 border-b border-[#2f2f3a] px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#9b9bb8]">
            <GripHorizontal className="size-3.5 shrink-0 text-[#6b6b80]" />
            {isReporting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-[#5e6ad2]" />}
            <span className="truncate">{isReporting ? "Scoring your work…" : "Scorecard coach"}</span>
          </div>
          <span className="pl-5 font-mono text-[9px] uppercase tracking-wide text-[#5c5c70]">
            Powered by openLesson
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="rounded p-1 text-[#6b6b80] transition hover:bg-white/5 hover:text-white"
          aria-label="Minimize scorecard"
        >
          <Minus className="size-3.5" />
        </button>
      </div>

      <div className="max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto p-4">
        {goalText ? (
          <p className="rounded-md border border-[#5e6ad2]/25 bg-[#5e6ad2]/10 px-3 py-2 text-sm leading-snug text-[#d6d6e8]">
            Are you trying to{" "}
            <span className="font-medium text-white">{goalText}</span>?
            {conversionGoalSource ? (
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-[#6b6b80]">
                {conversionGoalSource === "workspace" ? "Workspace goal" : "Inferred goal"}
              </span>
            ) : null}
          </p>
        ) : null}

        {overallScore !== null || conversionScore !== null ? (
          <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-wide text-[#6b6b80]">
            {overallScore !== null ? (
              <span>
                Learn <span className="text-white">{overallScore}</span>/100
              </span>
            ) : null}
            {conversionScore !== null ? (
              <span>
                Conv <span className="text-white">{conversionScore}%</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {report?.summary?.trim() ? (
          <p className="mt-3 text-sm leading-relaxed text-[#9b9bb8]">{report.summary.trim()}</p>
        ) : null}

        {coaching.directions.length > 0 ? (
          <div className="mt-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-[#6b6b80]">Goals</div>
            <ul className="mt-1 space-y-1 text-sm text-[#d6d6e8]">
              {coaching.directions.slice(0, 2).map((line) => (
                <li key={line} className="leading-snug">
                  ◎ {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {primaryHint ? (
          <p className="mt-3 text-sm leading-relaxed text-[#d6d6e8]">{primaryHint}</p>
        ) : !isReporting && !hasScoreContent ? (
          <p className="mt-3 text-sm leading-relaxed text-[#8b8ba3]">
            {evidenceCount < 3
              ? `Connected · ${evidenceCount} evidence event${evidenceCount === 1 ? "" : "s"}. Scorecard updates every 3 actions.`
              : "Pulling scorecard from Evidence API…"}
          </p>
        ) : !isReporting ? (
          <p className="mt-3 text-sm leading-relaxed text-[#8b8ba3]">
            Keep working in Orbit — coaching updates as evidence accumulates.
          </p>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="mt-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-[#6b6b80]">Suggestions</div>
            <ul className="mt-1.5 space-y-1.5 text-sm text-[#d6d6e8]">
              {suggestions.map((item) => (
                <li key={item} className="flex gap-2 leading-snug">
                  <span className="shrink-0 text-[#6b6b80]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {coachTarget ? (
          <div className="mt-3 rounded-md border border-[#3a3a48] bg-[#1a1a22] px-3 py-2 text-xs text-[#c4c9ff]">
            <span className="font-medium text-white">{coachTarget.label}</span>
            <span className="mt-1 block text-[#9b9bb8]">{coachInstruction}</span>
            {!coachTarget.inMainUi ? (
              <span className="mt-1 block text-[10px] text-[#6b6b80]">Reachable via Cmd+K</span>
            ) : null}
          </div>
        ) : null}

        {coaching.events.length > 1 ? (
          <ul className="mt-3 space-y-1 text-[11px] text-[#8b8ba3]">
            {coaching.events.slice(1, 3).map((line) => (
              <li key={line}>→ {line}</li>
            ))}
          </ul>
        ) : null}

        {chatOpen ? (
          <div className="mt-4 border-t border-[#2f2f3a] pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide text-[#6b6b80]">
                <MessageCircle className="size-3" />
                Ask Evidence API
              </div>
              <button
                type="button"
                onClick={closeChat}
                className="rounded p-1 text-[#6b6b80] transition hover:bg-white/5 hover:text-white"
                aria-label="Close chat"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#8b8ba3]">
              One question at a time — chat mode reads your Orbit evidence and explains what to fix.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAskQuestion();
                  }
                }}
                disabled={!canAskQuestion || isAsking}
                placeholder={
                  canAskQuestion
                    ? "What am I doing wrong?"
                    : "Take an action in Orbit first…"
                }
                className="min-w-0 flex-1 rounded-md border border-[#2a2a36] bg-[#0d0d0d] px-2.5 py-2 text-xs text-[#e8e8f0] placeholder:text-[#5c5c70] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleAskQuestion()}
                disabled={!canAskQuestion || isAsking || !chatQuestion.trim()}
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#5e6ad2]/35 bg-[#5e6ad2]/15 px-2.5 py-2 text-[#c4c9ff] transition hover:border-[#5e6ad2]/55 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Ask question"
              >
                {isAsking ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </button>
            </div>
            {chatError ? (
              <p className="mt-2 text-xs text-red-300">{chatError}</p>
            ) : null}
            {chatAnswer ? (
              <div className="mt-3 rounded-md border border-[#3a3a48] bg-[#1a1a22] px-3 py-2.5 text-xs leading-relaxed text-[#d6d6e8]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-[#6b6b80]">Answer</span>
                  <button
                    type="button"
                    onClick={() => {
                      setChatAnswer(null);
                      setChatError(null);
                    }}
                    className="rounded p-0.5 text-[#6b6b80] transition hover:text-white"
                    aria-label="Dismiss answer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <div className="whitespace-pre-wrap">{chatAnswer}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-[#2a2a36] px-3 py-2 text-xs text-[#9b9bb8] transition hover:border-[#5e6ad2]/40 hover:text-[#c4c9ff]"
          >
            <MessageCircle className="size-3.5" />
            Ask what&apos;s wrong
          </button>
        )}

        {showIleCta ? (
          <div className="mt-4 border-t border-[#2f2f3a] pt-3">
            <p className="text-[11px] leading-snug text-[#8b8ba3]">
              Blocked on a workflow step? ILE walks you through Orbit with guided practice.
            </p>
            <button
              type="button"
              onClick={onOpenIle}
              disabled={isOpeningIle}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#5e6ad2]/35 bg-[#5e6ad2]/10 px-3 py-2 text-xs font-medium text-[#c4c9ff] transition hover:border-[#5e6ad2]/55 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOpeningIle ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : ileSessionUrl ? (
                <ExternalLink className="size-3.5" />
              ) : (
                <BookOpen className="size-3.5" />
              )}
              {isOpeningIle
                ? "Opening ILE…"
                : ileSessionUrl
                  ? "Open ILE practice"
                  : "Start ILE practice"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}