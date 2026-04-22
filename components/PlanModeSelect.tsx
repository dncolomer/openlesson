"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";

const MAX_ATTACHED_FILES = 5;

const WEEKS_OPTIONS = [
  { value: 1, label: "planMode.week1" },
  { value: 2, label: "planMode.week2" },
  { value: 4, label: "planMode.month1" },
  { value: 8, label: "planMode.month2" },
  { value: 12, label: "planMode.month3" },
  { value: 26, label: "planMode.month6" },
];

const DEFAULT_EXAMPLE_TOPICS = [
  "planMode.exampleMachineLearning",
  "planMode.examplePhilosophy",
  "planMode.exampleQuantumPhysics",
  "planMode.exampleWorldHistory",
  "planMode.exampleCreativeWriting",
  "planMode.examplePersonalFinance",
];

type ThemeColor = "neutral" | "teal" | "slate" | "blue" | "amber" | "violet";

const themeStyles: Record<ThemeColor, {
  textarea: string;
  button: string;
  buttonDisabled: string;
  weekActive: string;
  weekInactive: string;
  topicPill: string;
  label: string;
  description: string;
  tabActive: string;
  tabInactive: string;
}> = {
  neutral: {
    textarea: "bg-neutral-900/80 border-neutral-800 focus:border-neutral-600 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-800 disabled:text-neutral-600",
    weekActive: "bg-white/15 text-white border-neutral-600",
    weekInactive: "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300",
    topicPill: "text-neutral-500 hover:text-white bg-neutral-900/50 hover:bg-neutral-800 border-neutral-800 hover:border-neutral-700",
    label: "text-neutral-400",
    description: "text-neutral-500",
    tabActive: "bg-white/10 text-white border-b-2 border-white",
    tabInactive: "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent",
  },
  teal: {
    textarea: "bg-teal-950/50 border-teal-900/50 focus:border-teal-700 placeholder-teal-600/50",
    button: "bg-teal-500 hover:bg-teal-400 text-white",
    buttonDisabled: "disabled:bg-teal-900/50 disabled:text-teal-700",
    weekActive: "bg-teal-500/20 text-teal-400 border-teal-500/50",
    weekInactive: "bg-teal-950/30 border-teal-900/50 text-teal-400/60 hover:border-teal-700 hover:text-teal-300",
    topicPill: "text-teal-400/60 hover:text-teal-300 bg-teal-950/30 hover:bg-teal-900/40 border-teal-900/50 hover:border-teal-700",
    label: "text-teal-400/70",
    description: "text-teal-400/60",
    tabActive: "bg-teal-500/20 text-teal-300 border-b-2 border-teal-400",
    tabInactive: "text-teal-500/60 hover:text-teal-400 border-b-2 border-transparent",
  },
  slate: {
    textarea: "bg-slate-900/50 border-slate-800 focus:border-slate-600 placeholder-slate-600",
    button: "bg-slate-200 hover:bg-white text-slate-900",
    buttonDisabled: "disabled:bg-slate-800 disabled:text-slate-600",
    weekActive: "bg-slate-700/50 text-slate-200 border-slate-600",
    weekInactive: "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300",
    topicPill: "text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border-slate-800 hover:border-slate-700",
    label: "text-slate-400",
    description: "text-slate-500",
    tabActive: "bg-slate-700/50 text-white border-b-2 border-slate-400",
    tabInactive: "text-slate-500 hover:text-slate-300 border-b-2 border-transparent",
  },
  blue: {
    textarea: "bg-blue-950/50 border-blue-900/50 focus:border-blue-700 placeholder-blue-600/50",
    button: "bg-blue-500 hover:bg-blue-400 text-white",
    buttonDisabled: "disabled:bg-blue-900/50 disabled:text-blue-700",
    weekActive: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    weekInactive: "bg-blue-950/30 border-blue-900/50 text-blue-400/60 hover:border-blue-700 hover:text-blue-300",
    topicPill: "text-blue-400/60 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40 border-blue-900/50 hover:border-blue-700",
    label: "text-blue-400/70",
    description: "text-blue-300/60",
    tabActive: "bg-blue-500/20 text-blue-300 border-b-2 border-blue-400",
    tabInactive: "text-blue-500/60 hover:text-blue-400 border-b-2 border-transparent",
  },
  amber: {
    textarea: "bg-amber-950/50 border-amber-900/50 focus:border-amber-700 placeholder-amber-600/50",
    button: "bg-amber-500 hover:bg-amber-400 text-black",
    buttonDisabled: "disabled:bg-amber-900/50 disabled:text-amber-700",
    weekActive: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    weekInactive: "bg-amber-950/30 border-amber-900/50 text-amber-400/60 hover:border-amber-700 hover:text-amber-300",
    topicPill: "text-amber-400/60 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-900/40 border-amber-900/50 hover:border-amber-700",
    label: "text-amber-400/70",
    description: "text-amber-400/60",
    tabActive: "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400",
    tabInactive: "text-amber-500/60 hover:text-amber-400 border-b-2 border-transparent",
  },
  violet: {
    textarea: "bg-violet-950/50 border-violet-900/50 focus:border-violet-700 placeholder-violet-600/50",
    button: "bg-violet-500 hover:bg-violet-400 text-white",
    buttonDisabled: "disabled:bg-violet-900/50 disabled:text-violet-700",
    weekActive: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    weekInactive: "bg-violet-950/30 border-violet-900/50 text-violet-400/60 hover:border-violet-700 hover:text-violet-300",
    topicPill: "text-violet-400/60 hover:text-violet-300 bg-violet-950/30 hover:bg-violet-900/40 border-violet-900/50 hover:border-violet-700",
    label: "text-violet-400/70",
    description: "text-violet-400/60",
    tabActive: "bg-violet-500/20 text-violet-300 border-b-2 border-violet-400",
    tabInactive: "text-violet-500/60 hover:text-violet-400 border-b-2 border-transparent",
  },
};

interface PlanModeSelectProps {
  theme?: ThemeColor;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  exampleTopics?: string[];
  /** @deprecated YouTube tab has been removed. Prop kept for backward compatibility. */
  showYouTubeTab?: boolean;
}

export function PlanModeSelect({ 
  theme = "neutral",
  title,
  subtitle,
  placeholder,
  exampleTopics,
}: PlanModeSelectProps) {
  const { t } = useI18n();
  const defaultTitle = t('planMode.buildYourLearningPath');
  const defaultPlaceholder = placeholder ?? t('problemInput.placeholder');
  const defaultExampleTopics = exampleTopics?.map(key => t(key)) ?? DEFAULT_EXAMPLE_TOPICS.map(key => t(key));
  
  const displayTitle = title ?? defaultTitle;
  const displayPlaceholder = placeholder ?? defaultPlaceholder;

  const displaySubtitle = subtitle ?? t('planMode.subtitleWithoutYoutube');
  const [topic, setTopic] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFileZone, setShowFileZone] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const styles = themeStyles[theme];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Paste listener: images pasted anywhere on the page are added to attachedFiles
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) break;
          if (attachedFiles.length >= MAX_ATTACHED_FILES) break;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            setAttachedFiles(prev =>
              prev.length < MAX_ATTACHED_FILES
                ? [...prev, { name: file.name || "pasted-image.png", mimeType: file.type, data: base64, size: file.size, preview: dataUrl }]
                : prev
            );
            setShowFileZone(true);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [attachedFiles.length]);

  const handleGeneratePlan = async () => {
    if (!topic.trim()) {
      setError(t('planMode.enterTopic'));
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=plan");
        return;
      }

      const body = {
        topic: topic.trim(),
        days: weeks * 7,
        ...(attachedFiles.length > 0 ? {
          files: attachedFiles.map(f => ({ name: f.name, mimeType: f.mimeType, data: f.data }))
        } : {}),
      };

      const response = await fetch("/api/learning-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate plan");
      }

      const data = await response.json();
      router.push(`/plan/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('planMode.somethingWrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGeneratePlan();
    }
  };

  const isGenerateDisabled = !topic.trim() || isGenerating;

  return (
    <div className="w-full max-w-2xl p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
          {displayTitle}
        </h2>
        <p className={`max-w-lg mx-auto text-sm leading-relaxed ${styles.description}`}>
          {displaySubtitle}
        </p>
      </div>

      {/* Input Area */}
      <div className="mb-8">
        <div className="relative">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
            rows={3}
            className={`w-full h-28 px-4 pt-3.5 pb-14 pr-32 border rounded-2xl text-white text-[15px] focus:outline-none resize-none transition-colors ${styles.textarea}`}
            disabled={isGenerating}
          />
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerateDisabled}
            className={`absolute right-4 bottom-4 px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${styles.button} ${styles.buttonDisabled}`}
          >
            {isGenerating ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isGenerating ? t('planMode.analyzing') : t('planMode.generate')}
          </button>
        </div>

        {/* Attachment area */}
        <div className="mt-3 space-y-2">
          <button
            onClick={() => setShowFileZone(!showFileZone)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${
              attachedFiles.length > 0
                ? "text-blue-400 border-blue-500/40 bg-blue-500/10"
                : styles.topicPill
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
            {attachedFiles.length > 0
              ? `${attachedFiles.length} ${attachedFiles.length === 1 ? t('planFiles.fileAttached') : t('planFiles.filesAttached')}`
              : t('planFiles.attachFiles')}
          </button>

          {showFileZone && (
            <FileDropZone
              files={attachedFiles}
              onChange={setAttachedFiles}
              className="mt-1"
            />
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Weeks Selector */}
      <div className="mb-6">
        <label className={`block text-sm mb-3 ${styles.label}`}>
          {t('planMode.howLongPlan')}
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setWeeks(option.value)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                weeks === option.value
                  ? styles.weekActive
                  : styles.weekInactive
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Example topic pills */}
      <div className="flex flex-wrap gap-2">
        {defaultExampleTopics.map((topicItem) => (
          <button
            key={topicItem}
            onClick={() => setTopic(topicItem)}
            disabled={isGenerating}
            className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${styles.topicPill}`}
          >
            {topicItem}
          </button>
        ))}
      </div>
    </div>
  );
}
