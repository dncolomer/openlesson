"use client";

import { type ThinkAloudThought } from "@/lib/useThinkAloudTranscript";
import { useI18n } from "@/lib/i18n";

interface ThinkAloudTracesProps {
  thoughts: ThinkAloudThought[];
  interimText: string;
  isListening: boolean;
  isSupported: boolean;
  error?: string | null;
  onThoughtClick: (thought: ThinkAloudThought) => void;
  onClearThoughts?: () => void;
  compact?: boolean;
}

export function ThinkAloudTraces({
  thoughts,
  interimText,
  isListening,
  isSupported,
  error,
  onThoughtClick,
  onClearThoughts,
  compact = false,
}: ThinkAloudTracesProps) {
  const { t } = useI18n();
  const hasUnavailableError = !!error && ["not-allowed", "service-not-allowed", "language-not-supported"].includes(error);
  const showUnavailable = !isSupported || hasUnavailableError;

  return (
    <section className={`rounded-2xl border border-neutral-800 bg-neutral-950/50 ${compact ? "p-3" : "p-3.5"}`}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <h3 className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-300">
            {t("probes.thinkAloudTraces")}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">
            {t("probes.thinkAloudTracesHint")}
          </p>
        </div>
        {isSupported && !hasUnavailableError && (
          <div className="shrink-0 flex items-center gap-2">
            {thoughts.length > 0 && onClearThoughts && (
              <button
                type="button"
                onClick={onClearThoughts}
                className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 transition-colors"
              >
                {t("probes.removeThoughts")}
              </button>
            )}
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
        <p className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-xs leading-relaxed text-neutral-400">
          {t("probes.liveTranscriptionUnavailable")}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="min-h-[42px] rounded-xl border border-neutral-800 bg-black/20 px-3 py-2 text-xs leading-relaxed text-neutral-300">
            {interimText ? (
              <span className="text-neutral-200">{interimText}</span>
            ) : (
              <span className="text-neutral-600">{t("probes.speakToSeeTrace")}</span>
            )}
          </div>

          {thoughts.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {thoughts.slice().reverse().map((thought) => (
                <button
                  key={thought.id}
                  type="button"
                  onClick={() => onThoughtClick(thought)}
                  className="text-left rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs leading-relaxed text-neutral-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-white active:scale-[0.99] transition-all"
                  title={t("probes.sendThoughtToHelios")}
                >
                  {thought.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
