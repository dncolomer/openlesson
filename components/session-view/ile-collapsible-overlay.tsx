"use client";

import { useState, type ReactNode } from "react";

/** Overlay widget on the work canvas. Collapse keeps the learner on the canvas. */
export function IleCollapsibleOverlay({
  id,
  title,
  children,
  className = "",
  defaultCollapsed = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div
      data-ile-overlay-widget={id}
      data-ile-overlay-collapsed={collapsed ? "true" : "false"}
      className={className}
    >
      <button
        type="button"
        data-ile-widget-collapse={id}
        aria-expanded={collapsed ? "false" : "true"}
        onClick={() => setCollapsed((value) => !value)}
        className="pointer-events-auto flex w-full items-center justify-between gap-2 rounded-none border border-white/30 bg-neutral-950 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white hover:border-white"
      >
        <span>{title}</span>
        <span aria-hidden>{collapsed ? "+" : "–"}</span>
      </button>
      {collapsed ? null : <div className="pointer-events-auto mt-1">{children}</div>}
    </div>
  );
}
