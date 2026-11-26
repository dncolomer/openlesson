"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { WorkspaceUnsysSeedGraph } from "@/components/WorkspaceUnsysSeedGraph";
import { FlowOpeningCanvasPreview } from "@/components/product-flow/flow-opening-canvas-preview";
import { FLOW_FORM_LABEL, FlowFormCard } from "@/components/product-flow/product-flow-form";
import { flowAuthorShowsCanvasCapture } from "@/lib/flow-canvas-capture";
import { FLOW_CHANNEL_IDS, FLOW_CHANNEL_LABELS } from "@/lib/flow-channels";
import {
  FLOW_OPENING_CANVAS_LABEL,
  flowOpeningCanvasHasContent,
} from "@/lib/flow-opening-canvas";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import {
  PROTOCOL_CHALLENGE_LABEL,
  flowAuthoringSource,
  type ProtocolDraft,
} from "@/lib/product-flow";

function authoringSourceLabel(source: ReturnType<typeof flowAuthoringSource>): string {
  if (source === "artifacts") return "From files";
  if (source === "canvas") return "Prepared board";
  return `Write ${PROTOCOL_CHALLENGE_LABEL.toLowerCase()}`;
}

function ReviewItem({
  label,
  children,
  ...rest
}: {
  label: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest}>
      <dt className={FLOW_FORM_LABEL}>{label}</dt>
      <dd className="mt-1 text-white">{children}</dd>
    </div>
  );
}

export function FlowPublishReview({
  draft,
  problem,
  actions,
}: {
  draft: ProtocolDraft;
  problem: string;
  actions: ReactNode;
}) {
  const source = flowAuthoringSource(draft);
  const canvasPrepared = flowOpeningCanvasHasContent(draft.openingCanvasScene);
  const previewScene =
    draft.openingCanvasScene && canvasPrepared ? draft.openingCanvasScene : null;
  const unsys = parseFlowUnsysSeed(draft.answersModelSeed);
  const model = unsys?.model ?? null;
  const states = model?.branches.length ?? 0;
  const edges =
    model?.branches.reduce((count, branch) => count + branch.edges.length, 0) ?? 0;
  const channelLabels = FLOW_CHANNEL_IDS.filter((id) => draft.enforcedChannels[id]).map(
    (id) => FLOW_CHANNEL_LABELS[id],
  );
  const showCapture = flowAuthorShowsCanvasCapture();
  const showVisuals = Boolean(previewScene || model);

  return (
    <FlowFormCard data-flow-publish-review="">
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <dl
            className="grid gap-4 text-sm text-neutral-300 sm:grid-cols-2"
            data-flow-publish-summary=""
          >
            <ReviewItem label="Name">
              <span data-flow-name="">{draft.name.trim() || "—"}</span>
            </ReviewItem>
            <ReviewItem label="Author" data-flow-publish-author="">
              {authoringSourceLabel(source)}
            </ReviewItem>
            <ReviewItem label="Countdown">
              {draft.durationMinutes} min
            </ReviewItem>
            <ReviewItem label="Channels" data-flow-publish-channels="">
              {channelLabels.join(" · ") || "Canvas only"}
            </ReviewItem>
            <ReviewItem label="Unsys model" data-flow-publish-unsys="">
              {model
                ? `${states} hidden state${states === 1 ? "" : "s"} · ${edges} edge${
                    edges === 1 ? "" : "s"
                  }`
                : "No unsys model"}
            </ReviewItem>
            {showCapture ? (
              <ReviewItem
                label="Capture Canvas"
                data-flow-publish-canvas-capture=""
              >
                {draft.canvasCapture.enabled
                  ? `Capture Canvas every ${draft.canvasCapture.everyActions} actions`
                  : "Off"}
              </ReviewItem>
            ) : null}
            {source === "problem" ? (
              <ReviewItem label="Exact problem on canvas">
                {draft.exactProblemOnCanvas ? "On" : "Off"}
              </ReviewItem>
            ) : null}
            {draft.generateProblemOnOpen ? (
              <ReviewItem
                label="Generate problem on open"
                data-flow-publish-generate-on-open=""
              >
                On
              </ReviewItem>
            ) : null}
            {canvasPrepared ? (
              <ReviewItem label="Work canvas" data-flow-publish-opening-canvas="">
                {FLOW_OPENING_CANVAS_LABEL}
              </ReviewItem>
            ) : null}
          </dl>

          {source === "problem" ? (
            <section className="space-y-2">
              <p className={FLOW_FORM_LABEL}>{PROTOCOL_CHALLENGE_LABEL}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                {problem.trim() || "—"}
              </p>
            </section>
          ) : null}

          {source === "artifacts" ? (
            <section className="space-y-2" data-flow-publish-artifacts="">
              <p className={FLOW_FORM_LABEL}>Files</p>
              {draft.artifacts.length ? (
                <ul className="space-y-1 text-sm text-neutral-300">
                  {draft.artifacts.map((file) => (
                    <li key={file.xaiFileId} className="truncate" title={file.name}>
                      {file.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">No files</p>
              )}
            </section>
          ) : null}
        </div>

        {showVisuals ? (
          <div className="min-w-0 space-y-6" data-flow-publish-visuals="">
            {previewScene ? (
              <section className="space-y-2">
                <p className={FLOW_FORM_LABEL}>Prepared board</p>
                <FlowOpeningCanvasPreview scene={previewScene} />
              </section>
            ) : null}
            {model ? (
              <section className="space-y-2">
                <p className={FLOW_FORM_LABEL}>Unsys model</p>
                <div
                  className="relative h-[22rem] overflow-hidden border border-white/25 bg-[#050505]"
                  data-flow-publish-unsys-graph=""
                >
                  <WorkspaceUnsysSeedGraph
                    model={model}
                    focusId={model.rootId}
                    disabled
                    draggableNodes={false}
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions}
    </FlowFormCard>
  );
}
