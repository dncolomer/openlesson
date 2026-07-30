"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  productIntentClusterHint,
  productIntentClusterLabel,
  type ProductLaunchTarget,
} from "@/lib/product-intent";
import type { PracticePortalProductId } from "@/lib/practice-portal";

type LandingBlock = {
  id: string;
  title: string | null;
  is_start: boolean;
};

type LandingProduct = {
  id: PracticePortalProductId;
  launch: ProductLaunchTarget;
  timings: number[];
};

export type PracticePortalLandingProps = {
  token: string;
  workspace: {
    id: string;
    title: string | null;
    root_topic: string | null;
  };
  label: string | null;
  products: LandingProduct[];
  blocks: LandingBlock[];
  /** When set by portal config, block is fixed and visitor cannot change it. */
  fixedBlockId?: string | null;
};

type MintResult = {
  product_id: PracticePortalProductId;
  link_kind: "tap" | "ile";
  url: string;
  minutes: number | null;
};

/** MoK-aligned accents: slate for explore, amber for drill. */
function productAccent(id: PracticePortalProductId): "slate" | "amber" {
  return id.endsWith("_drill") ? "amber" : "slate";
}

function productEyebrow(id: PracticePortalProductId): string {
  switch (id) {
    case "timed_explore":
      return "Interactive LLM-powered Dialog";
    case "timed_drill":
      return "Solo monolog";
    case "open_ended_explore":
      return "Open dialogue";
    case "open_ended_drill":
      return "Open solo practice";
    default:
      return "Practice";
  }
}

const ACCENT_CLASSES: Record<
  "slate" | "amber",
  { card: string; button: string; pill: string; dot: string; eyebrow: string }
> = {
  slate: {
    card: "border-zinc-700 bg-zinc-950/80 backdrop-blur-sm hover:border-zinc-500",
    button:
      "border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800 hover:text-white",
    pill: "border-zinc-600 bg-zinc-800/80 text-zinc-300",
    dot: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]",
    eyebrow: "text-zinc-500",
  },
  amber: {
    card: "border-amber-500/30 bg-amber-950/20 backdrop-blur-sm hover:border-amber-400/50",
    button:
      "border-amber-500/40 bg-amber-950/40 text-amber-50 hover:border-amber-400/60 hover:bg-amber-900/40",
    pill: "border-amber-400/35 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]",
    eyebrow: "text-amber-200/70",
  },
};

/**
 * Public Practice Portal mint UI — product cards + duration pickers
 * in Map of Knowledge mint language, scoped to one workspace.
 */
export function PracticePortalLandingClient({
  token,
  workspace,
  label,
  products,
  blocks,
  fixedBlockId = null,
}: PracticePortalLandingProps) {
  const defaultBlockId = useMemo(() => {
    if (fixedBlockId) return fixedBlockId;
    if (blocks.length === 0) return "";
    const start = blocks.find((b) => b.is_start);
    return (start || blocks[0]).id;
  }, [blocks, fixedBlockId]);

  const [selectedBlockId, setSelectedBlockId] = useState(defaultBlockId);
  const blockIsFixed = Boolean(fixedBlockId);
  const [selectedMinutes, setSelectedMinutes] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of products) {
      if (p.timings.length > 0) init[p.id] = p.timings[0];
    }
    return init;
  });
  const [minting, setMinting] = useState<PracticePortalProductId | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [copied, setCopied] = useState(false);

  const title =
    workspace.title?.trim() ||
    workspace.root_topic?.trim() ||
    "Practice workspace";

  const mint = useCallback(
    async (productId: PracticePortalProductId) => {
      setMinting(productId);
      setMintError(null);
      try {
        const product = products.find((p) => p.id === productId);
        if (!product) throw new Error("Product not available");

        const body: Record<string, unknown> = { product_id: productId };
        if (product.timings.length > 0) {
          body.minutes = selectedMinutes[productId] ?? product.timings[0];
        }
        if (productId.startsWith("open_ended_")) {
          if (!selectedBlockId) throw new Error("Select a practice block first");
          body.block_id = selectedBlockId;
        } else if (selectedBlockId) {
          body.block_id = selectedBlockId;
        }

        const res = await fetch(
          `/api/practice-portal/${encodeURIComponent(token)}/mint`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === "string" ? json.error : "Failed to mint link",
          );
        }
        const url =
          (typeof json.url === "string" && json.url) ||
          (typeof json.private_url === "string" && json.private_url) ||
          "";
        if (!url) throw new Error("Mint succeeded but no URL returned");
        setMintResult({
          product_id: productId,
          link_kind: json.link_kind === "ile" ? "ile" : "tap",
          url,
          minutes: typeof json.minutes === "number" ? json.minutes : null,
        });
      } catch (err) {
        setMintError(err instanceof Error ? err.message : "Failed to mint link");
      } finally {
        setMinting(null);
      }
    },
    [products, selectedBlockId, selectedMinutes, token],
  );

  const copyUrl = useCallback(async () => {
    if (!mintResult?.url) return;
    try {
      await navigator.clipboard.writeText(mintResult.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMintError("Could not copy link");
    }
  }, [mintResult?.url]);

  return (
    <div
      className="flex w-full flex-col items-stretch gap-6"
      data-practice-portal-landing
      data-practice-portal-workspace={workspace.id}
    >
      <header className="flex flex-col items-center text-center">
        <div
          className="mb-3 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500"
          data-practice-portal-eyebrow-chip
        >
          Knowledge Portal
        </div>
        <h1 className="max-w-2xl text-3xl font-medium leading-tight tracking-[-1.2px] text-white sm:text-4xl">
          {label?.trim() || title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Choose the session type that best fits your style
          {title ? (
            <>
              {" "}
              for <span className="text-zinc-200">{title}</span>
            </>
          ) : null}
          .
        </p>
      </header>

      <div
        className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur-sm sm:p-5"
        data-practice-portal-desk
      >
        {blockIsFixed && selectedBlockId ? (
          <div
            className="mb-5 rounded-sm border border-zinc-800/80 bg-black/30 px-3 py-2.5"
            data-practice-portal-block-fixed
            data-practice-portal-fixed-block={selectedBlockId}
          >
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
              Practice block
            </p>
            <p className="mt-1 text-sm text-zinc-200">
              {blocks.find((b) => b.id === selectedBlockId)?.title ||
                selectedBlockId.slice(0, 8)}
            </p>
          </div>
        ) : blocks.length > 0 ? (
          <div className="mb-5 flex flex-col gap-2" data-practice-portal-block-picker>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Practice block
              </span>
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 text-sm text-white"
                data-practice-portal-block-select
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title || b.id.slice(0, 8)}
                    {b.is_start ? " (start)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Open-ended sessions require a block. Timed sessions may use a block or the full
              workspace.
            </p>
          </div>
        ) : null}

        {products.length === 0 ? (
          <p className="text-sm text-zinc-500">This portal has no products enabled.</p>
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2"
            data-practice-portal-product-cards
          >
            {products.map((product) => {
              const accent = productAccent(product.id);
              const styles = ACCENT_CLASSES[accent];
              const isTimed = product.timings.length > 0;
              const mins = selectedMinutes[product.id] ?? product.timings[0];
              const needsBlock = product.id.startsWith("open_ended_");
              const disabled =
                minting !== null ||
                (needsBlock && !selectedBlockId);

              return (
                <div
                  key={product.id}
                  className={`flex flex-col rounded-sm border p-4 transition ${styles.card}`}
                  data-practice-portal-product-card={product.id}
                  data-mint-product={product.id}
                  data-product-intent-id={product.id}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[1.5px] ${styles.eyebrow}`}
                    >
                      {productEyebrow(product.id)}
                    </span>
                  </span>
                  <span
                    className={`mt-2 text-base font-medium ${
                      accent === "amber" ? "text-amber-50" : "text-white"
                    }`}
                  >
                    {productIntentClusterLabel(product.launch)}
                  </span>
                  <span
                    className={`mt-1 text-xs leading-relaxed ${
                      accent === "amber" ? "text-amber-100/50" : "text-zinc-500"
                    }`}
                  >
                    {productIntentClusterHint(product.launch)}
                  </span>

                  {isTimed ? (
                    <div
                      className="mt-3 w-full"
                      data-practice-portal-duration-picker={product.id}
                      data-timed-duration-picker={product.id}
                    >
                      <p
                        className={`mb-1.5 font-mono text-[10px] uppercase tracking-[1.5px] ${
                          accent === "amber" ? "text-amber-200/60" : "text-zinc-500"
                        }`}
                      >
                        Session length
                      </p>
                      <div
                        className={`inline-flex w-full rounded-sm border p-0.5 ${
                          accent === "amber"
                            ? "border-amber-500/25 bg-black/30"
                            : "border-zinc-700 bg-black/40"
                        }`}
                        role="group"
                        data-duration-options={product.id}
                      >
                        {product.timings.map((m) => {
                          const selected = mins === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() =>
                                setSelectedMinutes((cur) => ({ ...cur, [product.id]: m }))
                              }
                              disabled={minting !== null}
                              className={`min-w-0 flex-1 rounded-sm px-2 py-1.5 font-mono text-[11px] tracking-wide transition disabled:opacity-40 ${
                                accent === "amber"
                                  ? selected
                                    ? "bg-amber-500/20 text-amber-50"
                                    : "text-amber-100/45 hover:text-amber-100/80"
                                  : selected
                                    ? "bg-white/15 text-white"
                                    : "text-zinc-500 hover:text-zinc-200"
                              }`}
                              data-duration-minutes={m}
                              data-practice-portal-duration={m}
                              aria-pressed={selected}
                            >
                              {m} min
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void mint(product.id)}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-medium transition disabled:opacity-40 ${styles.button}`}
                    data-practice-portal-mint={product.id}
                    data-mint-product-action={product.id}
                  >
                    {minting === product.id
                      ? "Minting…"
                      : isTimed
                        ? `Get ${mins}-minute session URL`
                        : "Get session URL"}
                    <ExternalLink size={12} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {mintError ? (
          <div
            role="alert"
            className="mt-4 rounded-sm border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300"
            data-practice-portal-mint-error
          >
            {mintError}
          </div>
        ) : null}

        {mintResult ? (
          <div
            data-practice-portal-mint-result
            data-minted-link-card
            data-minted-kind={mintResult.product_id}
            className={`mt-4 rounded-sm border p-4 sm:p-5 ${
              productAccent(mintResult.product_id) === "amber"
                ? "border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-zinc-950/80 to-zinc-950/90"
                : "border-zinc-600 bg-gradient-to-br from-zinc-900/90 via-zinc-950/90 to-zinc-950"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] ${
                    ACCENT_CLASSES[productAccent(mintResult.product_id)].pill
                  }`}
                >
                  {mintResult.product_id.replace(/_/g, " ")}
                </span>
                <p className="mt-2 text-sm text-zinc-300">Your private session link</p>
                {mintResult.minutes != null ? (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {mintResult.minutes} minutes
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-600 px-3 py-1.5 text-xs text-white transition hover:border-zinc-400"
                data-practice-portal-copy
              >
                {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <a
              href={mintResult.url}
              className="mt-3 block break-all font-mono text-xs text-cyan-300/90 underline-offset-2 hover:underline"
              data-practice-portal-session-url
            >
              {mintResult.url}
            </a>
            <a
              href={mintResult.url}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-white bg-white px-4 py-2.5 text-xs font-medium text-black transition hover:bg-zinc-200"
              data-practice-portal-open-session
            >
              Open session
              <ExternalLink size={12} aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
