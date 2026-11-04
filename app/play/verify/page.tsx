"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { postWorkspaceFlowEmbedding } from "@/lib/flow-embedding-client";
import {
  playCopyIdRunnerAcceptsMetadata,
  playCopySessionQuestions,
  playCopyVerifyEmbeddingFromProof,
  playCopyVerifyStartingTopics,
} from "@/lib/map-play-data-access";
import { getSession } from "@/lib/storage";
import type { TapStartingTopic } from "@/lib/tap-score";

function PlayVerifyContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id") || "";
  const [prompt, setPrompt] = useState<string | null>(null);
  const [topics, setTopics] = useState<TapStartingTopic[]>([]);
  const [sessionMeta, setSessionMeta] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session");
      return;
    }
    let cancelled = false;
    void getSession(sessionId).then((session) => {
      if (cancelled) return;
      if (!session || !playCopyIdRunnerAcceptsMetadata(session.metadata)) {
        setError("This play session is not available.");
        return;
      }
      const nextPrompt = String(session.problem || "").trim() || "This topic";
      setPrompt(nextPrompt);
      setSessionMeta(session.metadata);
      setTopics(
        playCopyVerifyStartingTopics({
          prompt: nextPrompt,
          questions: playCopySessionQuestions(session.metadata),
        }) as TapStartingTopic[],
      );
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const storeProof = useCallback(
    async (input: {
      prompt: string;
      practice: boolean;
      questionId: string | null;
      policy?: { model?: unknown; sequence?: unknown } | null;
    }) => {
      const payload = playCopyVerifyEmbeddingFromProof({
        session: { id: sessionId, metadata: sessionMeta },
        prompt: input.prompt,
        policy: input.policy,
      });
      if (!payload) return;
      const posted = await postWorkspaceFlowEmbedding(payload);
      if (!posted.ok) throw new Error("Could not store proof of work");
    },
    [sessionId, sessionMeta],
  );

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
        onLocalProof={storeProof}
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
