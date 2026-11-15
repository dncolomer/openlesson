"use client";

import { useRef, useState } from "react";
import {
  FLOW_ARTIFACT_ACCEPT,
  FLOW_ARTIFACT_MAX_COUNT,
  uploadFlowArtifact,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FlowField,
} from "@/components/product-flow/product-flow-form";

export function FlowProblemFields({
  problem,
  onProblemChange,
  artifacts,
  onArtifactsChange,
  workspaceId,
  topicHook,
  exactProblemOnCanvas = false,
  onExactProblemOnCanvasChange,
  problemReadOnly = false,
}: {
  problem: string;
  onProblemChange: (value: string) => void;
  artifacts: FlowArtifact[];
  onArtifactsChange: (next: FlowArtifact[]) => void;
  workspaceId?: string | null;
  /** Extra data attribute on the Problem textarea (kind-specific tests). */
  topicHook?: string;
  exactProblemOnCanvas?: boolean;
  onExactProblemOnCanvasChange?: (value: boolean) => void;
  /** Published flows keep the Problem as written. */
  problemReadOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    try {
      const next = artifacts.slice();
      for (const file of Array.from(list)) {
        if (next.length >= FLOW_ARTIFACT_MAX_COUNT) break;
        next.push(await uploadFlowArtifact({ file, workspaceId }));
      }
      onArtifactsChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5" data-flow-problem-fields="">
      <FlowField label="Problem">
        <textarea
          value={problem}
          onChange={(event) => {
            if (problemReadOnly) return;
            onProblemChange(event.target.value);
          }}
          placeholder="Define the problem"
          rows={6}
          readOnly={problemReadOnly}
          data-flow-problem=""
          data-flow-problem-locked={problemReadOnly ? "" : undefined}
          data-solve-flow-topic={topicHook === "solve" ? "" : undefined}
          data-verification-flow-topic={topicHook === "verification" ? "" : undefined}
          data-calibration-flow-goal={topicHook === "calibration" ? "" : undefined}
          className={`${FLOW_FORM_TEXTAREA}${problemReadOnly ? " cursor-default text-neutral-300" : ""}`}
        />
        {problemReadOnly ? (
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            The problem cannot be changed after the flow is created.
          </p>
        ) : null}
      </FlowField>
      {topicHook !== "calibration" && onExactProblemOnCanvasChange ? (
        <label
          className="flex cursor-pointer items-start gap-3"
          data-flow-exact-problem-on-canvas=""
        >
          <input
            type="checkbox"
            checked={exactProblemOnCanvas}
            onChange={(event) => onExactProblemOnCanvasChange(event.target.checked)}
            data-flow-exact-problem-on-canvas-input=""
            className="mt-1 h-4 w-4 rounded-none border-white/40 bg-black accent-white"
          />
          <span className="space-y-1">
            <span className="block text-sm text-neutral-200">Exact problem on canvas</span>
            <span className="block text-xs leading-relaxed text-neutral-500">
              Open the Work canvas with this problem as written.
            </span>
          </span>
        </label>
      ) : null}
      <div className="space-y-3" data-flow-artifacts="">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Artifacts
        </p>
        {artifacts.map((item) => (
          <div
            key={item.xaiFileId}
            className="flex items-center justify-between gap-3 border border-white/20 px-3 py-2"
            data-flow-artifact=""
          >
            <p className="min-w-0 truncate text-sm text-neutral-200">{item.name}</p>
            <button
              type="button"
              className={FLOW_GHOST_BTN}
              onClick={() =>
                onArtifactsChange(artifacts.filter((row) => row.xaiFileId !== item.xaiFileId))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FLOW_ARTIFACT_ACCEPT}
          data-flow-artifact-file=""
          className="block w-full text-xs text-neutral-400 file:mr-3 file:border file:border-white/40 file:bg-black file:px-3 file:py-1.5 file:text-xs file:text-white"
          disabled={busy || artifacts.length >= FLOW_ARTIFACT_MAX_COUNT}
          onChange={(event) => void onFiles(event.target.files)}
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {busy ? <p className="text-xs text-neutral-500">Uploading…</p> : null}
      </div>
    </div>
  );
}
