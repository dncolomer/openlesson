"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initialAccordionOpenDrawerId,
  nextAccordionOpenDrawerId,
  nextRightPaneDrawerExpanded,
} from "@/lib/workspace-right-pane";

type DrawerAccordionContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
  registerDefault: (id: string, defaultExpanded: boolean) => void;
};

const DrawerAccordionContext = createContext<DrawerAccordionContextValue | null>(
  null,
);

/**
 * Accordion group: at most one section drawer open.
 * Opening any drawer collapses the others.
 * Supports controlled `openId` / `onOpenIdChange` for hosts that react to
 * which drawer is open (e.g. bridge map preview).
 */
export function WorkspaceRightPaneDrawerGroup({
  children,
  /** Preferred open id when multiple defaultExpanded (e.g. "detail"). */
  defaultOpenId = null,
  /** Controlled open drawer id (optional). */
  openId: openIdControlled,
  onOpenIdChange,
  className,
  ...dataAttrs
}: {
  children: ReactNode;
  defaultOpenId?: string | null;
  openId?: string | null;
  onOpenIdChange?: (id: string | null) => void;
  className?: string;
  // data-* surface markers (string | boolean for presence attrs)
  [key: `data-${string}`]: string | boolean | undefined;
}) {
  const [openIdUncontrolled, setOpenIdUncontrolled] = useState<string | null>(
    defaultOpenId ? String(defaultOpenId).trim() || null : null,
  );
  const isControlled = openIdControlled !== undefined;
  const openId = isControlled
    ? openIdControlled == null
      ? null
      : String(openIdControlled).trim() || null
    : openIdUncontrolled;

  const setOpenId = useCallback(
    (id: string | null) => {
      if (!isControlled) setOpenIdUncontrolled(id);
      onOpenIdChange?.(id);
    },
    [isControlled, onOpenIdChange],
  );

  const extra: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(dataAttrs)) {
    if (k.startsWith("data-") && v !== undefined && v !== false) {
      extra[k] = v === true ? "" : (v as string | boolean);
    }
  }

  const value = useMemo(
    () => ({
      openId,
      setOpenId,
      registerDefault: (_id: string, _defaultExpanded: boolean) => {
        /* open id is owned by the group initial state / parent */
      },
    }),
    [openId, setOpenId],
  );

  return (
    <DrawerAccordionContext.Provider value={value}>
      <div
        data-workspace-right-pane-drawer-group
        data-accordion-open={openId || ""}
        className={className}
        {...extra}
      >
        {children}
      </div>
    </DrawerAccordionContext.Provider>
  );
}

/**
 * Shared chrome for map right-column form surfaces:
 * top-anchored, full column width, collapsible body — not a floating card.
 * Collapse/expand via header only (no close button on the chrome).
 *
 * When nested in WorkspaceRightPaneDrawerGroup with a drawerId, opening this
 * drawer collapses every sibling in the group.
 */
export function WorkspaceRightPaneDrawer({
  paneKind,
  title,
  defaultExpanded = true,
  children,
  headerExtra,
  bodyClassName = "",
  surfaceDataAttr,
  drawerId,
  /** fill = sole surface (h-full). section = stackable drawer in a column. */
  variant = "fill",
}: {
  /** Value for data-workspace-right-pane (add_block | generate_shape | block-detail | …). */
  paneKind?: string;
  title: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
  bodyClassName?: string;
  /**
   * Extra surface marker on the shell (e.g. data-workspace-add-block-pane).
   */
  surfaceDataAttr?: string;
  /** Optional stable id for data-block-detail-drawer / section markers. */
  drawerId?: string;
  variant?: "fill" | "section";
}) {
  const group = useContext(DrawerAccordionContext);
  const id = drawerId ? String(drawerId).trim() : "";
  const inAccordion = Boolean(group && id);

  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  const expanded = inAccordion
    ? group!.openId === id
    : localExpanded;

  const toggle = useCallback(() => {
    if (inAccordion && group) {
      group.setOpenId(
        nextAccordionOpenDrawerId({
          currentOpenId: group.openId,
          clickedId: id,
        }),
      );
      return;
    }
    setLocalExpanded((cur) => nextRightPaneDrawerExpanded(cur, "toggle"));
  }, [group, id, inAccordion]);

  const surfaceProps = surfaceDataAttr
    ? ({ [surfaceDataAttr]: true } as Record<string, boolean>)
    : {};

  const shellClass =
    variant === "fill"
      ? "flex h-full w-full min-h-0 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95"
      : expanded
        ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95"
        : "flex w-full shrink-0 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95";

  return (
    <div
      data-workspace-right-pane-drawer
      {...(paneKind ? { "data-workspace-right-pane": paneKind } : {})}
      {...(drawerId
        ? {
            "data-block-detail-drawer": drawerId,
            "data-block-detail-tab": drawerId,
          }
        : {})}
      data-drawer-expanded={expanded ? "true" : "false"}
      data-drawer-open={expanded ? "true" : "false"}
      data-drawer-anchor="top"
      data-drawer-width="full"
      data-drawer-variant={variant}
      data-drawer-accordion={inAccordion ? "true" : "false"}
      className={shellClass}
      {...surfaceProps}
    >
      <header
        data-workspace-right-pane-drawer-header
        {...(drawerId
          ? { "data-block-detail-drawer-header": drawerId }
          : {})}
        className="flex shrink-0 items-stretch border-b border-neutral-800/70 bg-neutral-950"
      >
        <button
          type="button"
          data-workspace-right-pane-drawer-toggle
          aria-expanded={expanded}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition hover:bg-neutral-900/60 sm:px-4"
        >
          <span
            className={`shrink-0 text-[10px] text-neutral-500 transition ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ›
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
            {title}
          </span>
        </button>
        {headerExtra}
      </header>

      {expanded ? (
        <div
          data-workspace-right-pane-drawer-body
          {...(drawerId
            ? {
                "data-block-detail-drawer-body": drawerId,
                "data-block-detail-tab-panel": drawerId,
                "data-block-detail-tab-content": drawerId,
              }
            : {})}
          role="region"
          className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 sm:py-4 ${bodyClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Resolve initial open id for creator block-detail stack (no Sessions/detail drawer). */
export function resolveDetailDrawerDefaultOpenId(input: {
  hasLocalMaterials: boolean;
  showSplit?: boolean;
  canEdit?: boolean;
}): string {
  const candidates = [
    // Edit is primary for owners (title/description live there).
    ...(input.canEdit ? [{ id: "edit", defaultExpanded: true }] : []),
    { id: "local", defaultExpanded: input.hasLocalMaterials && !input.canEdit },
    { id: "simulation", defaultExpanded: false },
    ...(input.showSplit ? [{ id: "split", defaultExpanded: false }] : []),
  ];
  return (
    initialAccordionOpenDrawerId(candidates) ||
    (input.canEdit ? "edit" : input.hasLocalMaterials ? "local" : "simulation")
  );
}
