"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD_KNOWLEDGE_REGIONS_PATH,
  dashboardKnowledgeRegionStudioHref,
  type DashboardKnowledgeRegion,
  type DashboardKnowledgeRegionKind,
} from "@/lib/dashboard-knowledge-regions";
import {
  dashboardProductLabel,
  dashboardRegionCreateHref,
} from "@/lib/dashboard-nav";
import { productFlowNewPath } from "@/lib/product-flow";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

export function DashboardKnowledgeRegionsTab({
  kind,
  formatDate,
}: {
  kind: DashboardKnowledgeRegionKind;
  formatDate: (value: string) => string;
}) {
  const [regions, setRegions] = useState<DashboardKnowledgeRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const productLabel = dashboardProductLabel(kind);
  const createHref = dashboardRegionCreateHref(kind);
  const createFlowHref = productFlowNewPath(kind);

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
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
              Knowledge regions
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
              Overlay regions from your {productLabel.toLowerCase()} flows. Open a region in Data
              Studio to see it against the runs.
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
        <div className="console-copy overflow-x-auto" data-dashboard-knowledge-region-table>
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/20 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Data Studio</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  className="border-b border-white/10 last:border-b-0"
                  data-dashboard-knowledge-region
                >
                  <td className="px-4 py-3 font-medium text-white">{region.name}</td>
                  <td className="px-4 py-3 text-neutral-400">{region.workspaceTitle}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-400">
                    {region.subjectCount}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {region.createdAt ? formatDate(region.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={dashboardKnowledgeRegionStudioHref(kind, region.id)}
                      className="inline-flex h-9 items-center justify-center border border-white/25 px-3 text-[11px] text-white transition hover:border-white hover:bg-white hover:text-black"
                      data-open-region-data-studio={region.id}
                    >
                      Open in Data Studio
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
