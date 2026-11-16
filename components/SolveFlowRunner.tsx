"use client";

import { useState } from "react";
import { SessionView } from "@/components/SessionView";
import { ProductFlowIdentityForm } from "@/components/product-flow/product-flow-identity-form";
import { solvePublicApiPath } from "@/lib/session-pow-api-paths";

type Phase = "identity" | "work";

export function SolveFlowRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("identity");
  const [identity, setIdentity] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(solvePublicApiPath(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(
          payload?.error?.message === "duplicate"
            ? "That identity is already used for this solve flow."
            : payload?.error?.message === "empty"
              ? "Enter an identity."
              : payload?.error?.message || "Could not start",
        );
        return;
      }
      const nextSessionId = String(payload.sessionId || "").trim();
      if (!nextSessionId) {
        setError("Could not start a session");
        return;
      }
      setSessionId(nextSessionId);
      setPhase("work");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "work" && sessionId) {
    return (
      <div className="h-screen min-h-0" data-solve-public-entry data-solve-learn-session>
        <SessionView sessionId={sessionId} showEndSession solveToken={token} />
      </div>
    );
  }

  return (
    <ProductFlowIdentityForm
      kind="solve"
      identity={identity}
      onIdentityChange={setIdentity}
      error={error}
      busy={busy}
      onSubmit={(event) => void claim(event)}
    />
  );
}
