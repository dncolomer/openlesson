"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import {
  DASHBOARD_KNOWLEDGE_REGIONS_PATH,
  dashboardKnowledgeRegionHref,
  type DashboardKnowledgeRegion,
  type DashboardKnowledgeRegionKind,
} from "@/lib/dashboard-knowledge-regions";
import {
  dashboardProductLabel,
  dashboardRegionCreateHref,
} from "@/lib/dashboard-nav";
import { productFlowNewPath } from "@/lib/product-flow";
import type { Workspace } from "@/lib/storage";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

export function DashboardKnowledgeRegionsTab({
  kind,
  workspaces,
  workspaceCoverPool,
  formatDate,
}: {
  kind: DashboardKnowledgeRegionKind;
  workspaces: Workspace[];
  workspaceCoverPool?: readonly string[] | null;
  formatDate: (value: string) => string;
}) {
  const [regions, setRegions] = useState<DashboardKnowledgeRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const productLabel = dashboardProductLabel(kind);
  const createHref = dashboardRegionCreateHref(kind);
  const createFlowHref = productFlowNewPath(kind);
  const workspaceById = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const workspace of workspaces) map.set(workspace.id, workspace);
    return map;
  }, [workspaces]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${DASHBOARD_KNOWLEDGE_REGIONS_PATH}?kind=${kind}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load knowledge regions"));
        }
        const next = Array.isArray(payload.regions) ? payload.regions : [];
        if (!cancelled) setRegions(next as DashboardKnowledgeRegion[]);
      })
      .catch((err) => {
        if (!cancelled) {
          setRegions([]);
          setError(err instanceof Error ? err.message : "Could not load knowledge regions");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div className="space-y-6" data-dashboard-knowledge-regions={kind}>
      <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              {productLabel}
            </p>
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
              Knowledge regions
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
              Overlay regions from your {productLabel.toLowerCase()} flows.
            </p>
          </div>
          <Link
            href={createHref}
            className="inline-flex h-12 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black"
          >
            Create knowledge region →
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Loading
        </p>
      ) : regions.length === 0 ? (
        <section className="console-copy px-6 py-14 sm:px-10 sm:py-16">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <h3 className="text-2xl font-medium tracking-[-0.8px] text-white">
              No knowledge regions yet
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Select existing flows or create a flow first, then publish a region.
            </p>
            <Link
              href={createHref}
              className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-none bg-white px-8 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Create knowledge region →
            </Link>
            <Link
              href={createFlowHref}
              data-create-flow-first=""
              className="mt-3 text-sm text-neutral-400 underline"
            >
              Create a Flow
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2" data-dashboard-knowledge-region-grid>
          {regions.map((region) => {
            const workspace = workspaceById.get(region.workspaceId);
            return (
              <Link
                key={region.id}
                href={dashboardKnowledgeRegionHref(kind, region.id)}
                className="console-copy group block overflow-hidden transition hover:border-white/80"
                data-dashboard-knowledge-region
              >
                <WorkspaceCardHero
                  workspaceId={region.workspaceId}
                  coverImageUrl={workspace?.cover_image_url}
                  imagePool={workspaceCoverPool}
                  fallback="aesthetic"
                  heightClassName="h-40 sm:h-44"
                  badges={
                    <span className="console-chip px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300">
                      {productLabel}
                    </span>
                  }
                />
                <div className="p-5">
                  <h3 className="line-clamp-2 text-lg font-medium text-white">{region.name}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{region.workspaceTitle}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {region.subjectCount} subjects
                    {region.createdAt ? ` · ${formatDate(region.createdAt)}` : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
