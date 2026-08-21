"use client";

import { formatTime } from "@/lib/utils";
import type { Probe } from "@/lib/storage";
import { useI18n } from "../lib/i18n";

interface ProbeCardProps {
  probe: Probe;
  problem: string;
  isNew?: boolean;
}

export function ProbeCard({ probe, problem, isNew = false }: ProbeCardProps) {
  const { t } = useI18n();
  const timestampFormatted = formatTime(Math.floor(probe.timestamp / 1000));

  return (
    <div
      className={`p-4 rounded-none border transition-all duration-500 ${
        isNew
          ? "bg-neutral-700/30 border-neutral-500 animate-fade-in"
          : probe.starred
          ? "bg-neutral-800/5 border-neutral-600/40"
          : "bg-neutral-800/50 border-neutral-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          probe.starred ? "bg-neutral-800/15" : "bg-neutral-700"
        }`}>
          {probe.starred ? <StarFilledIcon /> : <QuestionIcon />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-white leading-relaxed flex-1">{probe.text}</p>
            {probe.starred && (
              <span className="shrink-0 mt-1 px-1.5 py-0.5 text-[10px] rounded-none bg-neutral-800/15 text-neutral-300 border border-neutral-600/20 font-medium">
                {t('probes.starred')}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span>{timestampFormatted}</span>
            <span className="w-1 h-1 rounded-full bg-neutral-600" />
            <span>{t('activeProbe.gap')} {Math.round(probe.gapScore * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StarFilledIcon() {
  return (
    <svg className="w-4 h-4 text-neutral-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
