"use client";

/**
 * Shared compact sub-tab strip for Knowledge and Settings section panels.
 * Underline tabs, horizontal scroll if needed, no extra chrome.
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
      className="shrink-0 border-b border-neutral-800/60 px-3 sm:px-4"
      {...(dataAttr === "settings"
        ? { "data-settings-tabs": true }
        : dataAttr === "knowledge"
          ? { "data-knowledge-tabs": true }
          : {})}
      data-section-subtabs={dataAttr ?? true}
    >
      <div
        className="-mb-px flex gap-0.5 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`flex shrink-0 items-center border-b-2 px-3 py-2 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              }`}
            >
              <span className="whitespace-nowrap text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
