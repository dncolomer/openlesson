"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

/** Workspace-local tabs (graph / notes / files) plus legacy keys still used by AYCL shell. */
export type WorkspaceLocalTabKey = "graph" | "notes" | "files";
export type WorkspaceTabKey = WorkspaceLocalTabKey | "performance" | "integration";

export type WorkspaceTabItem = {
  key: WorkspaceTabKey;
  label: string;
  icon: ReactNode;
};

interface WorkspaceTabBarProps {
  tabs: WorkspaceTabItem[];
  activeTab: WorkspaceTabKey;
  onChange: (key: WorkspaceTabKey) => void;
  variant?: "integrated" | "mobile";
}

export function WorkspaceTabBar({
  tabs,
  activeTab,
  onChange,
  variant = "integrated",
}: WorkspaceTabBarProps) {
  const { t } = useI18n();
  const navLabel = t("planView.workspaceSectionsNav");

  if (variant === "mobile") {
    return (
      <nav
        className={`grid gap-0.5 rounded-none border border-neutral-800/60 bg-neutral-950/80 p-0.5 ${
          tabs.length >= 5 ? "grid-cols-5" : "grid-cols-4"
        }`}
        role="tablist"
        aria-label={navLabel}
      >
        {tabs.map(({ key, label, icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              title={label}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-none px-1 py-2 transition-colors ${
                isActive
                  ? "bg-neutral-800/90 text-white"
                  : "text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-300"
              }`}
            >
              <span className={isActive ? "text-neutral-200" : "text-neutral-500"}>{icon}</span>
              <span className="w-full truncate text-center text-[10px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="flex border-t border-neutral-800/50"
      role="tablist"
      aria-label={navLabel}
    >
      {tabs.map(({ key, label, icon }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            title={label}
            className={`group relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 transition-colors sm:px-3 ${
              isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <span
              className={`transition-colors ${isActive ? "text-neutral-200" : "text-neutral-600 group-hover:text-neutral-400"}`}
            >
              {icon}
            </span>
            <span className="hidden truncate text-xs font-medium sm:inline">{label}</span>
            <span
              aria-hidden
              className={`absolute inset-x-2 bottom-0 h-px rounded-full transition-opacity sm:inset-x-4 ${
                isActive ? "bg-white/75 opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}