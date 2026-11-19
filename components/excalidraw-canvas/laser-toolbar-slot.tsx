"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { setLiveActiveTool, type LiveExcalidrawAPI } from "@/components/excalidraw-canvas/excalidraw-api";

const LASER_ICON = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6.2 11.8a5.3 5.3 0 1 1 5.3-5.3l8.8 8.8a3.3 3.3 0 0 1-4.7 4.7z" />
    <path d="m14.2 14.2 3.3 3.3M11 11.6l2 2M6.2 6.2l3 3" />
  </svg>
);

export function IleLaserToolbarSlot({
  hostRef,
  apiRef,
  active,
  onToggle,
}: {
  hostRef: { current: HTMLElement | null };
  apiRef: { current: LiveExcalidrawAPI | null };
  active: boolean;
  onToggle?: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let node = host.querySelector("[data-ile-toolbar-laser-slot]") as HTMLElement | null;
    const place = () => {
      const toolbar = host.querySelector(".App-toolbar") as HTMLElement | null;
      if (!toolbar) return;
      if (!node) {
        node = document.createElement("div");
        node.setAttribute("data-ile-toolbar-laser-slot", "");
        node.style.display = "contents";
      }
      const divider = toolbar.querySelector(".App-toolbar__divider");
      if (divider && node.nextSibling !== divider && node.parentElement !== toolbar) {
        toolbar.insertBefore(node, divider);
      } else if (!node.parentElement) {
        toolbar.appendChild(node);
      }
      setSlot((prev) => (prev === node ? prev : node));
    };
    place();
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    let observed: Node | null = null;
    const observer = new MutationObserver(() => {
      schedule();
      attach();
    });
    const attach = () => {
      const toolbar = host.querySelector(".App-toolbar");
      const target: Node = toolbar ?? host;
      if (observed === target) return;
      observer.disconnect();
      observed = target;
      observer.observe(target, {
        childList: true,
        subtree: target === host,
      });
    };
    attach();
    return () => {
      observer.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      node?.remove();
    };
  }, [hostRef]);

  if (!slot) return null;
  return createPortal(
    <button
      type="button"
      data-ile-toolbar-laser
      className={`ToolIcon ToolIcon_type_toggle${active ? " ToolIcon--checked" : ""}`}
      title="Laser pointer — K"
      aria-label="Laser pointer"
      aria-pressed={active ? "true" : "false"}
      onClick={() =>
        onToggle ? onToggle() : setLiveActiveTool(apiRef.current, { type: "laser" })
      }
    >
      <div className="ToolIcon__icon">{LASER_ICON}</div>
    </button>,
    slot,
  );
}
