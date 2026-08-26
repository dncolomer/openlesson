"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { TapbenchTask } from "@/lib/tapbench/catalog";
import type { TapbenchPublicRegion } from "@/lib/tapbench/region";
import {
  tapbenchWorkspaceHref,
  tapbenchWorkspaceRows,
} from "@/lib/tapbench/task-rows";

export function formatTapbenchDist(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(4);
}

function inRegionLabel(value: boolean | null | undefined): string {
  if (value == null) return "n/a";
  return value ? "in" : "out";
}

export function TapbenchResultsTable(props: {
  tasks: TapbenchTask[];
  regions: TapbenchPublicRegion[];
  busyId?: string | null;
  empty: string;
  onIssueKey: (workspaceId: string) => void;
  onDownloadSkill: (workspaceId: string) => void;
}) {
  const router = useRouter();
  const rows = tapbenchWorkspaceRows(props.tasks, props.regions);

  if (rows.length === 0) {
    return (
      <div
        className="mt-4 rounded-sm border border-zinc-800 bg-zinc-950/60 px-4 py-8 text-sm text-zinc-500"
        data-tapbench-results-empty
      >
        {props.empty}
      </div>
    );
  }

  const openWorkspace = (workspaceId: string) => {
    router.push(tapbenchWorkspaceHref(workspaceId));
  };

  const stopRowNav = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="mt-4 overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950/70"
      data-tapbench-results-table
      data-tapbench-key-obtain
    >
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Best region</th>
            <th className="px-3 py-2">In region</th>
            <th className="px-3 py-2">Center</th>
            <th className="px-3 py-2">Border</th>
            <th className="px-3 py-2">Snapshots</th>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Skill</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, best }) => {
            const busy = props.busyId === task.id;
            return (
              <tr
                key={task.id}
                className="cursor-pointer border-b border-zinc-800/80 last:border-0 hover:bg-zinc-900/50"
                onClick={() => openWorkspace(task.id)}
                data-tapbench-task-row
              >
                <td className="px-3 py-2 text-zinc-200">{task.title}</td>
                <td className="px-3 py-2 text-zinc-300">{best?.name || "n/a"}</td>
                <td className="px-3 py-2">{inRegionLabel(best?.in_region)}</td>
                <td className="px-3 py-2 font-mono">
                  {formatTapbenchDist(best?.distance_to_center)}
                </td>
                <td className="px-3 py-2 font-mono">
                  {formatTapbenchDist(best?.distance_to_closest_border)}
                </td>
                <td className="px-3 py-2 font-mono">
                  {best ? best.subject_count : "n/a"}
                </td>
                <td className="px-3 py-2" onClick={stopRowNav}>
                  <button
                    type="button"
                    className="rounded-sm bg-white px-2 py-1 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40"
                    onClick={() => props.onIssueKey(task.id)}
                    disabled={busy}
                    data-tapbench-issue-key
                  >
                    TAPBench key
                  </button>
                </td>
                <td className="px-3 py-2" onClick={stopRowNav}>
                  <button
                    type="button"
                    className="rounded-sm border border-zinc-500 px-2 py-1 text-[11px] text-zinc-100 hover:border-zinc-300 disabled:opacity-40"
                    onClick={() => props.onDownloadSkill(task.id)}
                    disabled={busy}
                    data-tapbench-download-skill
                  >
                    skills.md
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p
        className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500"
        data-tapbench-owner-distance-note
      >
        Best result is the closest 64D L2 match to the tapbench@uncertain.systems latest snapshot.
      </p>
    </div>
  );
}
