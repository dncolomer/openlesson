"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLabelClass } from "@/components/admin/styles";

const NAV_ITEMS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/sessions", label: "Sessions" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b border-neutral-800/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 sm:flex-row sm:items-end sm:justify-between lg:px-8">
          <div>
            <p className={`mb-2 ${adminLabelClass}`}>Internal</p>
            <h1 className="text-2xl font-medium tracking-[-0.5px] text-white sm:text-3xl">
              Admin
            </h1>
            <p className="mt-1 max-w-xl text-sm text-neutral-400">
              Platform operations — users, orgs, workspaces, and live activity.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
