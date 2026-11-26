"use client";

import type { FormEvent } from "react";
import { PROTOCOL_LABEL } from "@/lib/product-flow";

export function ProductFlowIdentityForm({
  identity,
  onIdentityChange,
  error,
  busy,
  onSubmit,
}: {
  identity: string;
  onIdentityChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white" data-verification-public-entry="">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6"
        data-verification-identity=""
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          {PROTOCOL_LABEL}
        </p>
        <h1 className="font-serif text-2xl">Identify yourself</h1>
        <p className="text-sm text-neutral-400">
          Enter a unique string for this protocol. A duplicate does not start.
        </p>
        <input
          value={identity}
          onChange={(event) => onIdentityChange(event.target.value)}
          data-verification-identity-input=""
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
