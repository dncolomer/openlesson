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
import { useTypewriter } from "@/lib/useTypewriter";
import { ListenButton } from "./ListenButton";

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

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
}

interface ChatPanelProps {
  planId: string;
  model?: string;
  onModelChange?: (model: string) => void;
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: PlanNode[]) => void;
  supabase?: ReturnType<typeof createBrowserClient>;
  isOwner?: boolean;
  currentUserId?: string | null;
}

// Compact onboarding card instead of a wall of markdown
function OnboardingCard({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const { t } = useI18n();
  const introText = "Plan Builder\n\nTell me how you want this learning plan to change. I can add sessions, remove sections, reorder chapters, or adjust the focus and difficulty.";
  const { displayed, skip, isDone } = useTypewriter(introText, {
    instant: false,
    speedMs: 35,
    enabled: true,
  });
  const hints = [
    { icon: "M12 4v16m8-8H4", label: t('learningPlanChat.addSessions'), example: t('chatPanel.exampleAdd') },
    { icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", label: t('chatPanel.removeSessions'), example: t('chatPanel.exampleRemove') },
    { icon: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4", label: t('chatPanel.reorder'), example: t('chatPanel.exampleReorder') },
    { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", label: t('chatPanel.modify'), example: t('chatPanel.exampleModify') },
  ];

  return (
    <>
      <div className="relative mb-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/15 via-neutral-800 to-neutral-900 border border-violet-500/30 flex items-center justify-center overflow-hidden ring-2 ring-violet-500/20 ring-offset-2 ring-offset-[#0a0a0a]">
          <span className="text-3xl font-serif text-neutral-200">H</span>
        </div>
        <div className="absolute inset-0 rounded-full pointer-events-none shadow-[0_0_40px_rgba(139,92,246,0.15)]" />
      </div>
      <button type="button" onClick={() => { if (!isDone) skip(); }} className="relative max-w-md cursor-text text-center focus:outline-none mb-3">
        <p className="whitespace-pre-line text-base leading-relaxed text-neutral-200">
          {displayed}
          {!isDone && (
            <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-violet-400/80 animate-pulse" aria-hidden="true" />
          )}
        </p>
      </button>
      <ListenButton text={introText} cacheKey="plan-builder-intro" size="md" className="mb-4" />

      <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
        <p className="mb-2.5 text-center text-[11px] leading-tight text-neutral-500">{t('chatPanel.tellMeHow')}</p>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {hints.map((h) => (
            <button
              key={h.label}
              type="button"
              onClick={() => onPrompt(h.example.replace(/^"|"$/g, ""))}
              className="text-[12px] px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white transition-colors"
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function HeliosAvatar({ small = false }: { small?: boolean }) {
  return (
    <div className="relative mb-3 flex-shrink-0">
      <div className={`${small ? "w-14 h-14 ring-1 ring-offset-1" : "w-24 h-24 ring-2 ring-offset-2"} rounded-full bg-gradient-to-br from-violet-500/15 via-neutral-800 to-neutral-900 border border-violet-500/30 flex items-center justify-center overflow-hidden ring-violet-500/20 ring-offset-[#0a0a0a]`}>
        <span className={`${small ? "text-xl" : "text-3xl"} font-serif text-neutral-200`}>H</span>
      </div>
      <div className="absolute inset-0 rounded-full pointer-events-none shadow-[0_0_40px_rgba(139,92,246,0.15)]" />
    </div>
  );
}

export function ChatPanel({ planId, model, onModelChange, onRefresh, onNodesUpdate, supabase, isOwner = true, currentUserId }: ChatPanelProps) {
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

  const currentModel = (model || "grok-4.3").replace(/^x-ai\//, "");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || (uploadedImages.length > 0 ? t('chatPanel.sentImages', { count: String(uploadedImages.length) }) : ""),
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/learning-plan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userPrompt: userMessage.content,
          conversationHistory,
          model: currentModel,
          locale,
          images: uploadedImages.map(img => ({ data: img.data, mimeType: img.mimeType })),
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
          responseContent += `\n\n**${t('chatPanel.currentPlan')}:**\n${data.currentPlan}`;
        }

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
          planModified: data.planModified || false,
        }]);
      }

      if (data.questions?.length > 0) {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: data.questions[0],
          timestamp: new Date(),
        }]);
      }

      if (data.updatedNodes?.length > 0 && onNodesUpdate) onNodesUpdate(data.updatedNodes);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: error instanceof Error ? `Sorry, I encountered an error: ${error.message}` : t('chatPanel.errorMessage'),
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
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

  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); await handleFiles(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items).filter((item) => item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean) as File[];
    if (files.length > 0) {
      const newImages = await Promise.all(files.map(processFile));
      setUploadedImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string) => { setUploadedImages((prev) => prev.filter((img) => img.id !== id)); };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
        <div className="w-full max-w-[760px] flex flex-col items-center">
          {messages.length === 0 ? (
            <OnboardingCard onPrompt={(prompt) => setInput(prompt)} />
          ) : (
            <>
              <HeliosAvatar small />
              <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3 mb-3 max-h-[520px] overflow-y-auto">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      {msg.role === "assistant" ? (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 via-neutral-800 to-neutral-900 border border-violet-500/30 flex items-center justify-center">
                          <span className="text-[10px] font-serif text-neutral-300">H</span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div className={`relative group flex-1 min-w-0 px-3 py-2 rounded-xl ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-neutral-800/70 border border-neutral-700/50 text-neutral-200 rounded-bl-sm"}`}>
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex gap-1.5 mb-1.5 flex-wrap">
                            {msg.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="w-14 h-14 object-cover rounded-lg border border-neutral-600" />
                            ))}
                          </div>
                        )}
                        <div className="prose prose-invert prose-sm max-w-none text-sm leading-7 prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-sm prose-headings:font-semibold prose-ul:my-3 prose-ul:pl-4 prose-ol:my-3 prose-ol:pl-4 prose-li:my-1 prose-li:leading-6 prose-code:text-cyan-300 prose-code:bg-neutral-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-strong:text-neutral-100 prose-a:text-cyan-400">
                          {msg.content && (
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}>
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-2.5">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 via-neutral-800 to-neutral-900 border border-violet-500/30 flex items-center justify-center">
                        <span className="text-[10px] font-serif text-neutral-300">H</span>
                      </div>
                      <div className="bg-neutral-800/70 border border-neutral-700/50 px-3 py-2 rounded-xl rounded-bl-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </>
          )}

      {!currentUserId ? (
        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
          <p className="text-xs text-neutral-500 text-center mb-2">{t('chatPanel.signUpToCustomize')}</p>
          <a href="/register" className="block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors text-center">
            {t('chatPanel.signUpCta')}
          </a>
        </div>
      ) : !isOwner ? (
        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
          <p className="text-xs text-neutral-500 text-center mb-2">{t('chatPanel.forkToCustomize')}</p>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("openRemixModal")); }}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {t('planView.forkRemix')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
          {uploadedImages.length > 0 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {uploadedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img src={img.preview} alt="" className="w-12 h-12 object-cover rounded-lg border border-neutral-700" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            className={`flex items-end gap-2 bg-neutral-900/60 border border-neutral-800 rounded-xl px-3 py-2 ${isDragging ? "ring-2 ring-violet-500" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-neutral-500 hover:text-white rounded-lg transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t('chatPanel.placeholder')}
              className="flex-1 bg-transparent text-white placeholder-neutral-600 text-sm resize-none focus:outline-none py-1 min-h-[28px] max-h-[80px]"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
              className="p-1.5 text-violet-400 hover:text-violet-300 disabled:text-neutral-700 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      )}
        </div>
      </div>
    </div>
  );
}
