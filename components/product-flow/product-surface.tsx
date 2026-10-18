"use client";

import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";
import { DashboardAtmosphere } from "@/components/dashboard/dashboard-atmosphere";

export function ProductSurface({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      data-console-frame=""
      data-product-flow-surface=""
      className="relative min-h-screen border border-white/40 bg-black text-white"
    >
      <DashboardAtmosphere />
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div className="relative z-[2]">
        <Navbar productLinks={false} />
        <p data-console-frame-label="" className={`px-4 pt-2 sm:px-6 ${CONSOLE_LABEL_CLASS}`}>
          {label}
        </p>
        <main className="mx-auto w-full max-w-3xl overflow-x-hidden p-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
