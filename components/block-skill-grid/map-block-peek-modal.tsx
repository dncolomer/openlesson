"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { MapBlockPeek } from "@/lib/block-map-peek";

export function MapBlockPeekModal({
  peek,
  onClose,
}: {
  peek: MapBlockPeek | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!peek) return;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [peek]);

  useEffect(() => {
    if (!peek) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek, onClose]);

  if (!peek) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4"
      data-map-block-peek
      data-map-block-peek-id={peek.id}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-block-peek-title"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        data-map-block-peek-overlay
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(70%,28rem)] w-full max-w-md flex-col overflow-hidden rounded-none border border-neutral-800 bg-neutral-900 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        data-map-block-peek-panel
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-800/70 px-5 py-4">
          <h3
            id="map-block-peek-title"
            className="min-w-0 text-base font-semibold leading-snug text-white"
            data-map-block-peek-title
          >
            {peek.title}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
            aria-label="Close"
            title="Close"
            data-map-block-peek-close
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {peek.description ? (
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <p
              className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-300"
              data-map-block-peek-description
            >
              {peek.description}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
