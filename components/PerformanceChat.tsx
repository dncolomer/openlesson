"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PerformanceChatProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  isGroupPlan?: boolean;
  compact?: boolean;
}

const STARTER_PROMPT_KEYS = [
  "performanceChat.starter1",
  "performanceChat.starter2",
  "performanceChat.starter3",
  "performanceChat.starter4",
  "performanceChat.starter5",
  "performanceChat.starter6",
] as const;

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
export function PerformanceChat({
  workspaceId,
  isOwner,
  currentUserId,
  isGroupPlan = false,
  compact = false,
}: PerformanceChatProps) {
  const { t } = useI18n();
  const starterPrompts = STARTER_PROMPT_KEYS.map((key) => t(key));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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

      const response = await fetch("/api/workspace/performance-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
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
          content: t("performanceChat.errorMessage"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  if (!currentUserId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-md border border-neutral-800 bg-neutral-950/50 px-4 py-8 text-center">
        <p className="text-sm text-neutral-500">{t("performanceChat.signInRequired")}</p>
        <a
          href="/login"
          className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
        >
          {t("common.signIn")}
        </a>
      </div>
    );
  }

  const visiblePrompts = messages.length === 0 ? starterPrompts : starterPrompts.slice(0, 4);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/50">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.length === 0 && (
          <div className="mb-4 max-w-xl">
            <p className="text-sm font-medium text-neutral-200">{t("performanceChat.welcomeTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t("performanceChat.welcomeDescription")}</p>
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative group max-w-[92%] rounded-md px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-white text-black"
                    : "border border-neutral-800 bg-neutral-900/80 text-neutral-200"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-sm leading-6
                    prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-sm prose-headings:font-semibold
                    prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                    prose-li:my-0.5 prose-li:leading-5 prose-code:text-neutral-200 prose-code:bg-neutral-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                    prose-strong:text-neutral-100 prose-a:text-neutral-200"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                    >
                      {formatPerformanceMarkdown(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(msg.content, msg.id)}
                    className="absolute top-1 right-1 rounded p-1 text-neutral-500 opacity-0 transition-all hover:bg-neutral-800 hover:text-white group-hover:opacity-100"
                    title={t("common.copy")}
                  >
                    {copiedId === msg.id ? (
                      <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-md border border-neutral-800 bg-neutral-900/80 px-3 py-2">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-800 px-3 py-2.5 sm:px-4">
        <p className="mb-2 text-[10px] uppercase tracking-[1.5px] text-neutral-600">{t("performanceChat.exampleQuestions")}</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {visiblePrompts.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => void sendMessage(example)}
              disabled={isLoading}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="flex items-end gap-2 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("performanceChat.placeholder")}
              className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-white placeholder-neutral-600 focus:outline-none"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 rounded p-1.5 text-neutral-400 transition-colors hover:text-white disabled:text-neutral-700"
              aria-label="Send"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}