"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  FLOW_ARTIFACT_ACCEPT,
  FLOW_ARTIFACT_MAX_COUNT,
  uploadFlowArtifact,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  FLOW_FORM_LABEL,
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_SECONDARY_BTN,
} from "@/components/product-flow/product-flow-form";
import { FlowOpeningCanvasPreview } from "@/components/product-flow/flow-opening-canvas-preview";
import {
  FLOW_OPENING_CANVAS_LABEL,
  flowOpeningCanvasHasContent,
} from "@/lib/flow-opening-canvas";
import {
  flowAuthoringSource,
  PROTOCOL_CHALLENGE_LABEL,
  type FlowAuthoringSource,
} from "@/lib/product-flow";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";

function AuthorSection({
  label,
  hook,
  split,
  children,
}: {
  label: string;
  hook?: string;
  split?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="space-y-3"
      {...(split && hook ? { "data-flow-author-panel": hook } : {})}
    >
      {label ? <p className={FLOW_FORM_LABEL}>{label}</p> : null}
      {children}
    </section>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  hint,
  hook,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  hint?: string;
  hook?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 border px-3 py-2.5 ${
        checked ? "border-white/40 bg-white/[0.03]" : "border-transparent"
      }`}
      data-flow-choice={hook || value}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        data-flow-choice-input={value}
        className="mt-1 h-4 w-4 rounded-none border-white/40 bg-black accent-white"
      />
      <span className="min-w-0 space-y-1">
        <span className="block text-sm text-neutral-200">{title}</span>
        {hint ? (
          <span className="block text-xs leading-relaxed text-neutral-500">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function FlowProblemFields({
  problem,
  onProblemChange,
  artifacts,
  onArtifactsChange,
  workspaceId,
  exactProblemOnCanvas = false,
  onExactProblemOnCanvasChange,
  openingCanvasPrepared = false,
  openingCanvasScene = null,
  onPrepareOpeningCanvas,
  onClearOpeningCanvas,
  generateProblemOnOpen = false,
  onGenerateProblemOnOpenChange,
  flowName = "",
  problemReadOnly = false,
  layout = "stack",
  aside = null,
}: {
  problem: string;
  onProblemChange: (value: string) => void;
  artifacts: FlowArtifact[];
  onArtifactsChange: (next: FlowArtifact[]) => void;
  workspaceId?: string | null;
  exactProblemOnCanvas?: boolean;
  onExactProblemOnCanvasChange?: (value: boolean) => void;
  openingCanvasPrepared?: boolean;
  openingCanvasScene?: IleWorkCanvasScene | null;
  onPrepareOpeningCanvas?: () => void;
  onClearOpeningCanvas?: () => void;
  generateProblemOnOpen?: boolean;
  onGenerateProblemOnOpenChange?: (value: boolean) => void;
  flowName?: string;
  /** Published flows keep the Problem as written. */
  problemReadOnly?: boolean;
  /** Wizard Author step uses a two-column layout. Drawers stay stacked. */
  layout?: "stack" | "split";
  aside?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<FlowAuthoringSource | null>(null);
  const split = layout === "split";
  const canvasPrepared =
    openingCanvasPrepared || flowOpeningCanvasHasContent(openingCanvasScene);
  const previewScene =
    openingCanvasScene && flowOpeningCanvasHasContent(openingCanvasScene)
      ? openingCanvasScene
      : null;
  const showCanvasSource = Boolean(onPrepareOpeningCanvas);
  const derived = flowAuthoringSource({
    problem,
    generateProblemOnOpen,
    artifacts,
    openingCanvasScene,
  });
  const source = picked ?? derived;

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
      setPicked("artifacts");
      onGenerateProblemOnOpenChange?.(true);
      onExactProblemOnCanvasChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function setSource(next: FlowAuthoringSource) {
    setPicked(next);
    if (next === "problem") {
      onGenerateProblemOnOpenChange?.(false);
      if (previewScene) onClearOpeningCanvas?.();
      return;
    }
    onExactProblemOnCanvasChange?.(false);
    if (next === "artifacts") {
      if (previewScene) onClearOpeningCanvas?.();
      onGenerateProblemOnOpenChange?.(true);
      return;
    }
    onGenerateProblemOnOpenChange?.(false);
    if (!previewScene) onPrepareOpeningCanvas?.();
  }

  const problemTextarea = (
    <textarea
      value={problem}
      onChange={(event) => {
        if (problemReadOnly) return;
        onProblemChange(event.target.value);
      }}
      placeholder={PROTOCOL_CHALLENGE_LABEL}
      rows={split ? 12 : 6}
      readOnly={problemReadOnly}
      data-flow-problem=""
      data-flow-problem-locked={problemReadOnly ? "" : undefined}
      data-protocol-challenge=""
      className={`${FLOW_FORM_TEXTAREA}${split ? " min-h-[16rem]" : ""}${
        problemReadOnly ? " cursor-default text-neutral-300" : ""
      }`}
    />
  );

  const sourceList = (
    <div className="space-y-1" data-flow-author-source={source}>
      <Choice
        name="flow-author-source"
        value="problem"
        checked={source === "problem"}
        onChange={() => setSource("problem")}
        title={`Write ${PROTOCOL_CHALLENGE_LABEL.toLowerCase()}`}
        hint="Type the challenge the learner works."
        hook="problem"
      />
      <Choice
        name="flow-author-source"
        value="artifacts"
        checked={source === "artifacts"}
        onChange={() => setSource("artifacts")}
        title="From files"
        hint="A new problem is written from these files when a learner opens."
        hook="artifacts"
      />
      {showCanvasSource ? (
        <Choice
          name="flow-author-source"
          value="canvas"
          checked={source === "canvas"}
          onChange={() => setSource("canvas")}
          title="Prepared board"
          hint="The board is the problem."
          hook="canvas"
        />
      ) : null}
    </div>
  );

  const problemDetails = (
    <AuthorSection label={PROTOCOL_CHALLENGE_LABEL} hook="problem" split={split}>
      {problemTextarea}
      {problemReadOnly ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          {PROTOCOL_CHALLENGE_LABEL} cannot be changed after the protocol is created.
        </p>
      ) : null}
      {onExactProblemOnCanvasChange ? (
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
              Put this text on the board as written.
            </span>
          </span>
        </label>
      ) : null}
    </AuthorSection>
  );

  const filesDetails = (
    <AuthorSection label="Files" hook="artifacts" split={split}>
      <div className="space-y-3" data-flow-artifacts="">
        <p className="text-xs leading-relaxed text-neutral-500" data-flow-generate-from-artifacts="">
          A new problem is written from these files when a learner opens.
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
          className="sr-only"
          disabled={busy || artifacts.length >= FLOW_ARTIFACT_MAX_COUNT}
          onChange={(event) => void onFiles(event.target.files)}
        />
        <button
          type="button"
          className={FLOW_GHOST_BTN}
          disabled={busy || artifacts.length >= FLOW_ARTIFACT_MAX_COUNT}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Add files"}
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </AuthorSection>
  );

  const canvasDetails = showCanvasSource ? (
    <AuthorSection label="Work canvas" hook="canvas" split={split}>
      <div className="space-y-3" data-flow-work-canvas-options="">
        <div className="space-y-3" data-flow-opening-canvas="">
          {previewScene ? (
            <div className="space-y-2">
              <FlowOpeningCanvasPreview
                scene={previewScene}
                onEdit={() => onPrepareOpeningCanvas?.()}
              />
              {onClearOpeningCanvas ? (
                <button
                  type="button"
                  className={FLOW_GHOST_BTN}
                  onClick={() => {
                    onClearOpeningCanvas();
                    setPicked("canvas");
                  }}
                  data-flow-opening-canvas-clear=""
                >
                  Clear canvas
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <button
                type="button"
                className={FLOW_SECONDARY_BTN}
                onClick={onPrepareOpeningCanvas}
                data-flow-opening-canvas-open=""
              >
                {FLOW_OPENING_CANVAS_LABEL}
              </button>
              {canvasPrepared ? (
                <p
                  className="mt-2 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500"
                  data-flow-opening-canvas-prepared=""
                >
                  Canvas prepared
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AuthorSection>
  ) : null;

  const details =
    source === "artifacts" ? filesDetails : source === "canvas" ? canvasDetails : problemDetails;

  return (
    <div
      className={split ? "grid items-start gap-10 lg:grid-cols-2" : "space-y-8"}
      data-flow-problem-fields=""
      data-flow-problem-layout={split ? "split" : "stack"}
    >
      <div className="min-w-0 space-y-4">
        <p className={FLOW_FORM_LABEL}>Author</p>
        <p className="text-xs leading-relaxed text-neutral-500">
          Choose one source for {PROTOCOL_CHALLENGE_LABEL.toLowerCase()}.
        </p>
        {sourceList}
        {split ? null : details}
        {split ? null : aside}
      </div>
      {split ? (
        <div className="flex min-w-0 flex-col gap-8">
          {details}
          {aside}
        </div>
      ) : null}
    </div>
  );
}
