"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  isDashboardNavTabItem,
  isDashboardProductTab,
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
      {groups.map((group) => (
        <nav
          key={group.id}
          className="border-b border-white/20 px-2 py-2 last:border-b-0"
          data-dashboard-nav-group={group.id}
          aria-label={group.label}
        >
          <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
            {group.label}
          </p>
          <ul className="flex flex-row gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
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
            {group.id === "account" ? (
              <>
                <li>
                  <LanguageSwitcher variant="sidebar" />
                </li>
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
              </>
            ) : null}
          </ul>
        </nav>
      ))}
    </aside>
  );
}
