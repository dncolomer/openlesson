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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface LLMChatProps {
  problem: string;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  sessionId?: string;
  tutoringLanguage?: string;
  /** When set to a non-null string, auto-submits it as a user message and clears via the callback */
  pendingMessage?: string | null;
  onPendingMessageHandled?: () => void;
}

const CHAT_WELCOME_MESSAGES: Record<string, string> = {
  en: "Hi! I'm here to help you with your learning. Feel free to ask me questions about the topic, get clarifications, or discuss concepts in a different way.\n\nRemember - I'm a separate assistant from the tutor. Let me know how I can help!",
  es: "¡Hola! Estoy aquí para ayudarte con tu aprendizaje. Siéntete libre de preguntarme sobre el tema, pedir aclaraciones o discutir conceptos de otra manera.\n\nRecuerda - soy un asistente separado del tutor. ¡Dime cómo puedo ayudarte!",
  vi: "Chào! Tôi ở đây để giúp bạn học tập. Hãy thoải mái hỏi tôi về chủ đề, yêu cầu giải thích hoặc thảo luận theo cách khác.\n\nNhớ nhé - tôi là một trợ lý riêng biệt với gia sư. Hãy cho tôi biết tôi có thể giúp gì!",
  zh: "你好！我在这里帮助你学习。你可以随意问我关于这个主题的问题，获取解释，或者用不同的方式讨论概念。\n\n请记住 - 我是一个独立于导师的助手。让我知道你需要什么帮助！",
  de: "Hallo! Ich bin hier, um dir beim Lernen zu helfen. Frag mich ruhig zum Thema, bitte um Erklärungen oder diskutiere Konzepte auf andere Weise.\n\nDenk daran - ich bin ein separater Assistent vom Tutor. Sag mir, wie ich helfen kann!",
  pl: "Cześć! Jestem tu, żeby pomóc Ci w nauce. Śmiało pytaj o temat, proś o wyjaśnienia lub omawiaj koncepcje w inny sposób.\n\nPamiętaj - jestem osobnym asystentem od korepetytora. Daj znać, jak mogę pomóc!",
  ca: "Hola! Soc aquí per ajudar-te amb el teu aprenentatge. No dubtis a preguntar-me sobre el tema, demanar aclariments o discutir conceptes d'una altra manera.\n\nRecorda - soc un assistent separat del tutor. Digues-me com puc ajudar!",
};

export function LLMChat({ problem, messages: externalMessages, onMessagesChange, sessionId, tutoringLanguage, pendingMessage, onPendingMessageHandled }: LLMChatProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Core send logic shared by form submit and programmatic pendingMessage
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };

    updateMessages([...messages, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          messages: [...conversationHistory, { role: "user", content: userMsg.content }],
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
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t('llmChat.errorMessage'),
      };
      updateMessages([...messages, userMsg, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  // Auto-submit pendingMessage from parent (e.g. "Ask Assistant" button on plan steps)
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
        <h3 className="text-sm font-medium text-white">{t('llmChat.assistant')}</h3>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
          title={t('llmChat.clearChat')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
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
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 rounded-2xl px-4 py-2.5">
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
        title={t('llmChat.clearChat')}
        description={t('llmChat.clearConfirm')}
        confirmLabel={t('llmChat.clearChat')}
        cancelLabel={t('common.cancel')}
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 bg-[#0a0a0a]">
        <div className="flex gap-2 items-stretch">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('llmChat.placeholder')}
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