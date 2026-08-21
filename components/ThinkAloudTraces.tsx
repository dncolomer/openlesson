"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  thoughtSelectionActionClass,
  thoughtSelectionBarClass,
  thoughtSelectionBarTextClass,
  thoughtSelectionChipClass,
} from "@/components/thought-ui/ThoughtUi";
import { type ThinkAloudThought } from "@/lib/useThinkAloudTranscript";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ThinkAloudTracesProps {
  thoughts: ThinkAloudThought[];
  interimText: string;
  isListening: boolean;
  isSupported: boolean;
  error?: string | null;
  onThoughtClick: (thought: ThinkAloudThought) => void;
  onManualSubmit?: (text: string) => void;
  onClearThoughts?: () => void;
  onThoughtsSent?: (thoughtIds: string[]) => void;
  compact?: boolean;
}

export function ThinkAloudTraces({
  thoughts,
  interimText,
  isListening,
  isSupported,
  error,
  onThoughtClick,
  onManualSubmit,
  onClearThoughts,
  onThoughtsSent,
  compact = false,
}: ThinkAloudTracesProps) {
  const { t } = useI18n();
  const [selectedThoughtIds, setSelectedThoughtIds] = useState<Set<string>>(new Set());
  const [manualText, setManualText] = useState("");
  const onThoughtsSentRef = useRef(onThoughtsSent);
  const hasUnavailableError = !!error && ["not-allowed", "service-not-allowed", "language-not-supported"].includes(error);
  const showUnavailable = !isSupported || hasUnavailableError;
  const selectedThoughts = useMemo(
    () => thoughts.filter((thought) => selectedThoughtIds.has(thought.id)),
    [thoughts, selectedThoughtIds],
  );
  const recentThoughts = useMemo(() => thoughts.slice().reverse(), [thoughts]);

  useEffect(() => {
    onThoughtsSentRef.current = onThoughtsSent;
  }, [onThoughtsSent]);

  useEffect(() => {
    setSelectedThoughtIds((current) => {
      const validIds = new Set(thoughts.map((thought) => thought.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [thoughts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!["1", "2", "3"].includes(event.key)) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const thought = recentThoughts[Number(event.key) - 1];
      if (!thought) return;

      event.preventDefault();
      onThoughtClick(thought);
      onThoughtsSentRef.current?.([thought.id]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onThoughtClick, recentThoughts]);

  const toggleThought = (thoughtId: string) => {
    setSelectedThoughtIds((current) => {
      const next = new Set(current);
      if (next.has(thoughtId)) {
        next.delete(thoughtId);
      } else {
        next.add(thoughtId);
      }
      return next;
    });
  };

  const sendSelectedThoughts = () => {
    if (selectedThoughts.length === 0) return;
    onThoughtClick({
      id: `selected_${Date.now()}`,
      text: selectedThoughts.map((thought) => thought.text).join("\n"),
      timestamp: Date.now(),
    });
    onThoughtsSent?.(selectedThoughts.map((thought) => thought.id));
    setSelectedThoughtIds(new Set());
  };

  const submitManualText = () => {
    const text = manualText.trim();
    if (!text || !onManualSubmit) return;
    onManualSubmit(text);
    setManualText("");
  };

  const sendSingleThought = (thought: ThinkAloudThought) => {
    onThoughtClick(thought);
    onThoughtsSentRef.current?.([thought.id]);
    setSelectedThoughtIds((current) => {
      if (!current.has(thought.id)) return current;
      const next = new Set(current);
      next.delete(thought.id);
      return next;
    });
  };

  return (
    <section
      className={`w-full min-w-0 max-w-full overflow-hidden rounded-none border border-neutral-800 bg-neutral-950/50 ${compact ? "p-3" : "p-3.5"}`}
    >
      <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-300">
            {t("probes.thinkAloudTraces")}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">
            {t("probes.thinkAloudTracesHint")}
          </p>
        </div>
        {isSupported && !hasUnavailableError && (
          <div className="shrink-0 flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-400 ${isListening ? "listening-live-glow" : ""}`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isListening ? "bg-red-400 animate-pulse" : "bg-neutral-600"
                }`}
                aria-hidden="true"
              />
              {isListening ? t("probes.listeningLive") : t("probes.waitingForSpeech")}
            </div>
          </div>
        )}
      </div>

      {showUnavailable ? (
        <p className="rounded-none border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-xs leading-relaxed text-neutral-400">
          {t("probes.liveTranscriptionUnavailable")}
        </p>
      ) : (
        <div className="min-w-0 space-y-2">
          <div className="max-h-32 min-h-[42px] overflow-x-hidden overflow-y-auto rounded-none border border-neutral-800 bg-black/20 px-3 py-2 text-xs leading-relaxed text-neutral-300">
            {interimText ? (
              <span className="block break-words text-neutral-200">{interimText}</span>
            ) : (
              <span className="text-neutral-600">{t("probes.speakToSeeTrace")}</span>
            )}
          </div>

          {onManualSubmit && (
            <div className="space-y-1.5 border-t border-neutral-800/80 pt-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  {t("probes.manualMessage")}
                </span>
                <div className="h-px flex-1 bg-neutral-800/70" />
              </div>
              <div className="flex min-w-0 items-stretch gap-2">
                <textarea
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitManualText();
                    }
                  }}
                  placeholder={t("heliosChat.placeholder")}
                  rows={1}
                  className="min-h-10 flex-1 resize-none rounded-none border border-neutral-800 bg-neutral-950/70 px-3 py-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
                />
                <button
                  type="button"
                  onClick={submitManualText}
                  disabled={!manualText.trim()}
                  className="shrink-0 rounded-none border border-red-500/40 bg-red-500/10 px-3 text-red-200 transition-colors hover:border-red-400/70 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t("common.submit")}
                  title={t("common.submit")}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {thoughts.length > 0 && (
            <>
              <div
                className={cn(
                  thoughtSelectionBarClass,
                  "flex items-center justify-between gap-2 px-2.5 py-2",
                  selectedThoughts.length === 0 && "border-neutral-800 bg-transparent",
                )}
              >
                <span className={selectedThoughts.length > 0 ? thoughtSelectionBarTextClass : "text-[10px] text-neutral-500"}>
                  {selectedThoughts.length > 0
                    ? t("probes.thoughtsSelected", { count: selectedThoughts.length })
                    : t("probes.selectThoughtsToSend")}
                </span>
                <button
                  type="button"
                  onClick={sendSelectedThoughts}
                  disabled={selectedThoughts.length === 0}
                  className={cn(
                    thoughtSelectionActionClass,
                    "rounded-full border border-white/25 bg-white/5 px-2.5 py-1 font-medium no-underline hover:border-white/40 hover:bg-white/10 disabled:border-neutral-800 disabled:bg-transparent",
                  )}
                >
                  {t("probes.sendSelected")}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {recentThoughts.map((thought, index) => {
                  const isSelected = selectedThoughtIds.has(thought.id);
                  const shortcut = index < 3 ? String(index + 1) : null;
                  return (
                    <button
                      key={thought.id}
                      type="button"
                      onClick={() => toggleThought(thought.id)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        sendSingleThought(thought);
                      }}
                      className={thoughtSelectionChipClass(isSelected)}
                      title={t("probes.selectThought")}
                    >
                      <span
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-none border flex items-center justify-center ${
                          isSelected ? "border-white bg-white text-neutral-950" : "border-neutral-700 bg-neutral-950"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{thought.text}</span>
                      {shortcut && (
                        <span className="shrink-0 rounded-none border border-neutral-700 bg-neutral-950/70 px-1.5 py-0.5 text-[10px] leading-none text-neutral-500">
                          {shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
