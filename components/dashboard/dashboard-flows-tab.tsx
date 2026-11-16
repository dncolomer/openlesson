"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  paginateDashboardFlows,
  truncateDashboardFlowName,
  truncateDashboardFlowTopic,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";
import { dashboardCreateHref, dashboardCreateLabel } from "@/lib/dashboard-nav";
import {
  DASHBOARD_FLOWS_PATH,
  PRODUCT_FLOW_KINDS,
  parseProductFlowKindFilter,
  productFlowKindFromDashboardKind,
  productFlowKindLabel,
  type ProductFlowKindFilter,
} from "@/lib/product-flow";
import { FlowPublicActions } from "@/components/product-flow/copy-flow-url-button";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

const TYPE_SELECT =
  "h-12 min-w-[12rem] border border-white/20 bg-black px-3 font-mono text-[11px] text-white outline-none focus:border-white/55";

export function DashboardFlowsTab({
  formatDate,
}: {
  formatDate: (value: string) => string;
}) {
  const [flows, setFlows] = useState<DashboardRecentFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<ProductFlowKindFilter>("all");
  const createHref = dashboardCreateHref();
  const visible = useMemo(
    () =>
      typeFilter === "all"
        ? flows
        : flows.filter(
            (flow) => productFlowKindFromDashboardKind(flow.kind) === typeFilter,
          ),
    [flows, typeFilter],
  );
  const paged = useMemo(() => paginateDashboardFlows(visible, page), [page, visible]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(DASHBOARD_FLOWS_PATH)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load flows"));
        }
        if (!cancelled) setFlows(Array.isArray(payload.flows) ? payload.flows : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setFlows([]);
          setError(err instanceof Error ? err.message : "Could not load flows");
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
    <div className="space-y-6" data-dashboard-flows="">
      <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
              Flows
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
              Named Solve, Verification, and Calibration flows with public run links.
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
              data-dashboard-product-create
              className="inline-flex h-12 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              {dashboardCreateLabel()}
            </Link>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">Loading</p>
      ) : flows.length === 0 ? (
        <section data-dashboard-empty-product className="console-copy px-6 py-14 sm:px-10 sm:py-16">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <h3 className="text-2xl font-medium tracking-[-0.8px] text-white">No flows yet</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Pick a type, name a flow, author the problem, then Publish.
            </p>
            <Link
              href={createHref}
              data-dashboard-empty-create
              className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-none bg-white px-8 text-sm font-medium text-black"
            >
              {dashboardCreateLabel()}
            </Link>
          </div>
        </section>
      ) : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No flows of this type.</p>
      ) : (
        <div className="console-copy overflow-x-auto" data-dashboard-flow-table>
          <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[8.5rem]" />
              <col />
              <col className="w-[9.5rem]" />
              <col className="w-[11.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/20 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Run</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((flow) => (
                <tr
                  key={flow.id}
                  className="border-b border-white/10 last:border-b-0"
                  data-dashboard-flow
                  data-dashboard-flow-kind={productFlowKindFromDashboardKind(flow.kind)}
                >
                  <td className="min-w-0 px-4 py-3">
                    <Link
                      href={flow.flowPath}
                      className="block truncate font-medium text-white underline decoration-white/20 underline-offset-2 hover:decoration-white"
                      title={flow.name || undefined}
                      data-flow-name
                    >
                      {truncateDashboardFlowName(flow.name)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                    {productFlowKindLabel(productFlowKindFromDashboardKind(flow.kind))}
                  </td>
                  <td className="min-w-0 px-4 py-3 text-neutral-400">
                    <span
                      className="block truncate"
                      title={flow.topic || undefined}
                      data-dashboard-flow-topic=""
                    >
                      {truncateDashboardFlowTopic(flow.topic)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                    {flow.createdAt ? formatDate(flow.createdAt) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <FlowPublicActions url={flow.publicPath} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paged.totalPages > 1 ? (
            <div
              className="flex items-center justify-between border-t border-white/20 px-4 py-3"
              data-dashboard-flow-pagination
            >
              <p className="text-xs text-neutral-500">
                Showing {paged.start}–{paged.end} of {paged.total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-dashboard-flow-prev
                  disabled={paged.page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="console-button px-3 py-1 text-xs text-neutral-400 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  data-dashboard-flow-next
                  disabled={paged.page === paged.totalPages}
                  onClick={() => setPage((current) => Math.min(paged.totalPages, current + 1))}
                  className="console-button px-3 py-1 text-xs text-neutral-400 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
