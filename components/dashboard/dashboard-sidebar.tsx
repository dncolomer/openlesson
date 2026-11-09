"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import {
  clusterDashboardNavItems,
  dashboardNavGroupIdForTab,
  isDashboardNavTabItem,
  isDashboardProductTab,
  type DashboardNavGroupId,
  type DashboardNavItem,
  type DashboardTab,
} from "@/lib/dashboard-nav";
import { dashboardNavGroupsForAccess } from "@/lib/free-tier";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const itemClass =
  "block w-full whitespace-nowrap rounded-none px-2 py-1 text-left text-[13px] leading-tight transition";
const idleClass = "border border-transparent text-neutral-400 hover:border-white/25 hover:text-white";
const activeClass = "border border-white/55 bg-white/10 text-white";

export function DashboardSidebar({
  activeTab,
  onSelect,
  hasPaidAccess = true,
}: {
  activeTab: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
  hasPaidAccess?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const groups = dashboardNavGroupsForAccess(hasPaidAccess);
  const [openGroup, setOpenGroup] = useState<DashboardNavGroupId | null>(
    () => dashboardNavGroupIdForTab(activeTab),
  );

  useEffect(() => {
    setOpenGroup(dashboardNavGroupIdForTab(activeTab));
  }, [activeTab]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside
      className="console-panel-fill flex h-full w-full shrink-0 flex-col border-b border-white/40 md:sticky md:top-0 md:col-start-1 md:h-full md:max-h-full md:min-h-0 md:self-start md:overflow-y-auto md:border-b-0 md:border-r"
      data-dashboard-sidebar
    >
      <div className="border-b border-white/20 px-3.5 py-4" data-dashboard-sidebar-brand>
        <Link href="/" className="block min-w-0 transition hover:opacity-90">
          <BrandLogo
            size={28}
            name={t("nav.brandName")}
            className="w-full min-w-0 gap-3"
            nameClassName="min-w-0 text-base font-semibold leading-tight tracking-tight text-white"
          />
        </Link>
      </div>
      {groups.map((group) => {
        const open = openGroup === group.id;
        const containsActive = group.items.some((item) => item.id === activeTab);
        const clusters = clusterDashboardNavItems(group.items);
        return (
          <nav
            key={group.id}
            className="shrink-0 border-b border-white/20 px-2 py-2 last:border-b-0"
            data-dashboard-nav-group={group.id}
            data-dashboard-nav-group-open={open ? "true" : "false"}
            aria-label={group.label}
          >
            <button
              type="button"
              data-dashboard-nav-group-toggle={group.id}
              aria-expanded={open}
              onClick={() => setOpenGroup(open ? null : group.id)}
              className={`mb-1 flex w-full items-center justify-between px-2 py-1 text-left font-mono text-[9px] uppercase tracking-[0.16em] transition ${
                containsActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <span>{group.label}</span>
              <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            {open ? (
              <div className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-0">
                {clusters.map((cluster, index) => (
                  <ul
                    key={`${group.id}-${cluster[0]?.cluster ?? index}`}
                    data-dashboard-nav-cluster={cluster[0]?.cluster || undefined}
                    className={`flex flex-row gap-0.5 md:flex-col ${
                      index > 0
                        ? "border-l border-white/20 pl-2 md:border-l-0 md:border-t md:pl-0 md:pt-2"
                        : ""
                    }`}
                  >
                    {cluster.map((item) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        activeTab={activeTab}
                        onSelect={onSelect}
                      />
                    ))}
                    {group.id === "account" && index === clusters.length - 1 ? (
                      <li>
                        <button
                          type="button"
                          data-dashboard-sign-out
                          onClick={() => void handleSignOut()}
                          className={`${itemClass} ${idleClass}`}
                        >
                          {t("nav.signOut")}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ))}
              </div>
            ) : null}
          </nav>
        );
      })}
    </aside>
  );
}

function NavItem({
  item,
  activeTab,
  onSelect,
}: {
  item: DashboardNavItem;
  activeTab: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
}) {
  if (item.href) {
    return (
      <li>
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
    <li>
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
}
