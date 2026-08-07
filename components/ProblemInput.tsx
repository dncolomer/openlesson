"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

type ThemeColor = "neutral" | "teal" | "slate" | "blue" | "amber" | "violet" | "glass";

const themeStyles: Record<ThemeColor, {
  textarea: string;
  button: string;
  buttonDisabled: string;
}> = {
  neutral: {
    textarea: "bg-neutral-900/80 border-neutral-800 focus:border-neutral-600 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-800 disabled:text-neutral-600",
  },
  teal: {
    textarea: "bg-teal-950/50 border-teal-900/50 focus:border-teal-700 placeholder-neutral-600",
    button: "bg-teal-500 hover:bg-teal-400 text-white",
    buttonDisabled: "disabled:bg-teal-900/50 disabled:text-teal-700",
  },
  slate: {
    textarea: "bg-slate-900/50 border-slate-800 focus:border-slate-600 placeholder-slate-600",
    button: "bg-slate-200 hover:bg-white text-slate-900",
    buttonDisabled: "disabled:bg-slate-800 disabled:text-slate-600",
  },
  blue: {
    textarea: "bg-neutral-950/50 border-neutral-800/50 focus:border-neutral-700 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-950/50 disabled:text-neutral-200",
  },
  amber: {
    textarea: "bg-neutral-950/50 border-neutral-800/50 focus:border-neutral-700 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-950/50 disabled:text-neutral-200",
  },
  violet: {
    textarea: "bg-neutral-950/50 border-neutral-800/50 focus:border-neutral-700 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-950/50 disabled:text-neutral-200",
  },
  glass: {
    textarea: "bg-white/10 border-white/20 focus:border-white/40 placeholder-white/50 text-white",
    button: "bg-white hover:bg-white/90 text-slate-900",
    buttonDisabled: "disabled:bg-white/20 disabled:text-white/50",
  },
};

interface ProblemInputProps {
  initialTopic?: string;
  theme?: ThemeColor;
  placeholder?: string;
}

export function ProblemInput({ initialTopic, theme = "neutral", placeholder: propPlaceholder }: ProblemInputProps) {
  const { t } = useI18n();
  const placeholder = propPlaceholder || t('problemInput.placeholder');
  const [problem, setProblem] = useState(initialTopic || "");
  const [isLoading, setIsLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const router = useRouter();

  const examplePrompts = [
    t('problemInput.examplePrompt1'),
    t('problemInput.examplePrompt2'),
    t('problemInput.examplePrompt3'),
    t('problemInput.examplePrompt4'),
  ];

  const styles = themeStyles[theme];

  // Sync when parent changes the topic
  if (initialTopic && initialTopic !== problem && !isLoading) {
    setProblem(initialTopic);
  }

  const handleStart = async () => {
    if (!problem.trim()) return;
    setIsLoading(true);
    setUsageError(null);

    // Check usage limits
    try {
      const res = await fetch("/api/check-usage");
      if (res.ok) {
        const usage = await res.json();
        if (!usage.allowed) {
          setUsageError(t('problemInput.sessionLimitReached'));
          setIsLoading(false);
          return;
        }
      } else {
        // If check fails, block to be safe
        setUsageError(t('problemInput.usageError'));
        setIsLoading(false);
        return;
      }
    } catch {
      // If network fails, block to be safe
      setUsageError(t('problemInput.usageError'));
      setIsLoading(false);
      return;
    }

    try {
      // Create session in Supabase
      const session = await createSession(problem.trim());
      // Legacy no-op: older clients still POST here after session create
      fetch("/api/check-usage", { method: "POST" }).catch(() => {});
      // Navigate to session page with DB id
      router.push(`/session?id=${session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setUsageError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <textarea
          id="problem"
          value={problem}
          onChange={(e) => { setProblem(e.target.value); setUsageError(null); }}
          placeholder={placeholder}
          className={`w-full h-28 px-4 pt-3.5 pb-14 pr-32 border rounded-2xl text-white text-[15px] focus:outline-none resize-none transition-colors scrollbar-hide overflow-hidden ${styles.textarea}`}
          disabled={isLoading}
        />
        <button
          onClick={handleStart}
          disabled={!problem.trim() || isLoading}
          className={`absolute right-4 bottom-4 px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${styles.button} ${styles.buttonDisabled}`}
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <MicIcon />
          )}
          {isLoading ? t('problemInput.starting') : t('problemInput.start')}
        </button>
      </div>
      {usageError && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {usageError}{" "}
          <Link href="/pricing" className="underline hover:text-red-300">
            {t('problemInput.viewPlans')}
          </Link>
        </div>
      )}

    </div>
  );
}

function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
