"use client";

import type { FormEvent } from "react";
import { productFlowKindLabel, type ProductFlowKind } from "@/lib/product-flow";

export function ProductFlowIdentityForm({
  kind,
  identity,
  onIdentityChange,
  error,
  busy,
  onSubmit,
}: {
  kind: ProductFlowKind;
  identity: string;
  onIdentityChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const label = productFlowKindLabel(kind);
  const hook =
    kind === "solve"
      ? "data-solve-identity"
      : kind === "verification"
        ? "data-verification-identity"
        : "data-calibration-identity";
  const inputHook =
    kind === "solve"
      ? "data-solve-identity-input"
      : kind === "verification"
        ? "data-verification-identity-input"
        : "data-calibration-identity-input";
  const entryHook =
    kind === "solve"
      ? "data-solve-public-entry"
      : kind === "verification"
        ? "data-verification-public-entry"
        : undefined;

  return (
    <main
      className="min-h-screen bg-[#0b0b0b] text-white"
      {...(entryHook ? { [entryHook]: "" } : { "data-calibration-session": "" })}
    >
      <form
        onSubmit={onSubmit}
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6"
        {...{ [hook]: "" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
          {label} flow
        </p>
        <h1 className="font-serif text-2xl">Identify yourself</h1>
        <p className="text-sm text-neutral-400">
          Enter a unique string for this flow. A duplicate does not start.
        </p>
        <input
          value={identity}
          onChange={(event) => onIdentityChange(event.target.value)}
          {...{ [inputHook]: "" }}
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
