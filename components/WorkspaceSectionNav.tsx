"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";

export type WorkspaceSectionNavItem = {
  key: WorkspaceSectionKey;
  label: string;
  icon: ReactNode;
};

interface WorkspaceSectionNavProps {
  sections: WorkspaceSectionNavItem[];
  activeSection: WorkspaceSectionKey;
  onChange: (key: WorkspaceSectionKey) => void;
  variant?: "bar" | "pills";
  /** Workspace name shown on the right of the section tabs. */
  workspaceTitle?: string | null;
}

export function WorkspaceSectionNav({
  sections,
  activeSection,
  onChange,
  variant = "bar",
  workspaceTitle,
}: WorkspaceSectionNavProps) {
  const { t } = useI18n();
  const navLabel = t("planView.topLevelSectionsNav");
  const title = workspaceTitle?.trim() || "";

  if (variant === "pills") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <nav
          className="flex min-w-0 flex-1 gap-1 rounded-lg border border-neutral-800/60 bg-neutral-950/80 p-0.5"
          role="tablist"
          aria-label={navLabel}
        >
          {sections.map(({ key, label, icon }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(key)}
                title={label}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-800/90 text-white"
                    : "text-neutral-500 hover:bg-neutral-900/60 hover:text-neutral-300"
                }`}
              >
                <span className={isActive ? "text-neutral-200" : "text-neutral-500"}>{icon}</span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
        {title ? (
          <p
            className="max-w-[40%] shrink-0 truncate text-right text-xs font-medium text-neutral-300"
            title={title}
            data-workspace-section-title
          >
            {title}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center border-b border-neutral-800/60 bg-[#0b0b0b]"
      data-workspace-section-nav
    >
      <nav
        className="flex min-w-0 flex-1 overflow-x-auto"
        role="tablist"
        aria-label={navLabel}
      >
        {sections.map(({ key, label, icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(key)}
              title={label}
              className={`group relative flex min-w-0 shrink-0 items-center justify-center gap-2 px-3 py-2.5 transition-colors sm:px-5 ${
                isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <span
                className={`transition-colors ${
                  isActive ? "text-neutral-200" : "text-neutral-600 group-hover:text-neutral-400"
                }`}
              >
                {icon}
              </span>
              <span className="truncate text-sm font-medium">{label}</span>
              <span
                aria-hidden
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity sm:inset-x-4 ${
                  isActive ? "bg-white/80 opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </nav>
      {title ? (
        <p
          className="min-w-0 max-w-[45%] shrink-0 truncate px-3 py-2.5 text-right text-sm font-medium text-neutral-200 sm:max-w-sm sm:px-5"
          title={title}
          data-workspace-section-title
        >
          {title}
        </p>
      ) : null}
    </div>
  );
}
