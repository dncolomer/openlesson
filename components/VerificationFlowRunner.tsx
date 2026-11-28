"use client";

import { useEffect, useState } from "react";
import { TapScoreClient } from "@/components/TapScoreClient";
import { ProductFlowIdentityForm } from "@/components/product-flow/product-flow-identity-form";
import { flowCountdownMinutes } from "@/lib/flow-countdown";
import { PROTOCOL_LABEL } from "@/lib/product-flow";
import type { TapStartingTopic } from "@/lib/tap-score";
import {
  parseProtocolLaunchIdentity,
  verificationQuestionStartingPrompt,
} from "@/lib/verification-flow";
import {
  DEFAULT_FLOW_ENFORCED_CHANNELS,
  parseFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  DEFAULT_FLOW_CANVAS_CAPTURE,
  parseFlowCanvasCapture,
  type FlowCanvasCapture,
} from "@/lib/flow-canvas-capture";
import { parseFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import { ltiIdentityForPublicToken } from "@/lib/lti/auto-claim";
import { parseSessionSidebarStyle, type SessionSidebarStyle } from "@/lib/session-sidebar-style";
import { SessionSidebarStyleOverride } from "@/lib/use-session-sidebar-style";

type Phase = "identity" | "claiming" | "pick" | "empty";

export function VerificationFlowRunner({
  token,
  prepopulatedIdentity = "",
}: {
  token: string;
  prepopulatedIdentity?: string;
}) {
  const [phase, setPhase] = useState<Phase>(prepopulatedIdentity ? "claiming" : "identity");
  const [identity, setIdentity] = useState("");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [claimedSessionId, setClaimedSessionId] = useState<string | null>(null);
  const [claimedPrivateToken, setClaimedPrivateToken] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [presetTopics, setPresetTopics] = useState<TapStartingTopic[]>([]);
  const [exactProblemOnCanvas, setExactProblemOnCanvas] = useState(false);
  const [openingCanvasScene, setOpeningCanvasScene] = useState<IleWorkCanvasScene | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [enforcedChannels, setEnforcedChannels] = useState<FlowEnforcedChannels>(
    DEFAULT_FLOW_ENFORCED_CHANNELS,
  );
  const [canvasCapture, setCanvasCapture] = useState<FlowCanvasCapture>(
    DEFAULT_FLOW_CANVAS_CAPTURE,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarStyle, setSidebarStyle] = useState<SessionSidebarStyle | null>(null);

  async function claimIdentity(nextIdentity: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/verification-flow/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: nextIdentity }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not start");
        return;
      }
      setClaimedIdentity(String(payload.identity || nextIdentity.trim()));
      setClaimedSessionId(
        typeof payload.sessionId === "string" && payload.sessionId.trim()
          ? payload.sessionId.trim()
          : null,
      );
      setClaimedPrivateToken(
        typeof payload.privateToken === "string" && payload.privateToken.trim()
          ? payload.privateToken.trim()
          : null,
      );
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
      setOpeningCanvasScene(parseFlowOpeningCanvasScene(payload.openingCanvasScene));
      setDurationMinutes(flowCountdownMinutes(payload.durationMinutes));
      setEnforcedChannels(parseFlowEnforcedChannels(payload.enforcedChannels));
      setCanvasCapture(parseFlowCanvasCapture(payload.canvasCapture));
      setSidebarStyle(parseSessionSidebarStyle(payload.sidebarStyle));
      setPhase("pick");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fromUrl =
      prepopulatedIdentity ||
      (typeof window === "undefined"
        ? ""
        : parseProtocolLaunchIdentity(new URLSearchParams(window.location.search)));
    if (fromUrl) {
      setIdentity(fromUrl);
      setPhase("claiming");
      void claimIdentity(fromUrl);
      return;
    }
    void ltiIdentityForPublicToken(token).then((ltiIdentity) => {
      if (ltiIdentity) void claimIdentity(ltiIdentity);
    });
  }, [token, prepopulatedIdentity]);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    await claimIdentity(identity);
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
          runId: claimedSessionId || undefined,
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
        <SessionSidebarStyleOverride style={sidebarStyle}>
        <TapScoreClient
          presetStartingTopics={presetTopics}
          localOpening
          sessionId={claimedSessionId || undefined}
          privateToken={claimedPrivateToken || undefined}
          sidebarMode="verification-tap"
          verificationToken={token}
          exactProblemOnCanvas={exactProblemOnCanvas}
          openingCanvasScene={openingCanvasScene}
          canvasProblem={topic}
          enforcedChannels={enforcedChannels}
          canvasCapture={canvasCapture}
          initialMinutes={durationMinutes}
          lockDuration
          onLocalProof={storeProof}
          initialSession={{
            id: claimedSessionId || undefined,
            workspaceTitle: topic || "Verification flow",
            post_session: "show_results",
          }}
          showEndSession
        />
        </SessionSidebarStyleOverride>
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

  if (prepopulatedIdentity || phase === "claiming") {
    return (
      <main
        className="min-h-screen bg-[#0b0b0b] text-white"
        data-verification-public-entry=""
        data-verification-identity-prepopulated=""
      >
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            {PROTOCOL_LABEL}
          </p>
          <h1 className="font-serif text-2xl">Starting</h1>
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <p className="text-sm text-neutral-400">
              Opening this protocol as {prepopulatedIdentity || identity}.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <ProductFlowIdentityForm
      identity={identity}
      onIdentityChange={setIdentity}
      error={error}
      busy={busy}
      onSubmit={(event) => void claim(event)}
    />
  );
}
