"use client";

import { DataStudioPanel } from "@/components/data-studio/DataStudioPanel";
import type { DataStudioProduct } from "@/lib/data-studio-view";

export function DashboardDataStudioTab({ product }: { product: DataStudioProduct }) {
  return (
    <div
      className="flex h-full min-h-[70vh] w-full flex-1 flex-col overflow-hidden md:min-h-0"
      data-dashboard-data-studio={product}
    >
      <DataStudioPanel product={product} />
    </div>
  );
}
