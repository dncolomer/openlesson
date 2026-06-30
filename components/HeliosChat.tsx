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

export type StuckAction = "ask" | "theory" | "practice" | "canvas" | "notebook" | "break";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  /** When true, renders as a typing indicator until content is ready. */
  pending?: boolean;
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
  activeStepIndex?: number;
  activeStep?: { id: string; description: string; status?: string; type?: string };
  totalSteps?: number;
  sessionPlan?: unknown;
  /** When set, auto-submits it as a user message and clears via the callback */
  pendingMessage?: string | PendingChatMessage | null;
  onPendingMessageHandled?: () => void;
  isMicOn?: boolean;
}

// Helios first-person welcome — unified across probe panel and chat.
// The voice matches the BASE_SYSTEM_PROMPT in /api/session-chat.
const CHAT_WELCOME_MESSAGES: Record<string, string> = {
  en: "Hey, I'm Helios. I'm here with you for this chapter, following your thinking and helping you turn the prompt into something clearer.",
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

function shouldSuggestGrokLookup(text: string) {
  const normalized = text.toLowerCase();
  return /\b(answer|answers|specific answer|exact answer|what is|who is|when is|define|definition|lookup|search)\b/.test(normalized);
}

const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export function HeliosChat({ problem, messages: externalMessages, onMessagesChange, sessionId, tutoringLanguage, activeStepIndex = 0, activeStep, totalSteps = 0, sessionPlan, pendingMessage, onPendingMessageHandled, isMicOn = false }: HeliosChatProps) {
  const { t } = useI18n();

  // Get localized welcome message based on tutoring language
  const getWelcomeContent = () => {
    return tutoringLanguage && CHAT_WELCOME_MESSAGES[tutoringLanguage]
      ? CHAT_WELCOME_MESSAGES[tutoringLanguage]
      : CHAT_WELCOME_MESSAGES.en;
  };

  const [generatedWelcome, setGeneratedWelcome] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedWelcome(null);
  }, [sessionId, activeStep?.id]);

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
  }, [sessionId, problem, tutoringLanguage, generatedWelcome, activeStep?.id]);

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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    const stored = window.localStorage.getItem("openlesson:helios-auto-voice");
    if (stored === "1") setAutoVoiceEnabled(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("openlesson:helios-auto-voice", autoVoiceEnabled ? "1" : "0");
  }, [autoVoiceEnabled]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [visibleMessages.length, isLoading]);

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
    if (shouldSuggestGrokLookup(userMsg.content)) {
      const grokUrl = `https://grok.com/?q=${encodeURIComponent(userMsg.content)}`;
      updateMessages([
        ...messages,
        userMsg,
        {
          id: `${Date.now()}-grok`,
          role: "assistant",
          content: `For a direct lookup you can also ask [Grok](${grokUrl}).`,
        },
      ]);
    }
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
          activeStepIndex,
          activeStepId: activeStep?.id,
          activeStepDescription: activeStep?.description,
          sessionPlan,
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
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-5 border-b border-neutral-800 bg-neutral-950/35">
        <div className="flex items-center gap-2.5">
          <HeliosAvatar size={26} />
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">{t('heliosChat.assistant')}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeStep && (
            <div className="flex min-w-0 max-w-[12rem] items-center gap-2 rounded-lg border border-neutral-700/80 bg-neutral-900/90 px-2.5 py-1.5 text-[10px] text-neutral-400 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:max-w-[22rem] sm:gap-2.5 sm:px-3 sm:text-[11px]">
              <span className="shrink-0 font-semibold uppercase tracking-[0.14em] text-red-100">
                Chapter {activeStepIndex + 1}{totalSteps ? `/${totalSteps}` : ""}
              </span>
              <span className="hidden truncate sm:inline">{activeStep.description}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (autoVoiceEnabled) {
                stopAutoVoice();
                setAutoVoiceEnabled(false);
                return;
              }

              const existingAssistantIds = messages
                .filter((message) => message.role === "assistant" && !message.pending)
                .map((message) => message.id);
              spokenMessageIdsRef.current = new Set(existingAssistantIds);
              setVoiceReadyMessageIds(new Set(existingAssistantIds));
              setAutoVoiceEnabled(true);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
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
            className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors"
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
          if (message.role === "assistant" && message.pending) {
            return (
              <div
                key={message.id}
                className="flex items-start gap-2 justify-start"
              >
                <HeliosAvatar size={28} />
                <div className="bg-neutral-800 rounded-md px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && <HeliosAvatar size={28} />}
              <div
                className={`max-w-[85%] rounded-md px-4 py-2.5 text-sm ${
                  message.role === "user"
                    ? "bg-neutral-100 text-black"
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
                      className="mt-3 max-h-64 rounded-md border border-white/20 object-contain"
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
            <div className="bg-neutral-800 rounded-md px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
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
