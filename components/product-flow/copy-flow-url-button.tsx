"use client";

import { useState, type MouseEvent } from "react";
import { absoluteFlowPublicUrl } from "@/lib/product-flow";

export function CopyFlowUrlButton({
  url,
  className = "shrink-0 border border-white/40 px-2 py-1 text-[11px] font-medium text-white hover:border-white/80",
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
