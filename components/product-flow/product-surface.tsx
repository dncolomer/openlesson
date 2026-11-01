"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardAtmosphere } from "@/components/dashboard/dashboard-atmosphere";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  dashboardHrefForTab,
  type DashboardTab,
} from "@/lib/dashboard-nav";

export function ProductSurface({
  label,
  activeTab,
  children,
}: {
  label: string;
  activeTab: DashboardTab;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      data-console-frame=""
      data-product-flow-surface=""
      className="relative min-h-screen border border-white/40 bg-black text-white md:h-dvh md:max-h-dvh md:overflow-hidden"
    >
      <DashboardAtmosphere />
      <div
        className="relative z-[2] grid min-h-screen grid-cols-1 md:h-full md:min-h-0 md:grid-cols-[16rem_minmax(0,1fr)]"
        data-dashboard-platform
      >
        <DashboardSidebar
          activeTab={activeTab}
          hasPaidAccess
          onSelect={(tab) => {
            router.push(dashboardHrefForTab(tab));
          }}
        />
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">
          <h1 className="sr-only">{label}</h1>
          <main className="overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
