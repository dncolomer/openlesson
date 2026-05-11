"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { ListenButton } from "./ListenButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PerformanceChatProps {
  planId: string;
  isOwner: boolean;
  currentUserId: string | null;
  isGroupPlan?: boolean;
}

const starterPrompts = [
  "Give me a leaderboard so far",
  "Who is improving the fastest?",
  "Which nodes are people struggling with?",
  "What should the group practice next?",
  "Compare completed vs active sessions",
  "Summarize the main performance gaps",
];

function formatPerformanceMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const formatted: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      formatted.push(line);
      continue;
    }

    if (inCodeFence || !trimmed) {
      formatted.push(line);
      continue;
    }

    const previous = formatted[formatted.length - 1];
    const previousTrimmed = previous?.trim();
    const isListLine = /^([-*+] |\d+\.\s)/.test(trimmed);
    const previousIsListLine = previousTrimmed ? /^([-*+] |\d+\.\s)/.test(previousTrimmed) : false;

    if (previousTrimmed && !isListLine && !previousIsListLine) {
      formatted.push("");
    }

    formatted.push(line);
  }

  return formatted.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PerformanceChat({ planId, isOwner, currentUserId, isGroupPlan = false }: PerformanceChatProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [typingDone, setTypingDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build the welcome intro text
  const introText = `${t('performanceChat.welcomeTitle')}\n\n${t('performanceChat.welcomeDescription')}`;
  
  // Typewriter animation for intro
  const { displayed: displayedIntro, skip: skipIntro } = useTypewriter(introText, {
    instant: false,
    speedMs: 40,
    onDone: () => setTypingDone(true),
    enabled: messages.length === 0 && !!currentUserId,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input.trim());
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Skip typing animation if not done
    if (!typingDone) skipIntro();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/learning-plan/performance-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          message: userMessage.content,
          conversationHistory,
          fileIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      // Store fileIds for future messages
      if (data.fileIds?.length > 0) {
        setFileIds(data.fileIds);
      }

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("[PerformanceChat] Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: t('performanceChat.errorMessage'),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Check if user has access
  if (!currentUserId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-black/35 border border-white/5 rounded-md backdrop-blur-[1px]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center">
            <span className="text-2xl font-serif text-neutral-400">H</span>
          </div>
          <p className="text-neutral-500 mb-4">{t('performanceChat.signInRequired')}</p>
          <a
            href="/login"
            className="inline-flex px-5 py-2.5 bg-white hover:bg-neutral-200 text-black text-sm font-medium rounded-md transition-colors"
          >
            {t('common.signIn')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-black/35 border border-white/5 rounded-md overflow-hidden backdrop-blur-[1px]">
      {/* Main content - vertically centered container */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
        <div className="w-full max-w-[760px] flex flex-col items-center">
          {messages.length === 0 ? (
            /* Welcome state - avatar + typing intro + input card */
            <>
              {/* Helios-style avatar */}
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900 border border-neutral-600/40 flex items-center justify-center overflow-hidden ring-2 ring-neutral-600/25 ring-offset-2 ring-offset-[#0a0a0a]">
                  <span className="text-3xl font-serif text-neutral-200">H</span>
                </div>
                {/* Soft glow */}
                <div className="absolute inset-0 rounded-full pointer-events-none shadow-[0_0_40px_rgba(255,255,255,0.08)]" />
              </div>

              {/* Typed intro text - click to skip */}
              <button
                type="button"
                onClick={() => { if (!typingDone) skipIntro(); }}
                className="relative max-w-md cursor-text text-center focus:outline-none mb-3"
              >
                <p className="text-base leading-relaxed text-neutral-200 whitespace-pre-line">
                  {displayedIntro}
                  {!typingDone && (
                    <span
                      className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-neutral-300/80 animate-pulse"
                      aria-hidden="true"
                    />
                  )}
                </p>
              </button>

              {/* Listen button */}
              <ListenButton
                text={introText}
                cacheKey={`performance-plan:${planId}`}
                size="md"
                className="mb-4"
              />

              {/* Chat input card - styled like Helios action container */}
              <div className="w-full rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
                <p className="mb-2.5 text-center text-[11px] leading-tight text-neutral-500">
                  {t('performanceChat.exampleQuestions')}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {starterPrompts.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => void sendMessage(example)}
                      className="text-[12px] px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                
                {/* Input */}
                <form onSubmit={handleSubmit}>
                  <div className="flex items-end gap-2 bg-neutral-900/60 border border-neutral-800 rounded-md px-3 py-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('performanceChat.placeholder')}
                      className="flex-1 bg-transparent text-white placeholder-neutral-600 text-sm resize-none focus:outline-none py-1 min-h-[28px] max-h-[80px]"
                      rows={1}
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="p-1.5 text-neutral-300 hover:text-white disabled:text-neutral-700 rounded-md transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Conversation view */
            <>
              {/* Small avatar at top */}
              <div className="relative mb-3 flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900 border border-neutral-600/40 flex items-center justify-center ring-1 ring-neutral-600/25 ring-offset-1 ring-offset-[#0a0a0a]">
                  <span className="text-xl font-serif text-neutral-200">H</span>
                </div>
              </div>

              {/* Messages container - card style */}
              <div className="w-full rounded-md border border-neutral-800 bg-neutral-950/40 p-3 mb-3 max-h-[520px] overflow-y-auto">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      {/* Mini avatar */}
                      {msg.role === "assistant" ? (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900 border border-neutral-600/40 flex items-center justify-center">
                          <span className="text-[10px] font-serif text-neutral-300">H</span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center">
                          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`relative group flex-1 min-w-0 px-3 py-2 rounded-md ${
                          msg.role === "user"
                            ? "bg-neutral-100 text-black rounded-br-sm"
                            : "bg-neutral-800/70 border border-neutral-700/50 text-neutral-200 rounded-bl-sm"
                        }`}
                      >
                        <div
                          className="prose prose-invert prose-sm max-w-none text-sm leading-7
                          prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-sm prose-headings:font-semibold
                          prose-ul:my-3 prose-ul:pl-4 prose-ol:my-3 prose-ol:pl-4
                          prose-li:my-1 prose-li:leading-6 prose-code:text-neutral-200 prose-code:bg-neutral-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                          prose-strong:text-neutral-100 prose-a:text-neutral-200"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                          >
                            {msg.role === "assistant" ? formatPerformanceMarkdown(msg.content) : msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Copy button for assistant messages */}
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="absolute top-1.5 right-1.5 p-1 rounded bg-neutral-700/50 text-neutral-400 hover:text-white hover:bg-neutral-600/50 opacity-0 group-hover:opacity-100 transition-all"
                            title={t('common.copy')}
                          >
                            {copiedId === msg.id ? (
                              <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-2.5">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900 border border-neutral-600/40 flex items-center justify-center">
                        <span className="text-[10px] font-serif text-neutral-300">H</span>
                      </div>
                      <div className="bg-neutral-800/70 border border-neutral-700/50 px-3 py-2 rounded-md rounded-bl-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-neutral-400/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 bg-neutral-400/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 bg-neutral-400/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input card */}
              <div className="w-full rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {starterPrompts.slice(0, 4).map((example, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => void sendMessage(example)}
                      disabled={isLoading}
                      className="text-[11px] px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="flex items-end gap-2 bg-neutral-900/60 border border-neutral-800 rounded-md px-3 py-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('performanceChat.placeholder')}
                      className="flex-1 bg-transparent text-white placeholder-neutral-600 text-sm resize-none focus:outline-none py-1 min-h-[28px] max-h-[80px]"
                      rows={1}
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="p-1.5 text-neutral-300 hover:text-white disabled:text-neutral-700 rounded-md transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
