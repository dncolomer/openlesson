"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ileWordBoxApplyWindowPointerUp,
  ileWordBoxMenuActions,
  ileWordBoxMenuPosition,
  ileWordBoxPointerDown,
  ileWordBoxPointerEnter,
  ileWordBoxPointerIdle,
  ileWordBoxShouldClearSelection,
  splitIleTurnWords,
  type IleWordBoxMenuAction,
  type IleWordBoxPointerState,
} from "@/lib/ile-word-boxes";

export function IleWordBoxText({
  text,
  onOpenTool,
  className,
}: {
  text: string;
  onOpenTool?: (action: IleWordBoxMenuAction) => void;
  className?: string;
}) {
  const tokens = splitIleTurnWords(text);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const pointerRef = useRef<IleWordBoxPointerState>(ileWordBoxPointerIdle());
  const [selected, setSelected] = useState<{ from: number; to: number } | null>(null);
  const [menu, setMenu] = useState<{ text: string; left: number; top: number } | null>(null);
  const selectedRef = useRef(selected);
  const menuRef = useRef(menu);
  selectedRef.current = selected;
  menuRef.current = menu;

  useEffect(() => {
    const onUp = (event: PointerEvent) => {
      const released = ileWordBoxApplyWindowPointerUp(
        pointerRef.current,
        tokensRef.current,
      );
      if (!released.apply) return;
      pointerRef.current = released.state;
      if (!released.menuText) {
        setMenu(null);
        return;
      }
      const pos = ileWordBoxMenuPosition({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      setMenu({ text: released.menuText, left: pos.left, top: pos.top });
    };
    const onDown = (event: PointerEvent) => {
      if (
        !ileWordBoxShouldClearSelection({
          target: event.target,
          hasSelection: selectedRef.current != null || menuRef.current != null,
        })
      ) {
        return;
      }
      pointerRef.current = ileWordBoxPointerIdle();
      setMenu(null);
      setSelected(null);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <span
      data-ile-word-box-surface
      className={className}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {tokens.map((token, index) => {
        if (token.kind === "gap") {
          if (token.text.includes("\n")) {
            return (
              <span key={`g-${index}`}>
                {token.text.split("\n").map((piece, i, arr) => (
                  <span key={`g-${index}-${i}`}>
                    {piece}
                    {i < arr.length - 1 ? <br /> : null}
                  </span>
                ))}
              </span>
            );
          }
          return <span key={`g-${index}`}>{token.text}</span>;
        }
        const isSelected =
          selected != null &&
          token.wordIndex >= selected.from &&
          token.wordIndex <= selected.to;
        return (
          <span
            key={`w-${token.wordIndex}`}
            data-ile-word-box
            data-ile-word-index={token.wordIndex}
            data-ile-word-selected={isSelected ? "true" : "false"}
            onPointerDown={(event: ReactPointerEvent<HTMLSpanElement>) => {
              event.preventDefault();
              pointerRef.current = ileWordBoxPointerDown(pointerRef.current, token.wordIndex);
              setMenu(null);
              setSelected({ from: token.wordIndex, to: token.wordIndex });
            }}
            onPointerEnter={() => {
              pointerRef.current = ileWordBoxPointerEnter(pointerRef.current, token.wordIndex);
              const live = pointerRef.current;
              if (!live.dragging || live.anchor == null || live.head == null) return;
              setSelected({
                from: Math.min(live.anchor, live.head),
                to: Math.max(live.anchor, live.head),
              });
            }}
            className={
              isSelected
                ? "cursor-text rounded-none border border-white/80 bg-white/15 px-0.5"
                : "cursor-text rounded-none border border-transparent px-0.5 hover:border-white/45"
            }
          >
            {token.text}
          </span>
        );
      })}
      {menu && typeof document !== "undefined"
        ? createPortal(
            <span
              data-ile-word-box-menu
              data-ile-word-box-menu-text={menu.text}
              data-ile-word-box-menu-at="pointer"
              role="menu"
              className="fixed z-[80] min-w-[11rem] overflow-hidden rounded-none border border-neutral-800 bg-neutral-950 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.72)]"
              style={{ left: menu.left, top: menu.top }}
            >
              {ileWordBoxMenuActions(menu.text).map((action, index) => (
                <span key={action.tool} className="block">
                  {index > 0 ? (
                    <span className="mx-1.5 my-0.5 block h-px bg-neutral-800" role="separator" />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    data-ile-word-box-open={action.tool}
                    className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-neutral-100 hover:bg-white hover:text-black"
                    onClick={() => {
                      onOpenTool?.(action);
                      pointerRef.current = ileWordBoxPointerIdle();
                      setMenu(null);
                      setSelected(null);
                    }}
                  >
                    {action.label}
                  </button>
                </span>
              ))}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
