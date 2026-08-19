"use client";

import { useCallback } from "react";
import { pauseSession } from "@/lib/storage";
import type { PendingChatMessage, StuckAction, ChatMessage } from "@/lib/session-chat-client";
import { translateWithLocale } from "@/lib/i18n";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import type { Session } from "@/lib/storage";
import type { SessionPlan } from "@/lib/storage";
import type { Tool } from "@/components/ToolsPanel";

export type SessionHeliosPrepInput = {
  session: Session | null;
  sessionRef: { current: Session | null };
  sessionPlanRef: { current: SessionPlan | null };
  activeChapterKey: string;
  activeChapterIndexRef: { current: number };
  ensureVisible: (view: "tools" | "tutor" | "plan") => void;
  setActiveTool: (tool: Tool) => void;
  updateChapterWorkspace: (
    key: string,
    update:
      | Record<string, unknown>
      | ((workspace: { chatMessages: ChatMessage[] }) => Record<string, unknown>),
  ) => void;
  setChatMessages: (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  tutoringLanguage: SpokenLocale;
  isPaused: boolean;
  isRecording: boolean;
  setIsPaused: (v: boolean) => void;
};

export function useSessionHeliosPrep(input: SessionHeliosPrepInput) {
  const {
    session,
    sessionRef,
    sessionPlanRef,
    activeChapterKey,
    activeChapterIndexRef,
    ensureVisible,
    setActiveTool,
    updateChapterWorkspace,
    setChatMessages,
    tutoringLanguage,
    isPaused,
    isRecording,
    setIsPaused,
  } = input;

const fetchAndInjectPrepIntoChat = async (
  type: "reading" | "exercise",
  stepDescription: string,
  userStub: string,
  fallbackTitle: string,
) => {
  if (!session?.problem) return;
  const targetChapterKey = activeChapterKey;
  ensureVisible("tools");
  setActiveTool("notebook");

  const userMsg: ChatMessage = {
    id: `${Date.now()}-u`,
    role: "user",
    content: userStub,
  };
  const placeholderId = `${Date.now()}-a`;
  const placeholder: ChatMessage = {
    id: placeholderId,
    role: "assistant",
    content: "",
    pending: true,
  };

  updateChapterWorkspace(targetChapterKey, workspace => ({
    chatMessages: [...workspace.chatMessages, userMsg, placeholder],
  }));

  try {
    const url =
      `/api/prep-material?topic=${encodeURIComponent(session.problem)}` +
      `&type=${type}` +
      `&step=${encodeURIComponent(stepDescription)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`prep-material ${response.status}`);
    const data = (await response.json()) as { title?: string; content?: string };

    const title = (data.title ?? fallbackTitle).trim();
    const body = (data.content ?? "").trim();
    const content = body ? `${title}\n\n${body}` : title;

    updateChapterWorkspace(targetChapterKey, workspace => ({
      chatMessages: workspace.chatMessages.map(m =>
        m.id === placeholderId
          ? { ...m, content, pending: false }
          : m,
      ),
    }));
  } catch (err) {
    console.error("Prep material → chat error:", err);
    updateChapterWorkspace(targetChapterKey, workspace => ({
      chatMessages: workspace.chatMessages.map(m =>
        m.id === placeholderId
          ? {
              ...m,
              content:
                type === "exercise"
                  ? "I couldn't pull together a practice set just now. Try again in a moment, or tell me what specifically you'd like to practice."
                  : "I couldn't pull the theory for this step right now. Try again, or ask me a specific question and I'll explain.",
              pending: false,
            }
          : m,
      ),
    }));
  }
};

const handleStepResources = (stepDescription: string) => {
  void fetchAndInjectPrepIntoChat(
    "reading",
    stepDescription,
    `Give me the theory for this step: "${stepDescription}"`,
    "Theory",
  );
};

const handleStepPractice = (stepDescription: string) => {
  void fetchAndInjectPrepIntoChat(
    "exercise",
    stepDescription,
    `Give me practice tasks for this step: "${stepDescription}"`,
    "Practice",
  );
};

const openHeliosChatWithMessage = useCallback((message: string | PendingChatMessage) => {
  const targetChapterKey = activeChapterKey;
  updateChapterWorkspace(targetChapterKey, { pendingChatMessage: message });
}, [activeChapterKey, updateChapterWorkspace]);


const addProbeToHeliosChat = useCallback((text: string) => {
  const content = text.trim();
  if (!content) return;
  const prefix = translateWithLocale(tutoringLanguage, "heliosChat.probeLeadIn");
  const conversationalContent = `${prefix}\n\n${content}`;
  setChatMessages(prev => [
    ...prev,
    {
      id: `probe_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      content: conversationalContent,
    },
  ]);
}, []);

const handleStepAskHelios = (stepDescription: string) => {
  // Make sure the tools pane is visible. The `activeTool` effect only
  // reopens the pane when the value actually changes, so if "chat" was
  // already the active tool before the user closed the tools pane,
  // calling setActiveTool("chat") here is a no-op and wouldn't reopen it.
  openHeliosChatWithMessage(`Help me understand and work through this step: "${stepDescription}"`);
};

const handleStuckAction = useCallback((action: StuckAction) => {
  const currentStep =
    sessionPlanRef.current?.steps?.[activeChapterIndexRef.current]?.description
    || sessionRef.current?.problem
    || "this step";

  if (action === "theory") {
    handleStepResources(currentStep);
    return;
  }

  if (action === "practice") {
    handleStepPractice(currentStep);
    return;
  }

  if (action === "canvas") {
    ensureVisible("tools");
    setActiveTool("canvas");
    return;
  }

  if (action === "notebook") {
    ensureVisible("tools");
    setActiveTool("notebook");
    return;
  }

  if (action === "break") {
    if (isRecording && !isPaused) {
      setIsPaused(true);
      const currentSession = sessionRef.current;
      if (currentSession) {
        pauseSession(currentSession.id).catch(err => console.error("Failed to pause for stuck break:", err));
      }
    }
    setChatMessages(prev => [...prev, {
      id: `stuck_break_${Date.now()}`,
      role: "assistant",
      content: "Take two minutes away from the problem. When you come back, write the single smallest thing you know for sure, then we will restart from there.",
    }]);
    return;
  }

  openHeliosChatWithMessage(`I'm stuck on this step: "${currentStep}". Help me identify the next small move without giving away the answer.`);
}, [ensureVisible, handleStepPractice, handleStepResources, isPaused, isRecording, openHeliosChatWithMessage]);

  return {
    fetchAndInjectPrepIntoChat,
    handleStepResources,
    handleStepPractice,
    openHeliosChatWithMessage,
    addProbeToHeliosChat,
    handleStepAskHelios,
    handleStuckAction,
  };
}
