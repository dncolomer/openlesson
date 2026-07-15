"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_MODEL } from "@/lib/xai-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  planModified?: boolean;
  images?: UploadedImage[];
}

interface UploadedImage {
  id: string;
  data: string;
  mimeType: string;
  preview: string;
}

interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  planning_prompt?: string;
}

interface ChatPanelProps {
  workspaceId: string;
  model?: string;
  onModelChange?: (model: string) => void;
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: Block[]) => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  isOwner?: boolean;
  currentUserId?: string | null;
  embedded?: boolean;
  ayclToken?: string;
}

export function ChatPanel({
  workspaceId,
  model,
  onModelChange,
  onRefresh,
  onNodesUpdate,
  supabase,
  isOwner = true,
  currentUserId,
  embedded = false,
  ayclToken,
}: ChatPanelProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = (model || DEFAULT_MODEL).replace(/^x-ai\//, "");

  const hints = [
    { label: t("workspaceChat.addSessions"), example: t("chatPanel.exampleAdd") },
    { label: t("chatPanel.removeSessions"), example: t("chatPanel.exampleRemove") },
    { label: t("chatPanel.reorder"), example: t("chatPanel.exampleReorder") },
    { label: t("chatPanel.modify"), example: t("chatPanel.exampleModify") },
  ];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content:
        input.trim() ||
        (uploadedImages.length > 0 ? t("chatPanel.sentImages", { count: String(uploadedImages.length) }) : ""),
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/workspace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userPrompt: userMessage.content,
          conversationHistory,
          model: currentModel,
          locale,
          images: uploadedImages.map((img) => ({ data: img.data, mimeType: img.mimeType })),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      if (data.explanation) {
        let responseContent = data.explanation;
        if (data.currentPlan) {
          responseContent += `\n\n**${t("chatPanel.currentPlan")}:**\n${data.currentPlan}`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: responseContent,
            timestamp: new Date(),
            planModified: data.planModified || false,
          },
        ]);
      }

      if (data.questions?.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 3).toString(),
            role: "assistant",
            content: data.questions[0],
            timestamp: new Date(),
          },
        ]);
      }

      if (data.updatedNodes?.length > 0 && onNodesUpdate) onNodesUpdate(data.updatedNodes);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Sorry, I encountered an error: ${error.message}`
              : t("chatPanel.errorMessage"),
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
      void handleSubmit(e);
    }
  };

  const processFile = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          data: result.split(",")[1],
          mimeType: file.type || "image/png",
          preview: result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newImages = await Promise.all(imageFiles.map(processFile));
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[];
    if (files.length > 0) {
      const newImages = await Promise.all(files.map(processFile));
      setUploadedImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const applyHint = (example: string) => {
    setInput(example.replace(/^"|"$/g, ""));
    inputRef.current?.focus();
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${
        embedded ? "bg-black/20" : "rounded-md border border-neutral-800 bg-neutral-950/50"
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.length === 0 && (
          <div className="mb-4 max-w-xl">
            <p className="text-sm font-medium text-neutral-200">{t("chatPanel.welcomeTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t("chatPanel.welcomeDescription")}</p>
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-md px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-white text-black"
                    : "border border-neutral-800 bg-neutral-900/80 text-neutral-200"
                }`}
              >
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {msg.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.preview}
                        alt=""
                        className="h-14 w-14 rounded-lg border border-neutral-600 object-cover"
                      />
                    ))}
                  </div>
                )}
                {msg.content && (
                  <div
                    className={`max-w-none text-sm leading-6 ${
                      msg.role === "assistant"
                        ? "prose prose-invert prose-sm prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-sm prose-headings:font-semibold prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4 prose-li:my-0.5 prose-li:leading-5 prose-code:text-neutral-200 prose-code:bg-neutral-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-strong:text-neutral-100 prose-a:text-neutral-200"
                        : "whitespace-pre-wrap"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
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
        {!currentUserId ? (
          <div className="text-center">
            <p className="mb-2 text-xs text-neutral-500">{t("chatPanel.signUpToCustomize")}</p>
            <a
              href="/pricing"
              className="inline-flex rounded-md bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
            >
              {t("chatPanel.signUpCta")}
            </a>
          </div>
        ) : !isOwner ? (
          <div className="text-center">
            <p className="mb-2 text-xs text-neutral-500">{t("chatPanel.forkToCustomize")}</p>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("openRemixModal"));
              }}
              className="inline-flex rounded-md bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
            >
              {t("planView.forkRemix")}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-[10px] uppercase tracking-[1.5px] text-neutral-600">{t("chatPanel.tellMeHow")}</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {hints.map((hint) => (
                <button
                  key={hint.label}
                  type="button"
                  onClick={() => applyHint(hint.example)}
                  disabled={isLoading}
                  className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                >
                  {hint.label}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => void handleSubmit(e)}>
              {uploadedImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="group relative">
                      <img
                        src={img.preview}
                        alt=""
                        className="h-12 w-12 rounded-lg border border-neutral-700 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className={`flex items-end gap-2 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 ${
                  isDragging ? "ring-2 ring-neutral-400" : ""
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded p-1.5 text-neutral-500 transition-colors hover:text-white"
                  aria-label="Attach image"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z"
                    />
                  </svg>
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={t("chatPanel.placeholder")}
                  className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-white placeholder-neutral-600 focus:outline-none"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                  className="shrink-0 rounded p-1.5 text-neutral-400 transition-colors hover:text-white disabled:text-neutral-700"
                  aria-label="Send"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}