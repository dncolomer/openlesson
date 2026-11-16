"use client";

import {
  dataStudioSpaceLabel,
  formatStudioHighDimDistance,
  STUDIO_IN_REGION_FILL,
  type DataStudioInspectPayload,
  type StudioRegionDistanceRay,
} from "@/lib/data-studio-view";

export function DataStudioInspectFields({
  inspect,
  inspectDistanceRays = [],
}: {
  inspect: DataStudioInspectPayload;
  inspectDistanceRays?: readonly StudioRegionDistanceRay[];
}) {
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-neutral-500">identity</dt>
        <dd className="text-white" data-data-studio-inspect-identity>
          {inspect.identity || "—"}
        </dd>
        <dt className="text-neutral-500">origin</dt>
        <dd data-data-studio-inspect-origin={inspect.origin}>
          {inspect.origin === "simulated" ? (
            <span data-data-studio-simulated="">Simulated</span>
          ) : (
            "Real human"
          )}
        </dd>
        <dt className="text-neutral-500">flow_id</dt>
        <dd className="break-all">{inspect.flow_id || "—"}</dd>
        <dt className="text-neutral-500">run_id</dt>
        <dd className="break-all">{inspect.run_id || "—"}</dd>
        <dt className="text-neutral-500">flow_kind</dt>
        <dd>{inspect.flow_kind || "—"}</dd>
        <dt className="text-neutral-500">workspace</dt>
        <dd>{inspect.workspace_title || inspect.workspace_id || "—"}</dd>
        <dt className="text-neutral-500">space</dt>
        <dd data-data-studio-inspect-space>{dataStudioSpaceLabel(inspect.space)}</dd>
        <dt className="text-neutral-500">model</dt>
        <dd className="break-all">{inspect.embedding_model_id}</dd>
      </dl>

      {inspectDistanceRays.length > 0 ? (
        <section className="mt-4" data-data-studio-inspect-distances>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
            ‖x−c‖ embedding L2
          </p>
          <ul className="space-y-1">
            {inspectDistanceRays.map((ray) => (
              <li
                key={ray.regionId}
                className="flex justify-between gap-2 text-white"
                data-data-studio-inspect-distance={ray.regionId}
                data-data-studio-inspect-in-region={ray.inRegion ? "true" : "false"}
              >
                <span className="truncate text-neutral-300">{ray.regionName}</span>
                <span className="font-mono">
                  {formatStudioHighDimDistance(ray.highDimL2)}
                  <span
                    className="ml-2"
                    style={{
                      color: ray.inRegion ? STUDIO_IN_REGION_FILL : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {ray.inRegion ? "in" : "out"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4" data-data-studio-speech>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
          Voice transcripts
        </p>
        {inspect.speech.length > 0 ? (
          <ul className="space-y-2" data-data-studio-transcripts>
            {inspect.speech.map((line) => (
              <li
                key={line.slice(0, 64)}
                className="whitespace-pre-wrap border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12px] leading-relaxed text-white"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">
            No spoken lines on this run. Out-loud speech is stored on speech-segment
            stops as transcript_snapshot, and as a session transcript file.
          </p>
        )}
      </section>

      {inspect.thoughts.length > 0 ? (
        <section className="mt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Thought traces
          </p>
          <ul className="space-y-2">
            {inspect.thoughts.map((line) => (
              <li
                key={line.slice(0, 64)}
                className="whitespace-pre-wrap border border-white/10 px-2 py-1.5 text-neutral-200"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="mt-4" open>
        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
          Proof of work ({inspect.pow.length})
        </summary>
        <ol className="mt-2 space-y-2" data-data-studio-pow>
          {inspect.pow.map((row, index) => (
            <li
              key={`${row.tool_name || "pow"}-${row.timestamp_ms || index}`}
              className="border border-white/10 px-2 py-1.5"
            >
              <p className="text-white">
                {row.tool_name || "tool"}
                {row.tool_action ? ` · ${row.tool_action}` : ""}
              </p>
              {row.timestamp_ms ? (
                <p className="text-[10px] text-neutral-500">{row.timestamp_ms}</p>
              ) : null}
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-400">
                {JSON.stringify(
                  {
                    type: row.type,
                    payload: row.payload,
                    metadata: row.metadata,
                  },
                  null,
                  2,
                )}
              </pre>
            </li>
          ))}
        </ol>
      </details>

      <details className="mt-4">
        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
          Vector · {dataStudioSpaceLabel(inspect.space)} ({inspect.vector.length})
        </summary>
        <pre className="mt-1 overflow-x-auto text-[10px] text-neutral-400" data-data-studio-vector>
          {JSON.stringify(inspect.vector)}
        </pre>
      </details>

      <details className="mt-4">
        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
          Raw embedding
        </summary>
        <pre
          className="mt-1 max-h-[28rem] overflow-auto text-[10px] text-neutral-400"
          data-data-studio-raw
        >
          {JSON.stringify(inspect.raw, null, 2)}
        </pre>
      </details>
    </>
  );
}
