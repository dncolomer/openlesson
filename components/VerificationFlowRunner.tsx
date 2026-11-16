"use client";

import { useState } from "react";
import { TapScoreClient } from "@/components/TapScoreClient";
import { ProductFlowIdentityForm } from "@/components/product-flow/product-flow-identity-form";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import type { TapStartingTopic } from "@/lib/tap-score";
import { verificationQuestionStartingPrompt } from "@/lib/verification-flow";

type Phase = "identity" | "pick" | "empty";

export function VerificationFlowRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("identity");
  const [identity, setIdentity] = useState("");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [topic, setTopic] = useState("");
  const [presetTopics, setPresetTopics] = useState<TapStartingTopic[]>([]);
  const [exactProblemOnCanvas, setExactProblemOnCanvas] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      const rawTopics = Array.isArray(payload.topics) ? payload.topics : [];
      const fallback = payload.question ? [payload.question] : [];
      const cards = (rawTopics.length ? rawTopics : fallback)
        .map((item: { id?: unknown; title?: unknown; openingQuestion?: unknown }) => {
          const opening = verificationQuestionStartingPrompt({
            text: String(item?.openingQuestion || item?.title || ""),
          });
          if (!opening) return null;
          return {
            id: String(item?.id || opening),
            title: String(item?.title || opening),
            subtitle: "Starting prompt",
            openingQuestion: opening,
          } satisfies TapStartingTopic;
        })
        .filter((card: TapStartingTopic | null): card is TapStartingTopic => Boolean(card));
      if (payload.emptyPool || cards.length === 0) {
        setPhase("empty");
        return;
      }
      setPresetTopics(cards);
      setTopic(String(payload.topic || ""));
      setExactProblemOnCanvas(payload.exactProblemOnCanvas === true);
      setDurationMinutes(flowCountdownMinutes(payload.durationMinutes));
      setPhase("pick");
    } finally {
      setBusy(false);
    }
  }

  async function storeProof(input: {
    prompt: string;
    practice: boolean;
    questionId: string | null;
    policy?: { model: unknown; sequence: unknown } | null;
  }) {
    const response = await fetch(
      `/api/verification-flow/public/${encodeURIComponent(token)}/results`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: claimedIdentity,
          source: "runner",
          prompt: input.prompt,
          questionId: input.practice ? null : input.questionId || null,
          policy: input.policy ?? null,
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || "Could not store proof of work");
    }
  }

  if (phase === "pick" && presetTopics.length > 0) {
    return (
      <div className="h-screen min-h-0" data-verification-public-entry data-verification-tap-session>
        <TapScoreClient
          presetStartingTopics={presetTopics}
          localOpening
          sidebarMode="verification-tap"
          verificationToken={token}
          exactProblemOnCanvas={exactProblemOnCanvas}
          canvasProblem={topic}
          initialMinutes={durationMinutes}
          lockDuration
          onLocalProof={storeProof}
          initialSession={{ workspaceTitle: topic || "Verification flow", post_session: "show_results" }}
          showEndSession
        />
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <main className="min-h-screen bg-[#0b0b0b] text-white" data-verification-public-entry>
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6" data-verification-empty-pool>
          <h1 className="font-serif text-2xl">No starting question</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This verification flow has an empty question pool, so it does not offer generated topics.
          </p>
        </section>
      </main>
    );
  }

  return (
    <ProductFlowIdentityForm
      kind="verification"
      identity={identity}
      onIdentityChange={setIdentity}
      error={error}
      busy={busy}
      onSubmit={(event) => void claim(event)}
    />
  );
}
