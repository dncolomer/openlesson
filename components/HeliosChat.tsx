"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "../lib/i18n";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { emitHeliosVoicePlayback } from "@/lib/useHeliosVoicePlayback";

const XAI_LANG_MAP: Record<string, string> = {
  en: "en",
  zh: "zh",
  vi: "vi",
  de: "de",
  pl: "auto",
  es: "es-ES",
};

// Process content to handle common LaTeX escaping issues from LLMs
function processLatexContent(content: string): string {
  // Fix double-escaped backslashes that LLMs sometimes produce
  // e.g., \\frac -> \frac, \\sum -> \sum
  return content
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/<\/?(?:system|developer|assistant|user|tool|system-reminder)[^>]*>/gi, "")
    .replace(/```(?:system|developer|tool|assistant|user)[\s\S]*?```/gi, "")
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')  // \\command -> \command
    .replace(/\\\\\[/g, '\\[')  // \\[ -> \[
    .replace(/\\\\\]/g, '\\]')  // \\] -> \]
    .replace(/\\\\\(/g, '\\(')  // \\( -> \(
    .replace(/\\\\\)/g, '\\)'); // \\) -> \)
}

/**
 * Optional rich-message kinds. When set on an assistant message the
 * chat renders it as a full-width "smart card" instead of the regular
 * Helios speech bubble — header strip + icon + label up top, markdown
 * body below. Used for prep-material that the Helios prep endpoint
 * produces (theory / practice for a given step).
 *
 * Intentionally a string union (not a boolean) so we can add more
 * card kinds later without another flag.
 */
export type ChatMessageKind = "theory" | "practice" | "stuck";
export type StuckAction = "ask" | "theory" | "practice" | "canvas" | "notebook" | "break";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  /**
   * When set and `role === "assistant"`, the message renders as a
   * full-width smart card matching this kind.
   */
  kind?: ChatMessageKind;
  /** Optional card title shown in the header strip next to the kind label. */
  cardTitle?: string;
  /**
   * When true and `role === "assistant"`, the message renders as a
   * typing-style bouncing-dots placeholder instead of its `content`.
   * Lets parent components (e.g. SessionView's Practice/Theory step
   * actions) inject a placeholder message that visually matches the
   * built-in "Helios is replying" indicator and replace it with real
   * markdown once the fetch resolves.
   *
   * Optional `pendingLabel` is rendered next to the dots — for things
   * like "Preparing practice tasks…".
   *
   * When `pending` is set together with `kind`, the placeholder is
   * rendered card-shaped so swapping in the real content doesn't
   * cause a layout jump.
   */
  pending?: boolean;
  pendingLabel?: string;
}

export interface PendingChatMessage {
  text: string;
  imageDataUrl?: string;
}

interface HeliosChatProps {
  problem: string;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  sessionId?: string;
  tutoringLanguage?: string;
  /** When set, auto-submits it as a user message and clears via the callback */
  pendingMessage?: string | PendingChatMessage | null;
  onPendingMessageHandled?: () => void;
  onStuckAction?: (action: StuckAction) => void;
  stuckActions?: StuckAction[];
  isMicOn?: boolean;
}

// Helios first-person welcome — unified across probe panel and chat.
// The voice matches the BASE_SYSTEM_PROMPT in /api/session-chat.
const CHAT_WELCOME_MESSAGES: Record<string, string> = {
  en: "Hey, I'm Helios. I'm here with you for this session, following your thinking and helping you turn the next step into something clearer.\n\nWhere would you like to begin?",
  es: "Hola — soy Helios. Este chat es donde mis preguntas y tus respuestas fluyen juntas.\n\n¿En qué estás trabajando ahora mismo?",
  vi: "Chào — tôi là Helios. Đây là nơi các câu hỏi của tôi và câu trả lời của bạn cùng tiếp diễn.\n\nBạn đang làm gì vậy?",
  zh: "嘿 — 我是 Helios。我的问题和你的回应都会在这个聊天里连续展开。\n\n你现在在研究什么？",
  de: "Hey — ich bin Helios. In diesem Chat laufen meine Fragen und deine Antworten zusammen.\n\nWoran arbeitest du gerade?",
  pl: "Cześć — jestem Helios. Tutaj moje pytania i twoje odpowiedzi płyną razem.\n\nNad czym teraz pracujesz?",
  ca: "Hola — sóc Helios. En aquest xat les meves preguntes i les teves respostes avancen juntes.\n\nEn què estàs treballant ara mateix?",
};

// Small circular avatar with a violet gradient and a serif "H" — matches the
// Helios avatar used in PerformanceChat so the brand reads as one entity.
function HeliosAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full bg-gradient-to-br from-violet-500/20 via-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-serif text-neutral-200" style={{ fontSize: size * 0.5 }}>H</span>
    </div>
  );
}

// Visual chrome shared by Theory / Practice smart cards and their
// pending placeholders. Centralised so the swap-in of real content
// after the fetch resolves doesn't visibly change card width / border.
//
// Both kinds use a neutral grey/white frame — the kind icon and
// label are enough to differentiate them, and the framing reads as
// "structured artifact" without competing with the chat palette
// (which is already neutral). Body stays neutral so markdown still
// reads as part of the chat surface, just framed.
const CARD_KIND_META: Record<
  ChatMessageKind,
  { label: string; icon: React.ReactNode; headerClass: string; ringClass: string }
> = {
  theory: {
    label: "Theory",
    headerClass:
      "bg-neutral-800/60 text-neutral-200 border-b border-neutral-700",
    ringClass: "border-neutral-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  practice: {
    label: "Practice",
    headerClass:
      "bg-neutral-800/60 text-neutral-200 border-b border-neutral-700",
    ringClass: "border-neutral-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  stuck: {
    label: "Stuck Check",
    headerClass:
      "bg-amber-500/15 text-amber-100 border-b border-amber-400/30",
    ringClass: "border-amber-400/40 shadow-[0_0_28px_rgba(245,158,11,0.12)]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm-8.485 2.25L10.06 4.69a2.25 2.25 0 013.88 0l6.545 11.81A2.25 2.25 0 0118.545 20H5.455a2.25 2.25 0 01-1.94-3.5z" />
      </svg>
    ),
  },
};

function SmartCardShell({
  kind,
  title,
  children,
}: {
  kind: ChatMessageKind;
  title?: string;
  children: React.ReactNode;
}) {
  const meta = CARD_KIND_META[kind];
  return (
    <div
      className={`w-full rounded-2xl border ${meta.ringClass} bg-neutral-900/60 overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider ${meta.headerClass}`}
      >
        {meta.icon}
        <span>{meta.label}</span>
        {title && (
          <>
            <span className="text-neutral-500/60">·</span>
            <span className="truncate text-neutral-300 normal-case tracking-normal text-xs font-normal">
              {title}
            </span>
          </>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

const STUCK_ACTIONS: Array<{ action: StuckAction; label: string }> = [
  { action: "ask", label: "Ask Helios" },
  { action: "theory", label: "Get theory" },
  { action: "practice", label: "Try practice" },
  { action: "canvas", label: "Use Canvas" },
  { action: "notebook", label: "Use Notebook" },
  { action: "break", label: "Take a break" },
];

export function HeliosChat({ problem, messages: externalMessages, onMessagesChange, sessionId, tutoringLanguage, pendingMessage, onPendingMessageHandled, onStuckAction, stuckActions, isMicOn = false }: HeliosChatProps) {
  const { t } = useI18n();

  // Get localized welcome message based on tutoring language
  const getWelcomeContent = () => {
    return tutoringLanguage && CHAT_WELCOME_MESSAGES[tutoringLanguage]
      ? CHAT_WELCOME_MESSAGES[tutoringLanguage]
      : CHAT_WELCOME_MESSAGES.en;
  };

  const [generatedWelcome, setGeneratedWelcome] = useState<string | null>(null);

  // Use external state if provided, otherwise use internal state
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const messages = externalMessages ?? internalMessages;

  // Initialize or update welcome message when tutoringLanguage changes
  useEffect(() => {
    const welcomeMsg = {
      id: "welcome",
      role: "assistant" as const,
      content: generatedWelcome || getWelcomeContent(),
    };

    if (externalMessages !== undefined) {
      // Using external state - update the welcome message in external state
      if (externalMessages.length === 0) {
        onMessagesChange?.([welcomeMsg]);
      } else if (externalMessages[0]?.id === "welcome") {
        // Replace existing welcome message with localized version
        onMessagesChange?.([welcomeMsg, ...externalMessages.slice(1)]);
      }
    } else if (internalMessages.length === 0) {
      // Using internal state - initialize with welcome message
      setInternalMessages([welcomeMsg]);
    }
  }, [tutoringLanguage, generatedWelcome]);

  useEffect(() => {
    if (!sessionId || generatedWelcome) return;
    let cancelled = false;

    fetch("/api/session-chat/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, problem, tutoringLanguage }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const message = typeof data?.message === "string" ? data.message.trim() : "";
        if (!cancelled && message) setGeneratedWelcome(message);
      })
      .catch((error) => {
        console.warn("Helios welcome generation failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, problem, tutoringLanguage, generatedWelcome]);

  // Helper to update messages - handles both internal state and external callback
  const updateMessages = (newMessages: ChatMessage[]) => {
    if (onMessagesChange) {
      onMessagesChange(newMessages);
    } else {
      setInternalMessages(newMessages);
    }
  };

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(false);
  const [voiceReadyMessageIds, setVoiceReadyMessageIds] = useState<Set<string>>(new Set());
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const autoVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoVoiceAbortRef = useRef<AbortController | null>(null);
  const autoVoiceUrlRef = useRef<string | null>(null);
  const autoVoiceSourceIdRef = useRef(`helios-chat-${Math.random().toString(36).slice(2, 10)}`);

  const stopAutoVoice = () => {
    try {
      autoVoiceAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
    autoVoiceAbortRef.current = null;
    if (autoVoiceAudioRef.current) {
      try {
        autoVoiceAudioRef.current.pause();
      } catch {
        /* ignore */
      }
      autoVoiceAudioRef.current = null;
    }
    if (autoVoiceUrlRef.current) {
      URL.revokeObjectURL(autoVoiceUrlRef.current);
      autoVoiceUrlRef.current = null;
    }
    emitHeliosVoicePlayback(autoVoiceSourceIdRef.current, false);
  };

  useEffect(() => {
    return () => stopAutoVoice();
  }, []);

  useEffect(() => {
    if (!autoVoiceEnabled) return;
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) =>
        message.role === "assistant" &&
        !message.pending &&
        message.content.trim() &&
        !spokenMessageIdsRef.current.has(message.id)
      );
    if (!latestAssistantMessage) return;

    spokenMessageIdsRef.current.add(latestAssistantMessage.id);
    stopAutoVoice();

    const controller = new AbortController();
    autoVoiceAbortRef.current = controller;
    const lang = tutoringLanguage ? XAI_LANG_MAP[tutoringLanguage] ?? "auto" : "auto";

    fetch("/api/xai-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: latestAssistantMessage.content, language: lang }),
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.blob() : null)
      .then(async (blob) => {
        if (!blob || controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        autoVoiceUrlRef.current = url;
        setVoiceReadyMessageIds((current) => new Set(current).add(latestAssistantMessage.id));
        const audio = new Audio(url);
        const markPlaying = () => emitHeliosVoicePlayback(autoVoiceSourceIdRef.current, true);
        const markStopped = () => emitHeliosVoicePlayback(autoVoiceSourceIdRef.current, false);
        audio.addEventListener("playing", markPlaying);
        audio.addEventListener("ended", markStopped);
        audio.addEventListener("pause", markStopped);
        audio.addEventListener("error", markStopped);
        autoVoiceAudioRef.current = audio;
        try {
          await audio.play();
        } catch {
          /* Browser autoplay policy or audio failure — silent. */
        }
      })
      .catch(() => {
        setVoiceReadyMessageIds((current) => new Set(current).add(latestAssistantMessage.id));
        /* abort or network failure — silent */
      });
  }, [messages, autoVoiceEnabled, tutoringLanguage]);

  const visibleMessages = messages.filter((message) => {
    if (!autoVoiceEnabled || !isMicOn) return true;
    if (message.role !== "assistant" || message.pending) return true;
    if (message.id === "welcome") return true;
    return spokenMessageIdsRef.current.has(message.id) && voiceReadyMessageIds.has(message.id);
  });

  // Core send logic shared by form submit and programmatic pendingMessage
  const sendMessage = async (payload: string | PendingChatMessage) => {
    const text = typeof payload === "string" ? payload : payload.text;
    const imageDataUrl = typeof payload === "string" ? undefined : payload.imageDataUrl;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      imageDataUrl,
    };

    updateMessages([...messages, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
        imageDataUrl: m.imageDataUrl,
      }));

      const response = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          messages: [...conversationHistory, { role: "user", content: userMsg.content, imageDataUrl: userMsg.imageDataUrl }],
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.message) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
        };
        // Need to include user message + assistant message since we're using spread
        updateMessages([...messages, userMsg, assistantMessage]);
      }
    } catch (error) {
      console.error("Helios Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t('heliosChat.errorMessage'),
      };
      updateMessages([...messages, userMsg, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  // Auto-submit pendingMessage from parent (e.g. "Ask Helios" button on plan steps)
  useEffect(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage);
      onPendingMessageHandled?.();
    }
  }, [pendingMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    updateMessages([{
      id: "welcome",
      role: "assistant",
      content: getWelcomeContent(),
    }]);
    setShowClearConfirm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <HeliosAvatar size={22} />
          <h3 className="text-sm font-medium text-white">{t('heliosChat.assistant')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAutoVoiceEnabled((enabled) => {
                if (enabled) {
                  stopAutoVoice();
                } else {
                  const existingAssistantIds = messages
                    .filter((message) => message.role === "assistant" && !message.pending)
                    .map((message) => message.id);
                  spokenMessageIdsRef.current = new Set(existingAssistantIds);
                  setVoiceReadyMessageIds(new Set(existingAssistantIds));
                }
                return !enabled;
              });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors ${
              autoVoiceEnabled
                ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200"
                : "border-neutral-800 bg-neutral-900/80 text-neutral-500 hover:text-neutral-300"
            }`}
            title={t("heliosChat.autoVoiceTitle")}
            aria-pressed={autoVoiceEnabled}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoVoiceEnabled ? "bg-cyan-300" : "bg-neutral-600"}`} />
            {autoVoiceEnabled ? t("heliosChat.voiceOn") : t("heliosChat.voiceOff")}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
            title={t('heliosChat.clearChat')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {visibleMessages.map((message) => {
          // ── Smart card (theory / practice) ────────────────────────
          // Full-width artifact embedded in the chat stream. Used for
          // both the pending placeholder (so the swap-in of real
          // content doesn't shift layout) and the rendered card.
          if (message.role === "assistant" && message.kind) {
            const isPending = !!message.pending;
            return (
              <div key={message.id} className="w-full">
                <SmartCardShell kind={message.kind} title={message.cardTitle}>
                  {isPending ? (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      {message.pendingLabel && (
                        <span className="text-xs text-neutral-400">
                          {message.pendingLabel}
                        </span>
                      )}
                    </div>
                  ) : (
                    // Card body uses the same markdown-prose styles as
                    // a regular Helios bubble, but with extra spacing
                    // tuned for longer reference content. Practice
                    // (numbered tasks) gets list affordances.
                    <div
                      className={`prose prose-invert prose-sm max-w-none text-neutral-200 [&_.katex]:text-inherit ${
                        message.kind === "practice"
                          ? "[&_p]:mb-3 [&_p]:leading-relaxed [&_ol]:mb-3 [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:mb-3 [&_ul]:pl-5 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_strong]:text-white"
                          : message.kind === "stuck"
                            ? "[&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:leading-relaxed [&_strong]:text-amber-100"
                          : "[&_a]:no-underline [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:px-3 [&_a]:py-1.5 [&_a]:my-1 [&_a]:rounded-lg [&_a]:bg-neutral-900 [&_a]:text-white [&_a]:border [&_a]:border-neutral-700 hover:[&_a]:bg-neutral-800 hover:[&_a]:border-neutral-600 [&_a]:text-sm [&_a]:font-medium"
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                        components={markdownComponents}
                      >
                        {processLatexContent(message.content)}
                      </ReactMarkdown>
                      {message.kind === "stuck" && onStuckAction && !isPending && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {STUCK_ACTIONS.filter(({ action }) => !stuckActions || stuckActions.includes(action)).map(({ action, label }) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => onStuckAction(action)}
                              className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:border-amber-200/50 hover:bg-amber-300/20"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </SmartCardShell>
              </div>
            );
          }

          // ── Regular bubble pending placeholder ────────────────────
          // Same bouncing dots used for an in-flight chat fetch.
          if (message.role === "assistant" && message.pending) {
            return (
              <div
                key={message.id}
                className="flex items-start gap-2 justify-start"
              >
                <HeliosAvatar size={28} />
                <div className="bg-neutral-800 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  {message.pendingLabel && (
                    <span className="text-xs text-neutral-400">
                      {message.pendingLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // ── Regular speech bubble (default) ───────────────────────
          return (
            <div
              key={message.id}
              className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && <HeliosAvatar size={28} />}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-800 text-neutral-200"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none [&_.katex]:text-inherit">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                    components={markdownComponents}
                  >
                    {processLatexContent(message.content)}
                  </ReactMarkdown>
                  {message.imageDataUrl && (
                    <img
                      src={message.imageDataUrl}
                      alt="Submitted canvas"
                      className="mt-3 max-h-64 rounded-lg border border-white/20 object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-start gap-2 justify-start">
            <HeliosAvatar size={28} />
            <div className="bg-neutral-800 rounded-2xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        variant="destructive"
        title={t('heliosChat.clearChat')}
        description={t('heliosChat.clearConfirm')}
        confirmLabel={t('heliosChat.clearChat')}
        cancelLabel={t('common.cancel')}
      />

    </div>
  );
}
