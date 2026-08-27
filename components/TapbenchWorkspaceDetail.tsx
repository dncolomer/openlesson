import Link from "next/link";
import { TapbenchShell } from "@/components/TapbenchShell";
import type { TapbenchPublicRegion } from "@/lib/tapbench/region";
import {
  TAPBENCH_WORKSPACE_TOP_N,
  topTapbenchRegions,
} from "@/lib/tapbench/task-rows";

function formatDist(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(4);
}

function inRegionLabel(value: boolean | null | undefined): string {
  if (value == null) return "n/a";
  return value ? "in" : "out";
}

function whenLabel(iso: string | null | undefined): string {
  return iso?.slice(0, 19).replace("T", " ") || "n/a";
}

export const TAPBENCH_WORKSPACE_IMAGE = "/tapbench/experiment-region.jpg" as const;

export function TapbenchWorkspaceDetail(props: {
  name: string;
  description: string | null;
  regions: TapbenchPublicRegion[];
}) {
  const top = topTapbenchRegions(props.regions, TAPBENCH_WORKSPACE_TOP_N);

  return (
    <TapbenchShell>
      <div data-tapbench-workspace-page>
        <Link
          href="/tapbench"
          className="inline-flex rounded-sm border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-400 hover:text-white"
          data-tapbench-back
        >
          Back
        </Link>
        <header className="mt-4 w-full" data-tapbench-workspace-intro>
          <h1 className="text-3xl font-medium tracking-[-1.2px] text-white">{props.name}</h1>
          {props.description ? (
            <p
              className="mt-3 text-sm leading-relaxed text-zinc-400"
              data-tapbench-workspace-description
            >
              {props.description}
            </p>
          ) : null}
        </header>
        <img
          src={TAPBENCH_WORKSPACE_IMAGE}
          alt=""
          className="mt-8 aspect-[16/9] w-full object-cover"
          data-tapbench-workspace-image
        />
        <section className="mt-10" data-tapbench-workspace-results>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Top {TAPBENCH_WORKSPACE_TOP_N} results
          </h2>
          {top.length === 0 ? (
            <div
              className="mt-4 rounded-sm border border-zinc-800 bg-zinc-950/60 px-4 py-8 text-sm text-zinc-500"
              data-tapbench-workspace-results-empty
            >
              None
            </div>
          ) : (
            <div
              className="mt-4 overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950/70"
              data-tapbench-workspace-results-table
            >
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Region</th>
                    <th className="px-3 py-2">In region</th>
                    <th className="px-3 py-2">Center</th>
                    <th className="px-3 py-2">Border</th>
                    <th className="px-3 py-2">Snapshots</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((region, index) => (
                    <tr
                      key={region.id}
                      className="border-b border-zinc-800/80 last:border-0"
                      data-tapbench-workspace-result-row
                    >
                      <td className="px-3 py-2 font-mono text-zinc-500">{index + 1}</td>
                      <td className="px-3 py-2 text-zinc-200">{region.name}</td>
                      <td className="px-3 py-2">
                        {inRegionLabel(region.in_region)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatDist(region.distance_to_center)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatDist(region.distance_to_closest_border)}
                      </td>
                      <td className="px-3 py-2 font-mono">{region.subject_count}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                        {whenLabel(region.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
                Ranked by 64D L2 from the tapbench@uncertain.systems human pin.
              </p>
            </div>
          )}
        </section>
      </div>
    </TapbenchShell>
  );
}
