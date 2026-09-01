"use client";

import { addExpandProgressFraction, type AddExpandJob } from "@/lib/add-block-range-density";
import { MINIMAP_FRAME_HEIGHT, MINIMAP_FRAME_WIDTH } from "@/lib/map-minimap-clusters";
import {
  ileGatherJobShowsFinishLink,
  ileGatherProgressFraction,
  ILE_GATHER_RESOURCES_TOOL,
  type IleGatherJob,
} from "@/lib/ile-gather-resources";
import { ileGatherJobTileId } from "@/lib/block-circular-menu";

type MapSaveJob = {
  id: string;
  status: "saving" | "saved" | "error" | string;
  label: string;
  error?: string | null;
};

export function MapJobIndicators({
  mapSaveJobs,
  clusterMapJob,
  expandJobs,
  onAbortExpandJob,
  gatherJobs,
  onOpenGatherResources,
  minimapStackHeight,
  mountMapNotes,
}: {
  mapSaveJobs: readonly MapSaveJob[];
  clusterMapJob?: {
    active: boolean;
    progress: number;
    label: string;
  } | null;
  expandJobs?: readonly AddExpandJob[] | null;
  onAbortExpandJob?: (jobId: string) => void;
  gatherJobs?: readonly IleGatherJob[] | null;
  onOpenGatherResources?: (opts?: { jobId?: string | null; tileId?: string | null }) => void;
  minimapStackHeight: number;
  mountMapNotes: boolean;
}) {
  const stackTop =
    8 +
    MINIMAP_FRAME_HEIGHT +
    8 +
    (minimapStackHeight > 0 ? minimapStackHeight + 8 : mountMapNotes ? 40 : 0);

  return (
    <>
      {mapSaveJobs.length > 0 ? (
        <div
          data-map-geometry-saves
          data-map-geometry-save-count={mapSaveJobs.length}
          className="pointer-events-none absolute right-2 z-20 flex flex-col gap-1"
          style={{
            top: stackTop,
            width: MINIMAP_FRAME_WIDTH,
          }}
        >
          {mapSaveJobs.map((job) => (
            <div
              key={job.id}
              data-map-geometry-save={job.id}
              data-map-geometry-save-status={job.status}
              className="rounded-none border border-white/15 bg-neutral-950/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                {job.status === "saving" ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white/80"
                    data-map-geometry-save-pulse
                    aria-hidden
                  />
                ) : job.status === "saved" ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/90"
                    aria-hidden
                  />
                )}
                <p
                  className={`min-w-0 flex-1 truncate text-[10px] font-medium ${
                    job.status === "error"
                      ? "text-rose-200"
                      : job.status === "saved"
                        ? "text-emerald-100/90"
                        : "text-neutral-100"
                  }`}
                >
                  {job.label}
                </p>
              </div>
              {job.status === "saving" ? (
                <div
                  className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800"
                  data-map-geometry-save-bar
                >
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-white/70" />
                </div>
              ) : null}
              {job.error ? (
                <p className="mt-1 text-[10px] text-rose-300/90">{job.error}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {clusterMapJob?.active ? (
        <div
          data-map-cluster-job
          data-map-cluster-job-active="true"
          className="pointer-events-none absolute right-2 z-20 flex flex-col gap-1"
          style={{
            top: stackTop + (mapSaveJobs.length > 0 ? mapSaveJobs.length * 52 + 8 : 0),
            width: MINIMAP_FRAME_WIDTH,
          }}
        >
          <div
            className="rounded-none border border-white/15 bg-neutral-950/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            data-map-cluster-progress
          >
            <div className="mb-1 flex items-start justify-between gap-1.5">
              <p
                className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-100"
                data-map-cluster-progress-label
              >
                {clusterMapJob.label || "Clustering…"}
              </p>
              <span className="shrink-0 font-mono text-[10px] text-neutral-300">
                {Math.round(Math.max(0, Math.min(1, clusterMapJob.progress)) * 100)}%
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800"
              role="progressbar"
              aria-valuenow={Math.round(
                Math.max(0, Math.min(1, clusterMapJob.progress)) * 100,
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={clusterMapJob.label || "Clustering"}
              data-map-cluster-progress-bar
            >
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                data-map-cluster-progress-fill
                style={{
                  width: `${Math.round(Math.max(0, Math.min(1, clusterMapJob.progress)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {Array.isArray(expandJobs) && expandJobs.length > 0 ? (
        <div
          data-map-expand-jobs
          data-map-expand-job-count={expandJobs.length}
          className="pointer-events-auto absolute right-2 z-20 flex max-h-[min(40vh,16rem)] flex-col gap-1.5 overflow-y-auto"
          style={{
            top:
              stackTop +
              (mapSaveJobs.length > 0 ? mapSaveJobs.length * 52 + 8 : 0) +
              (clusterMapJob?.active ? 56 : 0),
            width: MINIMAP_FRAME_WIDTH,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {expandJobs.map((job) => {
            const fraction = addExpandProgressFraction({
              completed: job.completed,
              total: job.total,
            });
            const running = job.status === "running";
            return (
              <div
                key={job.id}
                data-map-expand-job={job.id}
                data-map-expand-job-status={job.status}
                data-map-expand-progress-completed={job.completed}
                data-map-expand-progress-total={job.total}
                className="rounded-none border border-white/15 bg-neutral-950/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              >
                <div className="mb-1 flex items-start justify-between gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-100">
                    {job.label?.trim()
                      ? job.label
                      : running
                        ? "Creating blocks…"
                        : job.status === "stopped"
                          ? "Stopped"
                          : job.status === "error"
                            ? "Failed"
                            : "Done"}
                  </p>
                  <span
                    className="shrink-0 font-mono text-[10px] text-neutral-300"
                    data-map-expand-progress-label
                  >
                    {job.completed}/{job.total}
                  </span>
                </div>
                <div
                  className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800"
                  role="progressbar"
                  aria-valuenow={job.completed}
                  aria-valuemin={0}
                  aria-valuemax={job.total}
                  aria-label={`Creating blocks ${job.completed} of ${job.total}`}
                  data-map-expand-progress-bar
                >
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                    data-map-expand-progress-fill
                    style={{ width: `${Math.round(fraction * 100)}%` }}
                  />
                </div>
                {running ? (
                  <button
                    type="button"
                    data-map-expand-stop
                    data-map-expand-stop-job={job.id}
                    onClick={() => onAbortExpandJob?.(job.id)}
                    className="w-full rounded-none border border-white/50 bg-white px-2 py-1 text-[10px] font-medium text-black transition hover:bg-neutral-100"
                  >
                    Stop
                  </button>
                ) : job.error ? (
                  <p className="text-[10px] text-red-300/90" data-map-expand-job-error>
                    {job.error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {Array.isArray(gatherJobs) && gatherJobs.length > 0 ? (
        <div
          data-ile-gather-jobs
          data-ile-gather-job-count={gatherJobs.length}
          className="pointer-events-auto absolute right-2 z-20 flex max-h-[min(40vh,16rem)] flex-col gap-1.5 overflow-y-auto"
          style={{
            top:
              stackTop +
              (mapSaveJobs.length > 0 ? mapSaveJobs.length * 52 + 8 : 0) +
              (clusterMapJob?.active ? 56 : 0) +
              (Array.isArray(expandJobs) && expandJobs.length > 0
                ? expandJobs.length * 72 + 8
                : 0),
            width: MINIMAP_FRAME_WIDTH,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {gatherJobs.map((job) => {
            const fraction = ileGatherProgressFraction(job);
            const running = job.status === "running";
            const finish = ileGatherJobShowsFinishLink(job);
            return (
              <div
                key={job.id}
                data-ile-gather-progress
                data-ile-gather-job={job.id}
                data-ile-gather-job-status={job.status}
                className="rounded-none border border-white/15 bg-neutral-950/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              >
                <div className="mb-1 flex items-start justify-between gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-100">
                    {job.label}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-300">
                    {job.completed}/{job.total}
                  </span>
                </div>
                <div
                  className="mb-1.5 h-1.5 w-full overflow-hidden rounded-none bg-neutral-800"
                  role="progressbar"
                  aria-valuenow={job.completed}
                  aria-valuemin={0}
                  aria-valuemax={job.total}
                  aria-label={job.label}
                  data-ile-gather-progress-bar
                >
                  <div
                    className="h-full rounded-none bg-white transition-[width] duration-300 ease-out"
                    data-ile-gather-progress-fill
                    style={{ width: `${Math.round(fraction * 100)}%` }}
                  />
                </div>
                {finish ? (
                  <button
                    type="button"
                    data-ile-gather-open-resources
                    data-ile-gather-open-tool={ILE_GATHER_RESOURCES_TOOL}
                    onClick={() =>
                      onOpenGatherResources?.({
                        jobId: job.id,
                        tileId: ileGatherJobTileId(job),
                      })
                    }
                    className="w-full rounded-none border border-white/50 bg-white px-2 py-1 text-[10px] font-medium text-black transition hover:bg-neutral-100"
                  >
                    Open resources
                  </button>
                ) : running ? null : job.error ? (
                  <p className="text-[10px] text-red-300/90">{job.error}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
