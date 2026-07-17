"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

type CollapsedSide = null | "left" | "right";

export interface ResizablePaneHandle {
  expandLeft: () => void;
  expandRight: () => void;
  setLayout: (opts: { leftWidth?: number; collapsedSide?: CollapsedSide }) => void;
}

interface ResizablePaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  storageKey?: string;
}

export const ResizablePane = forwardRef<ResizablePaneHandle, ResizablePaneProps>(function ResizablePane({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  minRightWidth = 20,
  storageKey,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedSide, setCollapsedSide] = useState<CollapsedSide>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const savedLeftWidthRef = useRef(defaultLeftWidth);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.leftWidth === "number") {
          setLeftWidth(parsed.leftWidth);
          savedLeftWidthRef.current = parsed.leftWidth;
        }
        if (parsed.collapsedSide === "left" || parsed.collapsedSide === "right") {
          setCollapsedSide(parsed.collapsedSide);
        }
      }
    } catch {
      // ignore malformed localStorage
    }
  }, [storageKey]);

  // Persist state to localStorage on changes
  const persistState = useCallback(
    (width: number, collapsed: CollapsedSide) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ leftWidth: width, collapsedSide: collapsed })
        );
      } catch {
        // ignore quota errors
      }
    },
    [storageKey]
  );

  // --- Drag logic (unchanged behavior) ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsedSide) return; // no drag when collapsed
      e.preventDefault();
      setIsDragging(true);
    },
    [collapsedSide]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      const leftPercent = (mouseX / containerWidth) * 100;
      const clampedPercent = Math.max(
        minLeftWidth,
        Math.min(100 - minRightWidth, leftPercent)
      );

      setLeftWidth(clampedPercent);
      savedLeftWidthRef.current = clampedPercent;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist the new width after drag
      persistState(savedLeftWidthRef.current, collapsedSide);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth, collapsedSide, persistState]);

  // --- Expand ---
  const expand = useCallback(() => {
    setIsTransitioning(true);
    setLeftWidth(savedLeftWidthRef.current);
    setCollapsedSide(null);
    persistState(savedLeftWidthRef.current, null);
    setTimeout(() => setIsTransitioning(false), 250);
  }, [persistState]);

  // Expose expand methods to parent via ref
  useImperativeHandle(ref, () => ({
    expandLeft: () => {
      if (collapsedSide === "left") expand();
    },
    expandRight: () => {
      if (collapsedSide === "right") expand();
    },
    setLayout: ({ leftWidth: newLeftWidth, collapsedSide: newCollapsed }) => {
      setIsTransitioning(true);
      const nextCollapsed = newCollapsed === undefined ? null : newCollapsed;
      if (typeof newLeftWidth === "number") {
        const clamped = Math.max(minLeftWidth, Math.min(100 - minRightWidth, newLeftWidth));
        setLeftWidth(clamped);
        savedLeftWidthRef.current = clamped;
      }
      setCollapsedSide(nextCollapsed);
      persistState(savedLeftWidthRef.current, nextCollapsed);
      setTimeout(() => setIsTransitioning(false), 250);
    },
  }), [collapsedSide, expand, minLeftWidth, minRightWidth, persistState]);

  // --- Double-click to reset to 50/50 ---
  const handleDoubleClick = useCallback(() => {
    setIsTransitioning(true);
    setLeftWidth(50);
    savedLeftWidthRef.current = 50;
    setCollapsedSide(null);
    persistState(50, null);
    setTimeout(() => setIsTransitioning(false), 250);
  }, [persistState]);

  // --- Compute actual widths ---
  const effectiveLeftWidth =
    collapsedSide === "left" ? 0 : collapsedSide === "right" ? 100 : leftWidth;
  const effectiveRightWidth = 100 - effectiveLeftWidth;

  const transitionClass =
    isTransitioning && !isDragging ? "transition-all duration-200 ease-in-out" : "";

  return (
    <div ref={containerRef} className="flex flex-1 h-full min-h-0 overflow-hidden relative">
      {/* Left/right collapsed strips removed — a hidden panel is fully
          hidden with no visible affordance. Visibility is driven by the
          view toggles in SessionView's top bar. */}

      {/* ---- Left panel ---- */}
      <div
        style={{ width: collapsedSide === "left" ? "0%" : collapsedSide === "right" ? "100%" : `${leftWidth}%` }}
        className={`min-w-0 overflow-hidden ${transitionClass} ${collapsedSide === "left" ? "invisible" : ""}`}
      >
        {left}
      </div>

      {/* ---- Separator bar ---- */}
      {collapsedSide === null && (
        <div
          className={`w-1.5 cursor-col-resize bg-neutral-800 hover:bg-blue-500/70 flex-shrink-0 transition-colors ${
            isDragging ? "bg-blue-500" : ""
          }`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        />
      )}

      {/* ---- Right panel ---- */}
      <div
        style={{ width: collapsedSide === "right" ? "0%" : collapsedSide === "left" ? "100%" : `${effectiveRightWidth}%` }}
        className={`min-w-0 overflow-hidden ${transitionClass} ${collapsedSide === "right" ? "invisible" : ""}`}
      >
        {right}
      </div>
    </div>
  );
});


