"use client";

import { useI18n } from "@/lib/i18n";

interface FeedbackPanelProps {
  objectives: string[];
  objectiveStatuses?: ("red" | "yellow" | "green" | "blue")[];
}

const statusStyles = {
  blue: {
    bg: "bg-neutral-800/10",
    border: "border-neutral-600/30",
    text: "text-neutral-300",
    dot: "bg-white",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-500",
  },
  yellow: {
    bg: "bg-neutral-800/10",
    border: "border-neutral-600/30",
    text: "text-neutral-300",
    dot: "bg-white",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    dot: "bg-green-500",
  },
};

export function FeedbackPanel({ objectives, objectiveStatuses }: FeedbackPanelProps) {
  const { t } = useI18n();

  const statusLabels = {
    blue: t('feedback.notStarted'),
    red: t('feedback.struggling'),
    yellow: t('feedback.inProgress'),
    green: t('feedback.onTrack'),
  };
  return (
    <div className="w-64 shrink-0 flex flex-col gap-4 p-4 bg-neutral-900/30 border-l border-neutral-800 overflow-y-auto">
      {/* Objectives Section */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-3">
          {t('feedback.sessionObjectives')}
        </div>
        <div className="flex flex-col gap-2">
          {objectives.length > 0 ? (
            objectives.map((objective, index) => {
              const status = objectiveStatuses?.[index] || "blue";
              const statusConf = statusStyles[status];
              
              return (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-2.5 rounded-lg ${statusConf.bg} border ${statusConf.border}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1 ${statusConf.dot}`} />
                  <div className="flex-1">
                    <span className="text-[10px] font-mono text-neutral-500 block mb-0.5">
                      {t('feedback.objective', { num: String(index + 1) })}
                    </span>
                    <span className={`text-xs ${statusConf.text} leading-relaxed`}>
                      {objective}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-neutral-600 italic p-2">
              {t('feedback.loadingObjectives')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
