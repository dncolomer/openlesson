"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ORGANIZATION_SWITCHED_EVENT,
  type OrganizationMembership,
} from "@/lib/organization/membership";
import {
  clusterDashboardNavItems,
  DASHBOARD_TOP_NAV_ITEMS,
  isDashboardNavTabItem,
  type DashboardNavItem,
  type DashboardTab,
} from "@/lib/dashboard-nav";
import { dashboardNavGroupsForAccess } from "@/lib/free-tier";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const itemClass =
  "block w-full whitespace-nowrap rounded-none px-2 py-1 text-left text-[13px] leading-tight transition";
const idleClass = "border border-transparent text-neutral-400 hover:border-white/25 hover:text-white";
const homeIdleClass = "border border-transparent text-white hover:border-white/25";
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
      {DASHBOARD_TOP_NAV_ITEMS.map((item) => {
        if (!isDashboardNavTabItem(item)) return null;
        const active = activeTab === item.id;
        const idle = item.id === "home" ? homeIdleClass : idleClass;
        return (
          <nav
            key={item.id}
            className="shrink-0 border-b border-white/20 px-2 py-2"
            aria-label={item.label}
            data-dashboard-nav-home={item.id === "home" ? "" : undefined}
          >
            <button
              type="button"
              data-dashboard-nav={item.id}
              data-dashboard-nav-active={active ? "true" : "false"}
              onClick={() => onSelect(item.id)}
              className={`${itemClass} ${active ? activeClass : idle}`}
            >
              {item.label}
            </button>
          </nav>
        );
      })}
      {groups.map((group) => {
        const clusters = clusterDashboardNavItems(group.items);
        return (
          <nav
            key={group.id}
            className="shrink-0 border-b border-white/20 px-2 py-2"
            data-dashboard-nav-group={group.id}
            aria-label={group.label}
          >
            <div className="mb-1 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
              {group.label}
            </div>
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
          </nav>
        );
      })}
      <OrgSwitcher />
    </aside>
  );
}

function OrgSwitcher() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [activeId, setActiveId] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/organization/memberships");
        if (!response.ok) return;
        const body = (await response.json()) as {
          organizations?: OrganizationMembership[];
          activeOrganizationId?: string | null;
        };
        if (cancelled) return;
        const next = Array.isArray(body.organizations) ? body.organizations : [];
        setOrganizations(next);
        const active =
          (typeof body.activeOrganizationId === "string" && body.activeOrganizationId) ||
          next.find((org) => org.isActive)?.organizationId ||
          next[0]?.organizationId ||
          "";
        setActiveId(active);
      } catch {
        // Switcher stays hidden until memberships load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(organizationId: string) {
    if (!organizationId || organizationId === activeId) return;
    const previous = activeId;
    setActiveId(organizationId);
    setSwitching(true);
    try {
      const response = await fetch("/api/organization/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        setActiveId(previous);
        return;
      }
      window.dispatchEvent(new Event(ORGANIZATION_SWITCHED_EVENT));
      router.refresh();
    } catch {
      setActiveId(previous);
    } finally {
      setSwitching(false);
    }
  }

  if (organizations.length === 0) return null;

  return (
    <div className="mt-auto px-2 py-2" data-dashboard-org-switcher>

      <div className="mb-1 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
        Organization
      </div>
      <select
        data-dashboard-org-switcher-select
        aria-label="Organization"
        disabled={switching}
        value={activeId}
        onChange={(event) => void handleChange(event.target.value)}
        className="w-full rounded-none border border-white/40 bg-black px-2 py-1 text-[13px] leading-tight text-white focus:border-white/70 focus:outline-none disabled:opacity-50"
      >
        {organizations.map((org) => (
          <option key={org.organizationId} value={org.organizationId}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
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
        onClick={() => onSelect(item.id)}
        className={`${itemClass} ${active ? activeClass : idleClass}`}
      >
        {item.label}
      </button>
    </li>
  );
}
