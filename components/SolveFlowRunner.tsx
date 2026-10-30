"use client";

import { useState } from "react";
import { SessionView } from "@/components/SessionView";

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
      const response = await fetch(`/api/solve-flow/public/${encodeURIComponent(token)}`, {
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
    <main className="min-h-screen bg-[#0b0b0b] text-white" data-solve-public-entry>
      <form
        onSubmit={(event) => void claim(event)}
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6"
        data-solve-identity
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          Solve flow
        </p>
        <h1 className="font-serif text-2xl">Identify yourself</h1>
        <p className="text-sm text-neutral-400">
          Enter a unique string for this flow. A duplicate does not start.
        </p>
        <input
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          data-solve-identity-input
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
    </main>
  );
}
