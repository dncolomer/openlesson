"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";
import { TopicBrowser } from "@/components/TopicBrowser";
import { createSession } from "@/lib/storage";
import { InitialChaptersPicker } from "@/components/InitialChaptersPicker";
import {
  DEFAULT_INITIAL_CHAPTERS,
  parseInitialChaptersLevel,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";

const MAX_ATTACHED_FILES = 5;

const WEEKS_OPTIONS = [
  { value: 1, label: "planMode.week1" },
  { value: 2, label: "planMode.week2" },
  { value: 4, label: "planMode.month1" },
  { value: 8, label: "planMode.month2" },
  { value: 12, label: "planMode.month3" },
  { value: 26, label: "planMode.month6" },
];

interface HumanModeSelectProps {
  /** Optional topic pre-fill from the TopicBrowser or external source. */
  initialTopic?: string;
  /**
   * When true, renders the composer in a tighter, column-friendly layout
   * suitable for a side-by-side hero (smaller title, reduced padding,
   * tighter vertical rhythm). Defaults to false (full centered hero).
   */
  compact?: boolean;
}

/**
 * Unified "Human" tab — the merged Learn + Plan experience.
 *
 * A single topic composer drives two actions:
 *   • "Quick Session" — creates a session immediately (optionally with files
 *     uploaded for context) and jumps into `/session?id=…`.
 *   • "Generate Workspace" — builds a multi-node workspace from the topic +
 *     attachments + chosen duration, then redirects to `/workspace/{id}`.
 *
 * Time picker + attachments apply to both actions (the "Quick Session"
 * flow only uses the attachments; duration is plan-only but it is left in
 * the same widget for simplicity).
 */
export function HumanModeSelect({ initialTopic = "", compact = false }: HumanModeSelectProps) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [topic, setTopic] = useState(initialTopic);
  const [weeks, setWeeks] = useState(4);
  const [initialChapters, setInitialChapters] = useState<InitialChaptersLevel>(DEFAULT_INITIAL_CHAPTERS);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFileZone, setShowFileZone] = useState(false);
  const [busy, setBusy] = useState<null | "session" | "plan">(null);
  const [error, setError] = useState("");

  // Sync topic from parent (e.g. user clicked a topic in the browser below)
  useEffect(() => {
    if (initialTopic && initialTopic !== topic) {
      setTopic(initialTopic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  // Paste listener — pasted images are appended to the attachments list.
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
            setAttachedFiles((prev) =>
              prev.length < MAX_ATTACHED_FILES
                ? [
                    ...prev,
                    {
                      name: file.name || "pasted-image.png",
                      mimeType: file.type,
                      data: base64,
                      size: file.size,
                      preview: dataUrl,
                    },
                  ]
                : prev,
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

  async function ensureAuth(redirectHint: "session" | "plan"): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=${redirectHint}`);
      return null;
    }
    return user.id;
  }

  async function handleQuickSession() {
    if (!topic.trim()) {
      setError(t("planMode.enterTopic"));
      return;
    }
    setError("");
    setBusy("session");
    try {
      const uid = await ensureAuth("session");
      if (!uid) return;

      // Usage check (same as ProblemInput)
      const res = await fetch("/api/check-usage");
      if (res.ok) {
        const usage = await res.json();
        if (!usage.allowed) {
          setError(t("problemInput.sessionLimitReached"));
          return;
        }
      } else {
        setError(t("problemInput.usageError"));
        return;
      }

      const session = await createSession(topic.trim());
      // NOTE: Quick Session doesn't currently support attaching files as
      // context (workspace_files are tied to a learning_plan). If the user
      // attached files they'll be ignored here — the UI shows a small
      // hint so this isn't silent. Future work: a session_context_files
      // table or a workspace_id fallback. For now, `Generate Workspace` is the
      // path that honors attachments.
      fetch("/api/check-usage", { method: "POST" }).catch(() => {});
      router.push(`/session?id=${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("planMode.somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  async function handleGeneratePlan() {
    if (!topic.trim()) {
      setError(t("planMode.enterTopic"));
      return;
    }
    setError("");
    setBusy("plan");
    try {
      const uid = await ensureAuth("plan");
      if (!uid) return;

      const body = {
        topic: topic.trim(),
        days: weeks * 7,
        initialChapters,
        ...(attachedFiles.length > 0
          ? {
              files: attachedFiles.map((f) => ({
                name: f.name,
                mimeType: f.mimeType,
                data: f.data,
              })),
            }
          : {}),
      };

      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate plan");
      }
      const data = await response.json();
      router.push(`/workspace/${data.workspaceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("planMode.somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter (without shift) triggers the primary action: Quick Session.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleQuickSession();
    }
  }

  const inputDisabled = busy !== null;
  const submitDisabled = !topic.trim() || busy !== null;

  return (
    <div className={compact ? "w-full" : "w-full max-w-3xl mx-auto px-4 sm:px-6"}>
      {/* Hero title + subtitle — only shown in non-compact mode. The
          compact layout expects a parent header to carry the title. */}
      {!compact && (
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            {t("home.heroTitle")}
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            {t("home.heroSubtitle")}
          </p>
        </div>
      )}

      {/* Topic input */}
      <div className="relative">
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("problemInput.placeholder")}
          rows={3}
          disabled={inputDisabled}
          className={`w-full px-4 pt-3.5 pb-4 border rounded-2xl text-white text-[15px] focus:outline-none resize-none transition-colors bg-slate-900/50 border-slate-800 focus:border-slate-600 placeholder-slate-600 ${
            compact ? "h-44" : "h-28"
          }`}
        />
      </div>

      {/* Tool row — attachments toggle + plan-length dropdown, sitting
          on a single line directly below the textarea. Compact-friendly. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFileZone((v) => !v)}
          disabled={inputDisabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${
            attachedFiles.length > 0
              ? "text-neutral-300 border-neutral-600/40 bg-neutral-800/10"
              : "text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border-slate-800 hover:border-slate-700"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
          {attachedFiles.length > 0
            ? `${attachedFiles.length} ${
                attachedFiles.length === 1
                  ? t("workspaceFiles.fileAttached")
                  : t("workspaceFiles.filesAttached")
              }`
            : t("workspaceFiles.attachFiles")}
        </button>

        {/* Plan length dropdown — compact select with custom chevron. */}
        <div className="relative inline-flex items-center">
          <label className="text-xs text-slate-500 mr-2">
            {t("planMode.howLongPlan")}
          </label>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            disabled={inputDisabled}
            aria-label={t("planMode.howLongPlan")}
            className="appearance-none bg-slate-900/50 border border-slate-800 hover:border-slate-700 focus:border-slate-600 focus:outline-none rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-200 cursor-pointer transition-colors"
          >
            {WEEKS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded file drop zone (only when toggled on) */}
      {showFileZone && (
        <div className="mt-2 space-y-2">
          <FileDropZone
            files={attachedFiles}
            onChange={setAttachedFiles}
          />
          {attachedFiles.length > 0 && (
            <p className="text-[11px] text-slate-500 leading-snug">
              {t("home.attachmentsHint")}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <label className="mb-2 block text-xs text-slate-500">
          {t("planMode.initialChapters")}
        </label>
        <InitialChaptersPicker
          value={initialChapters}
          onChange={(id) => setInitialChapters(parseInitialChaptersLevel(id))}
          disabled={inputDisabled}
          t={t}
          i18nPrefix="planMode"
        />
      </div>

      {/* Action buttons — two equally-weighted CTAs */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Quick Session — primary, immediate start */}
        <button
          type="button"
          onClick={handleQuickSession}
          disabled={submitDisabled}
          className="py-3 px-5 text-sm font-semibold rounded-xl bg-green-500 text-neutral-950 hover:bg-green-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-[0_0_32px_rgba(34,197,94,0.22)]"
        >
          {busy === "session" ? (
            <LoadingSpinner />
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {busy === "session" ? t("home.startingSession") : t("home.quickSession")}
        </button>

        {/* Generate Workspace — secondary, builds a multi-node workspace */}
        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={submitDisabled}
          className="py-3 px-5 text-sm font-semibold rounded-xl bg-slate-200 text-slate-900 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {busy === "plan" ? (
            <LoadingSpinner dark />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          {busy === "plan" ? t("planMode.analyzing") : t("home.generatePlan")}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}{" "}
          {error === t("problemInput.sessionLimitReached") && (
            <Link href="/pricing" className="underline hover:text-red-300">
              {t("problemInput.viewPlans")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <svg
      className={`w-5 h-5 animate-spin ${dark ? "text-slate-900" : "text-current"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Re-export TopicBrowser so the page can render the topic chooser
// alongside the composer without needing its own import.
export { TopicBrowser };
