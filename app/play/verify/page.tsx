"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { isDashboardPlaySession } from "@/lib/dashboard-play";
import { getSession } from "@/lib/storage";
import { verificationQuestionStartingPrompt } from "@/lib/verification-flow";
import type { TapStartingTopic } from "@/lib/tap-score";

function PlayVerifyContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id") || "";
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session");
      return;
    }
    let cancelled = false;
    void getSession(sessionId).then((session) => {
      if (cancelled) return;
      if (!session || !isDashboardPlaySession(session.metadata)) {
        setError("This play session is not available.");
        return;
      }
      setPrompt(String(session.problem || "").trim() || "This topic");
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const topics = useMemo<TapStartingTopic[]>(() => {
    if (!prompt) return [];
    const opening = verificationQuestionStartingPrompt({ text: prompt });
    return [
      {
        id: "play",
        title: prompt,
        subtitle: "Play session",
        openingQuestion: opening,
      },
    ];
  }, [prompt]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-neutral-400">
        {error}
      </div>
    );
  }
  if (!prompt || !sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <LoadingStatusMessage message="Loading" />
      </div>
    );
  }

  return (
    <div className="h-screen min-h-0" data-dashboard-play-session="verify">
      <TapScoreClient
        sessionId={sessionId}
        presetStartingTopics={topics}
        localOpening
        sidebarMode="verification-tap"
        initialMinutes={15}
        lockDuration
        initialSession={{ workspaceTitle: prompt, post_session: "show_results" }}
        showEndSession
        onLocalProof={async () => undefined}
      />
    </div>
  );
}

export default function PlayVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <LoadingStatusMessage message="Loading" />
        </div>
      }
    >
      <PlayVerifyContent />
    </Suspense>
  );
}
