"use client";

import {
  parseSessionCanvasStyle,
  SESSION_SIDEBAR_STYLE_PROMPT_MAX,
  sessionCanvasHex6,
  type SessionCanvasStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

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
              className={`mt-2 w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${compact ? "min-h-[5rem]" : "min-h-[4.5rem]"}`}
            />
            {editable ? (
              <div className={`mt-3 flex gap-2 ${compact ? "flex-col" : "flex-wrap"}`}>
                <button
                  type="button"
                  data-org-sidebar-style-apply
                  disabled={generating || !prompt.trim()}
                  onClick={() => onGenerate()}
                  className={`inline-flex h-9 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "w-full" : ""}`}
                >
                  {generating ? labels.applying : labels.apply}
                </button>
                <button
                  type="button"
                  data-org-sidebar-style-reset
                  disabled={generating}
                  onClick={() => onReset()}
                  className={`console-button inline-flex h-9 items-center justify-center px-4 text-sm text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "w-full" : ""}`}
                >
                  {labels.reset}
                </button>
                <label className={`console-button inline-flex h-9 cursor-pointer items-center px-4 text-sm text-neutral-300 transition hover:border-white/80 hover:text-white ${compact ? "w-full justify-center" : ""}`}>
                  <input
                    data-org-aesthetic-upload
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    disabled={uploading || generating}
                    onChange={(e) => {
                      onUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {uploading ? labels.uploading : labels.upload}
                </label>
              </div>
            ) : null}
          </div>
          <div className="min-w-0" data-org-canvas-style>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{labels.canvas}</p>
            {compact ? null : <p className="mt-1 text-xs text-neutral-500">{labels.canvasHelper}</p>}
            <div className={`mt-2 grid grid-cols-2 gap-2 ${compact ? "" : "sm:grid-cols-4"}`}>
              <label className="flex flex-col gap-1 text-xs text-neutral-300">
                {labels.canvasBackground}
                <input
                  type="color"
                  data-org-canvas-background
                  value={sessionCanvasHex6(canvas.background)}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ background: event.target.value })}
                  className="h-9 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-300">
                {labels.canvasStroke}
                <input
                  type="color"
                  data-org-canvas-stroke
                  value={sessionCanvasHex6(canvas.stroke)}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ stroke: event.target.value })}
                  className="h-9 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex items-end gap-2 pb-1 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  data-org-canvas-zen
                  checked={canvas.zenMode}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ zenMode: event.target.checked })}
                  className="h-4 w-4 rounded-none border-white/40 bg-black"
                />
                {labels.canvasZen}
              </label>
              <label className="flex items-end gap-2 pb-1 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  data-org-canvas-grid
                  checked={canvas.gridMode}
                  disabled={!editable || generating}
                  onChange={(event) => patchCanvas({ gridMode: event.target.checked })}
                  className="h-4 w-4 rounded-none border-white/40 bg-black"
                />
                {labels.canvasGrid}
              </label>
            </div>
          </div>
        </div>
        {editable && urls.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-400">{labels.empty}</p>
        ) : null}
        {urls.length > 0 ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
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
        ) : null}
      </div>
    </section>
  );
}
