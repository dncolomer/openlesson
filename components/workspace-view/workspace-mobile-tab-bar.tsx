"use client";

import type { MobileColumn } from "@/components/workspace-view/types";

export function WorkspaceMobileTabBar({
  mobileColumn,
  onChange,
}: {
  mobileColumn: MobileColumn;
  onChange: (column: MobileColumn) => void;
}) {
  return (
    <div className="md:hidden flex-shrink-0 border-t border-neutral-800/70 bg-[#0b0b0b] px-3 py-2">
      <div className="grid grid-cols-3 gap-2 rounded-md border border-neutral-800 bg-neutral-950/70 p-1">
        {[
          { key: "plan" as const, label: "Workspace", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          ) },
          { key: "sessions" as const, label: "Blocks", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75zm0 5.25h.008v.008H3.75V12zm0 5.25h.008v.008H3.75v-.008z" />
            </svg>
          ) },
          { key: "workspace" as const, label: "Tools", icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.72 5.72a2.25 2.25 0 01-3.182-3.182l5.72-5.72M12 3v4.5m0 9V21m9-9h-4.5m-9 0H3m15.364 6.364l-3.182-3.182M6.818 6.818L3.636 3.636m12.728 0l-3.182 3.182M6.818 17.182l-3.182 3.182" />
            </svg>
          ) },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-medium transition-colors ${
              mobileColumn === key
                ? "bg-neutral-700/80 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
