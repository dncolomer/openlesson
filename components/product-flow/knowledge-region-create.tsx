"use client";

import type { ProductFlowKind } from "@/lib/product-flow";
import { RegionSimulationSetup } from "@/components/product-flow/region-simulation-setup";

export function KnowledgeRegionCreate({ kind }: { kind: ProductFlowKind }) {
  return <RegionSimulationSetup kind={kind} />;
}
