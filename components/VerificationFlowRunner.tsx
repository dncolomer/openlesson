"use client";

import { useMemo, useState } from "react";
import { TapScoreClient } from "@/components/TapScoreClient";
import type { TapStartingTopic } from "@/lib/tap-score";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import {
  VERIFICATION_PRACTICE_OPENING,
  verificationQuestionStartingPrompt,
} from "@/lib/verification-flow";

type Phase = "identity" | "pick" | "empty";

export function VerificationFlowRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("identity");
  const [identity, setIdentity] = useState("");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [question, setQuestion] = useState<TapStartingTopic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const presetTopics = useMemo(() => (question ? [question] : []), [question]);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/verification-flow/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(
          payload?.error?.message === "duplicate"
            ? "That identity is already used for this verification flow."
            : payload?.error?.message || "Could not start",
        );
        return;
      }
      setClaimedIdentity(String(payload.identity || identity.trim()));
      const picked = payload.question;
      if (payload.emptyPool || !picked) {
        setPhase("empty");
        return;
      }
      const opening = verificationQuestionStartingPrompt({
        text: String(picked.openingQuestion || picked.title || ""),
      });
      setQuestion({
        id: String(picked.id),
        title: String(picked.title || opening),
        subtitle: "Starting prompt",
        openingQuestion: opening,
      });
      setTopic(String(payload.topic || ""));
      setMinutes(flowCountdownMinutes(payload.durationMinutes));
      setPhase("pick");
    } finally {
      setBusy(false);
    }
  }

  async function storeProof(input: { prompt: string; practice: boolean; questionId: string | null }) {
    const response = await fetch(
      `/api/verification-flow/public/${encodeURIComponent(token)}/results`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: claimedIdentity,
          source: "runner",
          prompt: input.prompt,
          questionId: input.practice ? null : input.questionId || question?.id || null,
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || "Could not store proof of work");
    }
  }

  if (phase === "pick" && question) {
    return (
      <div className="h-screen min-h-0" data-verification-public-entry data-verification-tap-session>
        <TapScoreClient
          presetStartingTopics={presetTopics}
          localOpening
          sidebarMode="verification-tap"
          localPracticePrompt={VERIFICATION_PRACTICE_OPENING}
          onLocalProof={storeProof}
          initialSession={{ workspaceTitle: topic || "Verification flow", post_session: "show_results" }}
          lockDuration
          initialMinutes={minutes}
          showEndSession
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white" data-verification-public-entry>
      {phase === "identity" ? (
        <form
          onSubmit={(event) => void claim(event)}
          className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6"
          data-verification-identity
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            Verification flow
          </p>
          <h1 className="font-serif text-2xl">Identify yourself</h1>
          <p className="text-sm text-neutral-400">
            Enter a unique string for this flow. A duplicate does not start.
          </p>
          <input
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            data-verification-identity-input
            className="border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            placeholder="Unique identity"
            autoComplete="off"
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Continue
          </button>
        </form>
      ) : null}

      {phase === "empty" ? (
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6" data-verification-empty-pool>
          <h1 className="font-serif text-2xl">No starting question</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This verification flow has an empty question pool, so it does not offer generated topics.
          </p>
        </section>
      ) : null}

    </main>
  );
}
