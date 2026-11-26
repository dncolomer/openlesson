"use client";

import {
  FLOW_CHANNEL_IDS,
  FLOW_CHANNEL_LABELS,
  type FlowChannelId,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  FLOW_CANVAS_CAPTURE_EVERY_DEFAULT,
  FLOW_CANVAS_CAPTURE_EVERY_MAX,
  FLOW_CANVAS_CAPTURE_EVERY_MIN,
  parseCanvasCaptureEveryActions,
  type FlowCanvasCapture,
} from "@/lib/flow-canvas-capture";
import { FLOW_FORM_INPUT, FLOW_FORM_LABEL } from "@/components/product-flow/product-flow-form";

export function FlowChannelsFields({
  value,
  onChange,
  canvasCapture,
  onCanvasCaptureChange,
}: {
  value: FlowEnforcedChannels;
  onChange: (next: FlowEnforcedChannels) => void;
  canvasCapture?: FlowCanvasCapture;
  onCanvasCaptureChange?: (next: FlowCanvasCapture) => void;
}) {
  function toggle(id: FlowChannelId) {
    onChange({ ...value, [id]: !value[id] });
  }

  return (
    <div className="space-y-4" data-flow-channels="">
      <p className={FLOW_FORM_LABEL}>Enforced channels</p>
      <p className="text-sm leading-relaxed text-neutral-400">
        Required for this run. A required channel with no data flowing
        invalidates the session. Audio off leaves the microphone optional and
        embeds canvas proof of work only.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FLOW_CHANNEL_IDS.map((id) => {
          const checked = value[id];
          return (
            <button
              key={id}
              type="button"
              data-flow-channel={id}
              data-flow-channel-on={checked ? "" : undefined}
              aria-pressed={checked}
              onClick={() => toggle(id)}
              className={`flex h-12 items-center justify-between border px-4 text-left text-sm transition ${
                checked
                  ? "border-white bg-white text-black"
                  : "border-white/40 bg-black text-neutral-300 hover:border-white/70 hover:text-white"
              }`}
            >
              <span>{FLOW_CHANNEL_LABELS[id]}</span>
              <span className="font-mono text-[10px] uppercase tracking-[1.6px]">
                {checked ? "On" : "Off"}
              </span>
            </button>
          );
        })}
      </div>
      {canvasCapture && onCanvasCaptureChange ? (
        <div className="space-y-3 pt-2" data-flow-canvas-capture="">
          <p className={FLOW_FORM_LABEL}>Capture Canvas</p>
          <p className="text-sm leading-relaxed text-neutral-400">
            Off by default. Canvas actions still go to the Unsys model. When on,
            every N actions also stores a mermaid document of the board on the
            stored record, not in the embedding.
          </p>
          <button
            type="button"
            data-flow-canvas-capture-toggle=""
            data-flow-canvas-capture-on={canvasCapture.enabled ? "" : undefined}
            aria-pressed={canvasCapture.enabled}
            onClick={() =>
              onCanvasCaptureChange({
                ...canvasCapture,
                enabled: !canvasCapture.enabled,
              })
            }
            className={`flex h-12 w-full items-center justify-between border px-4 text-left text-sm transition ${
              canvasCapture.enabled
                ? "border-white bg-white text-black"
                : "border-white/40 bg-black text-neutral-300 hover:border-white/70 hover:text-white"
            }`}
          >
            <span>Capture Canvas</span>
            <span className="font-mono text-[10px] uppercase tracking-[1.6px]">
              {canvasCapture.enabled ? "On" : "Off"}
            </span>
          </button>
          <label className="block space-y-1.5">
            <span className={FLOW_FORM_LABEL}>Every N actions</span>
            <input
              type="number"
              min={FLOW_CANVAS_CAPTURE_EVERY_MIN}
              max={FLOW_CANVAS_CAPTURE_EVERY_MAX}
              step={1}
              data-flow-canvas-capture-every=""
              disabled={!canvasCapture.enabled}
              value={canvasCapture.everyActions || FLOW_CANVAS_CAPTURE_EVERY_DEFAULT}
              onChange={(event) =>
                onCanvasCaptureChange({
                  ...canvasCapture,
                  everyActions: parseCanvasCaptureEveryActions(event.target.value),
                })
              }
              className={`${FLOW_FORM_INPUT} disabled:opacity-40`}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
