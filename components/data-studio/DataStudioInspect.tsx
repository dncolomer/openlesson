"use client";

import { useMemo, useState } from "react";
import {
  storedRecordStreamLabel,
  type StoredRecordFile,
  type StoredRecordView,
} from "@/lib/behavior-record";
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

      <StoredRecordExplorer record={inspect.record ?? null} />

      <details className="mt-4">
        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
          Proof of work index ({inspect.pow.length})
        </summary>
        <ol className="mt-2 space-y-2" data-data-studio-pow>
          {inspect.pow.map((row, index) => (
            <li
              key={`${row.tool_name || "pow"}-${row.timestamp_ms || index}-${row.xai_file_id || ""}`}
              className="border border-white/10 px-2 py-1.5"
            >
              <p className="text-white">
                {row.type || "tool"}
                {row.tool_name ? ` · ${row.tool_name}` : ""}
                {row.tool_action ? ` · ${row.tool_action}` : ""}
              </p>
              {row.timestamp_ms ? (
                <p className="text-[10px] text-neutral-500">{row.timestamp_ms}</p>
              ) : null}
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-400">
                {JSON.stringify(
                  {
                    file: row.payload,
                    xai_file_id: row.xai_file_id,
                    mime_type: row.mime_type,
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

function StoredRecordExplorer({ record }: { record: StoredRecordView | null }) {
  const [stream, setStream] = useState<string>("all");
  const streams = record?.streams ?? [];
  const files = record?.files ?? [];
  const active = useMemo(() => {
    if (stream !== "all") {
      return streams.find((row) => row.stream === stream)?.samples ?? [];
    }
    return streams
      .flatMap((row) => row.samples)
      .slice()
      .sort((a, b) => a.t - b.t || a.seq - b.seq);
  }, [stream, streams]);
  const screens = files.filter((file) => file.kind === "screen" && file.href);

  return (
    <section className="mt-4" data-stored-record="">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
        Stored capture
      </p>
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-400">
        Index rows live on <span className="text-neutral-300">proof_of_work</span>.
        JSONL and JSON bytes live on xAI Files via <span className="text-neutral-300">xai_file_id</span>.
        Person microphone and webcam bytes are never stored.
      </p>
      {!record || (files.length === 0 && streams.length === 0) ? (
        <p className="text-neutral-500" data-stored-record-empty="">
          No capture files on this run yet. Behavior chunks upload during a live
          session; the Path vector stays on session_embeddings.
        </p>
      ) : (
        <>
          {streams.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1" data-stored-record-streams="">
              <StreamChip
                id="all"
                label={`all (${record.shown_count})`}
                active={stream === "all"}
                onClick={() => setStream("all")}
              />
              {streams.map((row) => (
                <StreamChip
                  key={row.stream}
                  id={row.stream}
                  label={`${storedRecordStreamLabel(row.stream)} (${row.count})`}
                  active={stream === row.stream}
                  onClick={() => setStream(row.stream)}
                />
              ))}
            </div>
          ) : null}
          {record.truncated ? (
            <p className="mb-2 text-[11px] text-neutral-500">
              Showing {record.shown_count} of {record.sample_count} samples.
            </p>
          ) : null}
          {active.length > 0 ? (
            <ol className="mb-3 max-h-80 space-y-1 overflow-auto" data-stored-record-samples="">
              {active.map((sample, index) => (
                <li
                  key={`${sample.stream}-${sample.seq}-${sample.t}-${index}`}
                  className="border border-white/10 px-2 py-1.5"
                  data-stored-record-sample={sample.stream}
                >
                  <p className="text-[11px] text-neutral-400">
                    <span className="text-white">{storedRecordStreamLabel(sample.stream)}</span>
                    <span className="ml-2 font-mono">{sample.t}</span>
                    {sample.hid ? <span className="ml-2 font-mono">hid {sample.hid}</span> : null}
                    <span className="ml-2 font-mono">#{sample.seq}</span>
                  </p>
                  {Object.keys(sample.body).length > 0 ? (
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-400">
                      {JSON.stringify(sample.body)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          {screens.length > 0 ? (
            <div className="mb-3 grid grid-cols-2 gap-2" data-stored-record-screens="">
              {screens.map((file) => (
                <StoredRecordScreen key={file.xai_file_id || file.file_name || ""} file={file} />
              ))}
            </div>
          ) : null}
          {record.rollup ? (
            <details className="mb-3" data-stored-record-rollup="">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
                Session rollup
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto text-[10px] text-neutral-400">
                {JSON.stringify(record.rollup, null, 2)}
              </pre>
            </details>
          ) : null}
          <details data-stored-record-files="">
            <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
              Files ({files.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {files.map((file, index) => (
                <li
                  key={`${file.xai_file_id || file.file_name || "file"}-${index}`}
                  className="flex items-baseline justify-between gap-2 text-[12px]"
                  data-stored-record-file={file.kind}
                >
                  <span className="min-w-0 truncate text-neutral-300">
                    {file.kind}
                    {file.tool_name ? ` · ${file.tool_name}` : ""}
                    {file.tool_action ? ` · ${file.tool_action}` : ""}
                    {file.file_name ? ` · ${file.file_name}` : ""}
                  </span>
                  {file.href ? (
                    <a
                      href={file.href}
                      className="shrink-0 text-[11px] text-neutral-400 underline decoration-white/20 hover:text-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  ) : (
                    <span className="shrink-0 text-[11px] text-neutral-600">
                      {file.hydrated ? "in memory" : "index"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function StreamChip({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-stored-record-stream={id}
      aria-pressed={active}
      onClick={onClick}
      className={`border px-2 py-0.5 text-[11px] ${
        active ? "border-white text-white" : "border-white/20 text-neutral-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function StoredRecordScreen({ file }: { file: StoredRecordFile }) {
  if (!file.href) return null;
  return (
    <a
      href={file.href}
      target="_blank"
      rel="noreferrer"
      className="block border border-white/10 bg-white/[0.03]"
      data-stored-record-screen=""
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.href} alt={file.file_name || "screen still"} className="max-h-40 w-full object-contain" />
    </a>
  );
}
