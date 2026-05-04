"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "../lib/i18n";
import { ConfirmDialog } from "./ui/ConfirmDialog";

// Process content to handle common LaTeX escaping issues from LLMs
function processLatexContent(content: string): string {
  // Fix double-escaped backslashes that LLMs sometimes produce
  // e.g., \\frac -> \frac, \\sum -> \sum
  return content
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
export type ChatMessageKind = "theory" | "practice";

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
}

// Helios first-person welcome — unified across probe panel and chat.
// The voice matches the BASE_SYSTEM_PROMPT in /api/session-chat.
const CHAT_WELCOME_MESSAGES: Record<string, string> = {
  en: "Hey — I'm Helios. I also surface the probes in the side panel; here in Helios Chat you can just talk to me directly.\n\nWhat are you working through right now?",
  es: "Hola — soy Helios. También soy quien propone las sondas en el panel lateral; aquí en Helios Chat puedes hablar conmigo directamente.\n\n¿En qué estás trabajando ahora mismo?",
  vi: "Chào — tôi là Helios. Tôi cũng là người đưa ra các probe ở bảng bên; ở Helios Chat bạn có thể trò chuyện trực tiếp với tôi.\n\nBạn đang làm gì vậy?",
  zh: "嘿 — 我是 Helios。侧边栏里的探询问题也是我提的；在 Helios Chat 里你可以直接和我对话。\n\n你现在在研究什么？",
  de: "Hey — ich bin Helios. Ich bringe auch die Probes in der Seitenleiste an; hier im Helios Chat kannst du einfach direkt mit mir reden.\n\nWoran arbeitest du gerade?",
  pl: "Cześć — jestem Helios. To ja generuję sondy w panelu bocznym; tutaj w Helios Chat możesz po prostu porozmawiać ze mną bezpośrednio.\n\nNad czym teraz pracujesz?",
  ca: "Hola — sóc Helios. També soc qui fa aparèixer les sondes al panell lateral; aquí al Helios Chat pots parlar amb mi directament.\n\nEn què estàs treballant ara mateix?",
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

export function HeliosChat({ problem, messages: externalMessages, onMessagesChange, sessionId, tutoringLanguage, pendingMessage, onPendingMessageHandled }: HeliosChatProps) {
  const { t } = useI18n();

  // Get localized welcome message based on tutoring language
  const getWelcomeContent = () => {
    return tutoringLanguage && CHAT_WELCOME_MESSAGES[tutoringLanguage]
      ? CHAT_WELCOME_MESSAGES[tutoringLanguage]
      : CHAT_WELCOME_MESSAGES.en;
  };

  // Use external state if provided, otherwise use internal state
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const messages = externalMessages ?? internalMessages;

  // Initialize or update welcome message when tutoringLanguage changes
  useEffect(() => {
    const welcomeMsg = {
      id: "welcome",
      role: "assistant" as const,
      content: getWelcomeContent(),
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
  }, [tutoringLanguage]);

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {messages.map((message) => {
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
                          : "[&_a]:no-underline [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:px-3 [&_a]:py-1.5 [&_a]:my-1 [&_a]:rounded-lg [&_a]:bg-neutral-900 [&_a]:text-white [&_a]:border [&_a]:border-neutral-700 hover:[&_a]:bg-neutral-800 hover:[&_a]:border-neutral-600 [&_a]:text-sm [&_a]:font-medium"
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                      >
                        {processLatexContent(message.content)}
                      </ReactMarkdown>
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

      <form onSubmit={handleSubmit} className="px-4 py-4 bg-[#0a0a0a]">
        <div className="flex gap-2 items-stretch">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('heliosChat.placeholder')}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 border border-cyan-500/50 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 rounded-xl transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
