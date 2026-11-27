"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import {
  dispatchOrganizationSwitched,
  rememberActiveOrganizationId,
} from "@/lib/organization/active-organization-client";
import {
  visibleOrganizationMemberships,
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
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [activeId, setActiveId] = useState("");
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

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
        if (active) rememberActiveOrganizationId(active);
      } catch {
        // Switcher stays hidden until memberships load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => visibleOrganizationMemberships(organizations, query, { activeId }),
    [organizations, query, activeId],
  );
  const activeOrg = organizations.find((org) => org.organizationId === activeId);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleChange(organizationId: string) {
    if (!organizationId || organizationId === activeId) {
      setOpen(false);
      setQuery("");
      return;
    }
    const previous = activeId;
    setActiveId(organizationId);
    setOpen(false);
    setQuery("");
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
      dispatchOrganizationSwitched(organizationId);
      router.refresh();
    } catch {
      setActiveId(previous);
    } finally {
      setSwitching(false);
    }
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(visible.items.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = visible.items[highlight];
      if (chosen) void handleChange(chosen.organizationId);
    }
  }

  if (organizations.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="mt-auto px-2 py-2"
      data-dashboard-org-switcher
    >
      <div className="mb-1 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
        {t("organization.orgSwitcher")}
      </div>
      {open ? (
        <div className="mb-1 max-h-48 overflow-y-auto border border-white/40 bg-black">
          {visible.items.map((org, index) => {
            const active = org.organizationId === activeId;
            const highlighted = index === highlight;
            return (
              <button
                key={org.organizationId}
                type="button"
                role="option"
                aria-selected={active}
                data-dashboard-org-switcher-option={org.organizationId}
                disabled={switching}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void handleChange(org.organizationId)}
                className={`block w-full truncate px-2 py-1 text-left text-[13px] leading-tight ${
                  highlighted
                    ? "bg-white/15 text-white"
                    : active
                      ? "text-white"
                      : "text-neutral-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {org.name}
              </button>
            );
          })}
          {visible.total === 0 ? (
            <p className="px-2 py-1 text-[12px] text-neutral-500">
              {t("organization.noOrganizationMatches")}
            </p>
          ) : null}
          {visible.truncated ? (
            <p className="px-2 py-1 font-mono text-[10px] text-neutral-500">
              {t("organization.organizationSwitcherMore", {
                remaining: visible.total - visible.items.length,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      {open ? (
        <input
          ref={searchRef}
          data-dashboard-org-switcher-select
          data-dashboard-org-switcher-search
          aria-label={t("organization.searchOrganizations")}
          aria-expanded="true"
          disabled={switching}
          value={query}
          placeholder={t("organization.searchOrganizations")}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
          className="w-full rounded-none border border-white/40 bg-black px-2 py-1 text-[13px] leading-tight text-white placeholder:text-neutral-500 focus:border-white/70 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <button
          type="button"
          data-dashboard-org-switcher-select
          aria-label={t("organization.orgSwitcher")}
          aria-expanded="false"
          disabled={switching}
          onClick={() => setOpen(true)}
          className="w-full truncate rounded-none border border-white/40 bg-black px-2 py-1 text-left text-[13px] leading-tight text-white focus:border-white/70 focus:outline-none disabled:opacity-50"
        >
          {activeOrg?.name || t("organization.orgSwitcher")}
        </button>
      )}
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
