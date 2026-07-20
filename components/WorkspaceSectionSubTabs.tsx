"use client";

/**
 * Shared sub-tab strip for Knowledge and Settings section panels.
 * Matches WorkspaceSectionNav bar tab height/size (py-2.5, text-sm, underline).
 * Horizontal scroll if needed, no extra chrome.
 */
export function WorkspaceSectionSubTabs<T extends string>({
  activeId,
  onChange,
  tabs,
  ariaLabel,
  dataAttr,
}: {
  activeId: T;
  onChange: (id: T) => void;
  tabs: Array<{ id: T; label: string }>;
  ariaLabel: string;
  /** Optional data attribute root for tests (e.g. "settings" → data-settings-tabs). */
  dataAttr?: "settings" | "knowledge";
}) {
  return (
    <div
      className="shrink-0 border-b border-neutral-800/60"
      {...(dataAttr === "settings"
        ? { "data-settings-tabs": true }
        : dataAttr === "knowledge"
          ? { "data-knowledge-tabs": true }
          : {})}
      data-section-subtabs={dataAttr ?? true}
    >
      <div
        className="flex min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={ariaLabel}
        {...(dataAttr === "settings" ? { "data-settings-tablist": true } : {})}
      >
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              {...(dataAttr === "settings"
                ? {
                    "data-settings-tab": tab.id,
                    "data-settings-tab-active": isActive ? "true" : "false",
                  }
                : dataAttr === "knowledge"
                  ? {
                      "data-knowledge-tab": tab.id,
                      "data-knowledge-tab-active": isActive ? "true" : "false",
                    }
                  : {})}
              onClick={() => onChange(tab.id)}
              className={`group relative flex min-w-0 shrink-0 items-center justify-center gap-2 px-3 py-2.5 transition-colors sm:px-5 ${
                isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <span className="truncate text-sm font-medium">{tab.label}</span>
              <span
                aria-hidden
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity sm:inset-x-4 ${
                  isActive ? "bg-white/80 opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
