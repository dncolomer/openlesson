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
