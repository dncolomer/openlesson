"use client";

import Link from "next/link";
import {
  DASHBOARD_NAV_GROUPS,
  isDashboardNavTabItem,
  isDashboardProductTab,
  type DashboardTab,
} from "@/lib/dashboard-nav";

const itemClass =
  "block w-full whitespace-nowrap rounded-none px-2 py-2 text-left text-sm transition";
const idleClass = "border border-transparent text-neutral-400 hover:border-white/25 hover:text-white";
const activeClass = "border border-white/55 bg-white/10 text-white";

export function DashboardSidebar({
  activeTab,
  onSelect,
}: {
  activeTab: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
}) {
  return (
    <aside
      className="flex h-full w-full shrink-0 flex-col border-b border-white/40 bg-black/55 backdrop-blur-[2px] md:col-start-1 md:row-span-2 md:row-start-1 md:border-b-0 md:border-r"
      data-dashboard-sidebar
    >
      {DASHBOARD_NAV_GROUPS.map((group) => (
        <nav
          key={group.id}
          className="border-b border-white/20 px-3 py-4 last:border-b-0"
          data-dashboard-nav-group={group.id}
          aria-label={group.label}
        >
          <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {group.label}
          </p>
          <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {group.items.map((item) => {
              if (item.href) {
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-dashboard-nav={item.id}
                      data-dashboard-nav-link=""
                      className={`${itemClass} ${idleClass}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }
              if (!isDashboardNavTabItem(item)) return null;
              const active = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-dashboard-nav={item.id}
                    data-dashboard-nav-active={active ? "true" : "false"}
                    data-workspace-type-filter={
                      isDashboardProductTab(item.id) ? item.id : undefined
                    }
                    onClick={() => onSelect(item.id)}
                    className={`${itemClass} ${active ? activeClass : idleClass}`}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ))}
    </aside>
  );
}
