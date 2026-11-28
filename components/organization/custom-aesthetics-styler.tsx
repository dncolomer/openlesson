"use client";

import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import {
  parseSessionCanvasStyle,
  SESSION_SIDEBAR_STYLE_PROMPT_MAX,
  sessionCanvasColorInputPatch,
  sessionCanvasHex6,
  type SessionCanvasStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const COMPACT_ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-none border border-white/40 text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const COMPACT_ICON_BTN_PRIMARY =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-white text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50";

export function CustomAestheticsStyler({
  urls,
  style,
  prompt,
  onPromptChange,
  onCanvasChange,
  uploading,
  generating,
  removingUrl,
  onUpload,
  onRemove,
  onGenerate,
  onReset,
  editable = true,
  memberNote,
  compact = false,
  labels,
}: {
  urls: readonly string[];
  style: SessionSidebarStyle;
  prompt: string;
  onPromptChange: (value: string) => void;
  onCanvasChange?: (canvas: SessionCanvasStyle) => void;
  uploading: boolean;
  generating: boolean;
  removingUrl: string | null;
  onUpload: (files: FileList | null) => void;
  onRemove: (url: string) => void;
  onGenerate: () => void;
  onReset: () => void;
  editable?: boolean;
  memberNote?: string;
  compact?: boolean;
  labels: {
    kicker: string;
    title: string;
    helper: string;
    prompt: string;
    promptPlaceholder: string;
    apply: string;
    applying: string;
    reset: string;
    upload: string;
    uploading: string;
    empty: string;
    remove: string;
    removing: string;
    canvas: string;
    canvasHelper: string;
    canvasBackground: string;
    canvasStroke: string;
    canvasZen: string;
    canvasGrid: string;
  };
}) {
  const canvas = parseSessionCanvasStyle(style.canvas);
  const patchCanvas = (next: Partial<SessionCanvasStyle>) => {
    onCanvasChange?.(parseSessionCanvasStyle({ ...canvas, ...next }));
  };
  return (
    <section
      className={compact ? "min-w-0" : "flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-black"}
      data-org-custom-aesthetics
    >
      <div className={compact ? "min-w-0" : "shrink-0 border-b border-white/20 px-4 py-3 sm:px-5"}>
        {compact ? null : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{labels.kicker}</p>
            <h3 className="mt-1 text-sm font-medium text-white">{labels.title}</h3>
            <p className="mt-1 max-w-3xl text-xs text-neutral-500">{labels.helper}</p>
          </>
        )}
        {!editable && memberNote ? (
          <p className="mt-2 max-w-3xl text-xs text-neutral-400">{memberNote}</p>
        ) : null}
        <div
          className={
            compact
              ? "flex flex-col gap-3"
              : "mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]"
          }
        >
          <div className="min-w-0">
            <label className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500" htmlFor="org-sidebar-style-prompt">
              {labels.prompt}
            </label>
            <textarea
              id="org-sidebar-style-prompt"
              data-org-sidebar-style-prompt
              value={prompt}
              maxLength={SESSION_SIDEBAR_STYLE_PROMPT_MAX}
              placeholder={labels.promptPlaceholder}
              readOnly={!editable}
              disabled={!editable}
              onChange={(event) => onPromptChange(event.target.value)}
              className={`mt-1.5 w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${compact ? "min-h-[3.25rem]" : "mt-2 min-h-[4.5rem]"}`}
            />
            {editable ? (
              <div className={`flex gap-1 ${compact ? "mt-2" : "mt-3 flex-wrap gap-2"}`}>
                <button
                  type="button"
                  data-org-sidebar-style-apply
                  disabled={generating || !prompt.trim()}
                  onClick={() => onGenerate()}
                  aria-label={generating ? labels.applying : labels.apply}
                  title={generating ? labels.applying : labels.apply}
                  className={
                    compact
                      ? COMPACT_ICON_BTN_PRIMARY
                      : "inline-flex h-9 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                  }
                >
                  {compact ? (
                    generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )
                  ) : generating ? (
                    labels.applying
                  ) : (
                    labels.apply
                  )}
                </button>
                {compact ? null : (
                  <button
                    type="button"
                    data-org-sidebar-style-reset
                    disabled={generating}
                    onClick={() => onReset()}
                    className="console-button inline-flex h-9 items-center justify-center px-4 text-sm text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {labels.reset}
                  </button>
                )}
                <label
                  className={
                    compact
                      ? COMPACT_ICON_BTN
                      : "console-button inline-flex h-9 cursor-pointer items-center px-4 text-sm text-neutral-300 transition hover:border-white/80 hover:text-white"
                  }
                  aria-label={uploading ? labels.uploading : labels.upload}
                  title={uploading ? labels.uploading : labels.upload}
                >
                  <input
                    data-org-aesthetic-upload
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple={!compact}
                    className="hidden"
                    disabled={uploading || generating}
                    onChange={(e) => {
                      onUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {compact ? (
                    uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )
                  ) : uploading ? (
                    labels.uploading
                  ) : (
                    labels.upload
                  )}
                </label>
              </div>
            ) : null}
          </div>
          <div className="min-w-0" data-org-canvas-style>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{labels.canvas}</p>
            {compact ? null : <p className="mt-1 text-xs text-neutral-500">{labels.canvasHelper}</p>}
            <div className={`mt-1.5 grid grid-cols-2 gap-1.5 ${compact ? "" : "mt-2 gap-2 sm:grid-cols-4"}`}>
              <label className="flex flex-col gap-1 text-[11px] text-neutral-300">
                {labels.canvasBackground}
                <input
                  type="color"
                  data-org-canvas-background
                  value={sessionCanvasHex6(canvas.background)}
                  disabled={!editable || generating}
                  onChange={(event) => {
                    const next = sessionCanvasColorInputPatch(
                      canvas.background,
                      event.target.value,
                      document.activeElement === event.target,
                    );
                    if (next) patchCanvas({ background: next });
                  }}
                  className="h-8 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-neutral-300">
                {labels.canvasStroke}
                <input
                  type="color"
                  data-org-canvas-stroke
                  value={sessionCanvasHex6(canvas.stroke)}
                  disabled={!editable || generating}
                  onChange={(event) => {
                    const next = sessionCanvasColorInputPatch(
                      canvas.stroke,
                      event.target.value,
                      document.activeElement === event.target,
                    );
                    if (next) patchCanvas({ stroke: next });
                  }}
                  className="h-8 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                <input
                  type="checkbox"
                  data-org-canvas-zen
                  checked={canvas.zenMode}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ zenMode: event.target.checked })}
                  className="h-3.5 w-3.5 rounded-none border-white/40 bg-black"
                />
                {labels.canvasZen}
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                <input
                  type="checkbox"
                  data-org-canvas-grid
                  checked={canvas.gridMode}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ gridMode: event.target.checked })}
                  className="h-3.5 w-3.5 rounded-none border-white/40 bg-black"
                />
                {labels.canvasGrid}
              </label>
            </div>
          </div>
        </div>
        {compact ? null : editable && urls.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-400">{labels.empty}</p>
        ) : null}
        {compact || urls.length === 0 ? null : (
          <ul
            className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-1"
            data-org-custom-aesthetics-assets=""
          >
            {urls.map((url) => (
              <li key={url} className="console-copy w-24 shrink-0 overflow-hidden">
                <img src={url} alt="" className="h-16 w-full object-cover" />
                {editable ? (
                  <div className="flex justify-end p-1">
                    <button
                      type="button"
                      data-org-aesthetic-remove
                      className="console-button inline-flex h-7 items-center justify-center px-2 text-[10px] text-neutral-300 transition hover:border-white/80 hover:text-white disabled:opacity-50"
                      disabled={removingUrl === url}
                      onClick={() => onRemove(url)}
                    >
                      {removingUrl === url ? labels.removing : labels.remove}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
