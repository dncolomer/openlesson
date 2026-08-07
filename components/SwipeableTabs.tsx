"use client";

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface SwipeableTabsProps {
  tabs: Tab[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  tabIndicatorColor?: string;
}

export function SwipeableTabs({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  tabIndicatorColor = "bg-white",
}: SwipeableTabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(0);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const setActiveTab = useCallback((index: number) => {
    if (onTabChange) {
      onTabChange(index);
    } else {
      setInternalActiveTab(index);
    }
  }, [onTabChange]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchCurrentRef.current = touch.clientX;
    setIsDragging(true);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // If vertical scroll is more significant, don't handle horizontal swipe
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      touchStartRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    // Prevent default only for horizontal swipes
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }

    touchCurrentRef.current = touch.clientX;
    
    // Apply resistance at edges
    let offset = deltaX;
    if ((activeTab === 0 && deltaX > 0) || (activeTab === tabs.length - 1 && deltaX < 0)) {
      offset = deltaX * 0.3; // Rubber band effect
    }
    
    setDragOffset(offset);
  }, [activeTab, tabs.length]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const deltaX = touchCurrentRef.current - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(deltaX) / deltaTime;

    // Determine if swipe was significant enough
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.2; // 20% of container width
    const velocityThreshold = 0.3; // pixels per ms

    let newTab = activeTab;

    if (Math.abs(deltaX) > threshold || velocity > velocityThreshold) {
      if (deltaX < 0 && activeTab < tabs.length - 1) {
        // Swipe left -> next tab
        newTab = activeTab + 1;
      } else if (deltaX > 0 && activeTab > 0) {
        // Swipe right -> previous tab
        newTab = activeTab - 1;
      }
    }

    setActiveTab(newTab);
    touchStartRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, [activeTab, tabs.length, setActiveTab]);

  // Calculate transform for content
  // The sliding row is tabs.length * 100% wide, so each pane is (100/tabs.length)% of the row.
  // translateX percentages are relative to the element's own width, so we divide by tabs.length.
  const getContentTransform = () => {
    const stepPercent = 100 / tabs.length;
    const baseOffset = -activeTab * stepPercent;
    if (isDragging && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const dragPercent = (dragOffset / containerWidth) * stepPercent;
      return `translateX(calc(${baseOffset}% + ${dragPercent}%))`;
    }
    return `translateX(${baseOffset}%)`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab headers */}
      <div className="shrink-0 flex items-center justify-center gap-6 px-4 py-3 border-b border-neutral-800 bg-[#0a0a0a]">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(index)}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === index
                ? "text-white"
                : "text-neutral-500 hover:text-neutral-400"
            }`}
          >
            <span className="text-sm font-medium">{tab.label}</span>
            {/* Active indicator */}
            {activeTab === index && (
              <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-0.5 ${tabIndicatorColor} rounded-full`} />
            )}
          </button>
        ))}
      </div>

      {/* Tab indicator dots */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-2 bg-[#0a0a0a]">
        {tabs.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              activeTab === index
                ? `${tabIndicatorColor} scale-100`
                : "bg-neutral-700 scale-75 hover:scale-90"
            }`}
          />
        ))}
      </div>

      {/* Swipeable content area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute top-0 bottom-0 left-0 flex"
          style={{
            transform: getContentTransform(),
            transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            width: `${tabs.length * 100}%`,
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="h-full overflow-hidden"
              style={{ width: `${100 / tabs.length}%` }}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
