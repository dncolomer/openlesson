"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CustomVerificationModelsPanel } from "@/components/CustomVerificationModelsPanel";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { DASHBOARD_KNOWLEDGE_REGIONS_PATH } from "@/lib/dashboard-knowledge-regions";
import { productFlowNewPath, type ProductFlowKind } from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";

export function KnowledgeRegionPage({
  kind,
  regionId,
}: {
  kind: ProductFlowKind;
  regionId: string;
}) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const productLabel = kind === "calibration" ? "Calibration" : "Verification";

  useEffect(() => {
    let cancelled = false;
    fetch(`${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/${encodeURIComponent(regionId)}?kind=${kind}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load knowledge region"));
        }
        if (cancelled) return;
        setWorkspaceId(String(payload.workspaceId || payload.region?.workspaceId || ""));
        setName(String(payload.region?.name || "Knowledge region"));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load knowledge region");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, regionId]);

  return (
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6" data-knowledge-region-page={kind}>
        <Link href={`/dashboard?tab=${kind}_regions`} className="text-xs text-neutral-400 underline">
          Back to knowledge regions
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-medium tracking-[-1.2px] text-white">{name}</h1>
          <Link
            href={productFlowNewPath(kind)}
            data-create-flow-first=""
            className="text-xs text-neutral-300 underline"
          >
            Create a Flow
          </Link>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {workspaceId ? (
          <>
            <CustomVerificationModelsPanel
              workspaceId={workspaceId}
              currentUserId={null}
              verificationWorkspace
              knowledgeFlowKind={kind === "calibration" ? "calibrate" : "verify"}
            />
            <div data-knowledge-overlay="">
              <WorkspacePerformancePanel
                workspaceId={workspaceId}
                isOwner
                currentUserId={null}
                workspaceKind={kind === "calibration" ? "calibration" : "knowledge_region"}
              />
            </div>
          </>
        ) : null}
      </div>
    </ProductSurface>
  );
}
