"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { absoluteFlowPublicUrl, flowPublicHref } from "@/lib/product-flow";

const FLOW_PUBLIC_ACTION_CLASS =
  "console-button shrink-0 px-3 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:border-white/80 hover:text-white";

export function CopyFlowUrlButton({
  url,
  className = FLOW_PUBLIC_ACTION_CLASS,
}: {
  url: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const href = String(url || "").trim();
  if (!href) return null;

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(
        absoluteFlowPublicUrl(href, window.location.origin),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be denied */
    }
  }

  return (
    <button type="button" data-flow-copy-url onClick={(event) => void copy(event)} className={className}>
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

export function StartFlowButton({
  url,
  className = FLOW_PUBLIC_ACTION_CLASS,
}: {
  url: string;
  className?: string;
}) {
  const href = flowPublicHref(url);
  if (!href) return null;
  return (
    <Link
      href={href}
      data-flow-start
      className={className}
      onClick={(event) => event.stopPropagation()}
    >
      Start
    </Link>
  );
}

export function FlowPublicActions({ url }: { url: string }) {
  if (!String(url || "").trim()) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2" data-flow-public-actions>
      <CopyFlowUrlButton url={url} />
      <StartFlowButton url={url} />
    </div>
  );
}

export type FlowPublicLinkRow = {
  id: string;
  label: string | null;
  url: string;
};

export function FlowPublicLinks({
  defaultUrl,
  links,
  onAdd,
  onRemove,
  busy = false,
}: {
  defaultUrl: string;
  links: readonly FlowPublicLinkRow[];
  onAdd: (label: string) => void;
  onRemove: (id: string) => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const defaultHref = String(defaultUrl || "").trim();
  if (!defaultHref) return null;
  return (
    <div className="space-y-3" data-flow-links="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-300">Test</p>
        <FlowPublicActions url={defaultHref} />
      </div>
      {links.map((link) => (
        <div
          key={link.id}
          className="flex flex-wrap items-center justify-between gap-3"
          data-flow-link={link.id}
        >
          <p className="text-sm text-neutral-300" data-flow-link-label="">
            {String(link.label || "").trim() || "Test"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <FlowPublicActions url={link.url} />
            <button
              type="button"
              data-flow-link-remove=""
              disabled={busy}
              onClick={() => onRemove(link.id)}
              className="console-button px-3 py-1.5 text-[11px] font-medium text-red-300 transition hover:border-red-300/70 hover:text-red-200 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <form
        className="flex flex-wrap items-end gap-2"
        data-flow-link-add=""
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(draft);
          setDraft("");
        }}
      >
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Label
          </span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="reference"
            data-flow-link-label-input=""
            className="w-full rounded-none border border-white/40 bg-black px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          data-flow-link-add-submit=""
          className="console-button shrink-0 px-3 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:border-white/80 hover:text-white disabled:opacity-40"
        >
          Add link
        </button>
      </form>
    </div>
  );
}
