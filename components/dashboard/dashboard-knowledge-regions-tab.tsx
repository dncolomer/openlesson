"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD_KNOWLEDGE_REGIONS_PATH,
  dashboardKnowledgeRegionHref,
  type DashboardKnowledgeRegion,
} from "@/lib/dashboard-knowledge-regions";
import { dashboardRegionCreateHref } from "@/lib/dashboard-nav";
import {
  PRODUCT_FLOW_KINDS,
  parseProductFlowKindFilter,
  productFlowKindLabel,
  productFlowNewPath,
  type ProductFlowKindFilter,
} from "@/lib/product-flow";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

const TYPE_SELECT =
  "h-12 min-w-[12rem] border border-white/20 bg-black px-3 font-mono text-[11px] text-white outline-none focus:border-white/55";

export function DashboardKnowledgeRegionsTab({
  formatDate,
}: {
  formatDate: (value: string) => string;
}) {
  const [regions, setRegions] = useState<DashboardKnowledgeRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductFlowKindFilter>("all");
  const createHref = dashboardRegionCreateHref();
  const createFlowHref = productFlowNewPath();
  const visible = useMemo(
    () => (typeFilter === "all" ? regions : regions.filter((region) => region.kind === typeFilter)),
    [regions, typeFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(DASHBOARD_KNOWLEDGE_REGIONS_PATH)
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
  }, []);

  return (
    <div className="space-y-6" data-dashboard-knowledge-regions="">
      <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
              Knowledge regions
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
              Create a region by running a simulation of exploration strategies on your flows.
              Open details to inspect that region.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Type
              </span>
              <select
                className={TYPE_SELECT}
                value={typeFilter}
                data-dashboard-type-filter=""
                onChange={(event) =>
                  setTypeFilter(parseProductFlowKindFilter(event.target.value))
                }
              >
                <option value="all">All types</option>
                {PRODUCT_FLOW_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {productFlowKindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href={createHref}
              className="inline-flex h-12 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black"
            >
              Create knowledge region →
            </Link>
          </div>
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
              Name a region, pick a flow type, then run a simulation.
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
      ) : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No knowledge regions of this type.</p>
      ) : (
        <div className="console-copy overflow-x-auto" data-dashboard-knowledge-region-table>
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/20 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((region) => (
                <tr
                  key={region.id}
                  className="border-b border-white/10 last:border-b-0"
                  data-dashboard-knowledge-region
                  data-dashboard-region-kind={region.kind}
                >
                  <td className="px-4 py-3 font-medium text-white">{region.name}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {productFlowKindLabel(region.kind)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-400">
                    {region.subjectCount}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {region.createdAt ? formatDate(region.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={dashboardKnowledgeRegionHref(region.kind, region.id)}
                      className="inline-flex h-9 items-center justify-center border border-white/25 px-3 text-[11px] text-white transition hover:border-white hover:bg-white hover:text-black"
                      data-open-region-details={region.id}
                    >
                      Open details
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
