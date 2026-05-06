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
function OnboardingCard() {
  const { t } = useI18n();
  const hints = [
    { icon: "M12 4v16m8-8H4", label: t('learningPlanChat.addSessions'), example: t('chatPanel.exampleAdd') },
    { icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", label: t('chatPanel.removeSessions'), example: t('chatPanel.exampleRemove') },
    { icon: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4", label: t('chatPanel.reorder'), example: t('chatPanel.exampleReorder') },
    { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", label: t('chatPanel.modify'), example: t('chatPanel.exampleModify') },
  ];

  return (
    <div className="rounded-xl border border-neutral-800/60 bg-neutral-800/30 p-3.5 mb-3">
      <p className="text-xs font-medium text-neutral-400 mb-2.5">{t('chatPanel.tellMeHow')}</p>
      <div className="grid grid-cols-2 gap-2">
        {hints.map((h) => (
          <div key={h.label} className="flex items-start gap-2 p-2 rounded-lg bg-neutral-900/40">
            <svg className="w-3.5 h-3.5 text-blue-400/70 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={h.icon} />
            </svg>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-neutral-300">{h.label}</p>
              <p className="text-[10px] text-neutral-600 truncate">{h.example}</p>
            </div>
          </div>
        ))}
      </div>
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

  const currentModel = model || "x-ai/grok-4.3";

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

      if (!response.ok) throw new Error("Failed to get response");

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
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t('chatPanel.errorMessage'),
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
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1">
        {/* Show onboarding card if no user messages yet */}
        {messages.length === 0 && <OnboardingCard />}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] px-3.5 py-2 rounded-2xl ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-neutral-800/80 text-neutral-200 rounded-bl-md"
            }`}>
              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-1.5 mb-1.5 flex-wrap">
                  {msg.images.map((img) => (
                    <img key={img.id} src={img.preview} alt="" className="w-14 h-14 object-cover rounded-lg border border-neutral-600" />
                  ))}
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed
                prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-sm
                prose-ul:my-1.5 prose-ul:pl-4 prose-ol:my-1.5 prose-ol:pl-4
                prose-li:my-0.5 prose-code:text-cyan-300 prose-code:bg-neutral-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-strong:text-neutral-100 prose-a:text-cyan-400">
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
          <div className="flex justify-start">
            <div className="bg-neutral-800/80 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!currentUserId ? (
        <div className="pt-3 border-t border-neutral-800/50">
          <p className="text-xs text-neutral-500 text-center mb-2">{t('chatPanel.signUpToCustomize')}</p>
          <a href="/register" className="block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors text-center">
            {t('chatPanel.signUpCta')}
          </a>
        </div>
      ) : !isOwner ? (
        <div className="pt-3 border-t border-neutral-800/50">
          <p className="text-xs text-neutral-500 text-center mb-2">{t('chatPanel.forkToCustomize')}</p>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("openRemixModal")); }}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {t('planView.forkRemix')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-shrink-0">
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
            className={`flex items-end gap-1.5 bg-neutral-800/60 border border-neutral-700/50 rounded-xl px-2 py-1.5 ${isDragging ? "ring-2 ring-blue-500" : ""}`}
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
              className="flex-1 bg-transparent text-white placeholder-neutral-500 text-sm resize-none focus:outline-none py-1.5 min-h-[28px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
              className="p-1.5 text-blue-400 hover:text-blue-300 disabled:text-neutral-600 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
