"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAestheticPackages, type AestheticPackage } from "@/lib/aesthetics";
import { isSmartphoneClient } from "@/lib/is-smartphone";
import { createClient } from "@/lib/supabase/client";
import { useSessionPaneLayout } from "@/lib/useSessionPaneLayout";
import type { Tool } from "@/components/ToolsPanel";
import type { HelpPreviousLayout } from "@/components/session-view/types";

export function useSessionChrome(input: {
  sessionId: string | undefined;
  showWelcomeModal: boolean;
  isRecording: boolean;
  isPaused: boolean;
  onHelpPauseRef: { current: () => Promise<void> };
}) {
  const { sessionId, showWelcomeModal, isRecording, isPaused, onHelpPauseRef } = input;

  const {
    activeTool,
    setActiveTool,
    prevToolRef,
    paneVisibility,
    setPaneVisibility,
    applyPaneVisibility,
    ensureVisible,
    applyIleChapterGridStartup,
  } = useSessionPaneLayout();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(isSmartphoneClient());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [userInitial, setUserInitial] = useState("Y");
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string | null; user_metadata?: Record<string, unknown> } | null } }) => {
      const user = data.user;
      if (!user) return;
      const name =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        user.email?.split("@")[0] ||
        "";
      const initial = name.charAt(0).toUpperCase();
      if (initial) setUserInitial(initial);
    });
  }, []);

  const [showTutorialBanner, setShowTutorialBanner] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("tutorial-banner-dismissed") !== "true";
  });

  const [showWelcomePanel, setShowWelcomePanel] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [welcomeOpenNonce, setWelcomeOpenNonce] = useState(0);
  const helpPreviousLayoutRef = useRef<HelpPreviousLayout | null>(null);

  const [aestheticPackages, setAestheticPackages] = useState<AestheticPackage[]>([]);
  const [aestheticsLoading, setAestheticsLoading] = useState(true);
  const [selectedAestheticId, setSelectedAestheticId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAestheticsLoading(true);
    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        setAestheticPackages(packages);
        setSelectedAestheticId((current) => current ?? packages[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setAestheticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId || showWelcomeModal) return;
    const id = window.setTimeout(() => {
      applyIleChapterGridStartup();
    }, 100);
    return () => window.clearTimeout(id);
  }, [sessionId, showWelcomeModal, applyIleChapterGridStartup]);

  const shouldBlockTools = Boolean(
    sessionId &&
      !showWelcomeModal &&
      !showWelcomePanel &&
      (!isRecording || isPaused),
  );

  const handleToolChange = useCallback(
    (tool: Tool) => {
      if (tool === "help") {
        if (!helpPreviousLayoutRef.current) {
          const readLayout = (key: string) => {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) return { collapsedSide: null as null | "left" | "right" };
              const parsed = JSON.parse(raw);
              return {
                leftWidth: typeof parsed.leftWidth === "number" ? parsed.leftWidth : undefined,
                collapsedSide: parsed.collapsedSide === "left" || parsed.collapsedSide === "right"
                  ? parsed.collapsedSide
                  : null,
              };
            } catch {
              return { collapsedSide: null as null | "left" | "right" };
            }
          };
          const layout = readLayout("session-overlay-tools-helios");
          helpPreviousLayoutRef.current = {
            outer: layout,
            inner: layout,
          };
        }
        if (isRecording && !isPaused) {
          onHelpPauseRef.current().catch((err) =>
            console.error("[SessionView] Help pause failed:", err),
          );
        }
        applyIleChapterGridStartup();
        setShowWelcomePanel(true);
        setWelcomeOpenNonce((n) => n + 1);
        return;
      }
      setActiveTool(tool);
    },
    [applyIleChapterGridStartup, isPaused, isRecording, onHelpPauseRef, setActiveTool],
  );

  const selectedAesthetic =
    aestheticPackages.find((pkg) => pkg.id === selectedAestheticId) ?? aestheticPackages[0];

  return {
    isMobile,
    userInitial,
    showTutorialBanner,
    setShowTutorialBanner,
    showWelcomePanel,
    setShowWelcomePanel,
    isStartingSession,
    setIsStartingSession,
    welcomeOpenNonce,
    setWelcomeOpenNonce,
    helpPreviousLayoutRef,
    aestheticPackages,
    aestheticsLoading,
    selectedAestheticId,
    setSelectedAestheticId,
    selectedAesthetic,
    activeTool,
    setActiveTool,
    prevToolRef,
    paneVisibility,
    setPaneVisibility,
    applyPaneVisibility,
    ensureVisible,
    applyIleChapterGridStartup,
    shouldBlockTools,
    handleToolChange,
  };
}
