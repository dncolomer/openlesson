"use client";

import { SESSION_SIDEBAR_EXPANDED_REM } from "@/lib/session-sidebar";
import {
  parseSessionCanvasStyle,
  parseSessionSidebarStyle,
  sessionCanvasHex6,
  SESSION_SIDEBAR_STYLE_PROMPT_MAX,
  sessionSidebarPreviewStill,
  type SessionCanvasStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export function SessionSidebarStylePreview({
  style,
  urls = [],
  topic = "Topic",
}: {
  style: SessionSidebarStyle;
  urls?: readonly string[];
  topic?: string;
}) {
  const resolved = parseSessionSidebarStyle(style);
  const still = sessionSidebarPreviewStill(resolved, urls);
  return (
    <div
      data-org-sidebar-style-preview
      className="relative overflow-hidden border"
      style={{
        width: `${SESSION_SIDEBAR_EXPANDED_REM}rem`,
        minWidth: `${SESSION_SIDEBAR_EXPANDED_REM}rem`,
        height: "28rem",
        backgroundColor: resolved.tokens.background,
        borderColor: resolved.tokens.border,
        color: resolved.tokens.text,
      }}
    >
      <div
        className="relative h-40 overflow-hidden border-b"
        style={{ borderColor: resolved.tokens.border }}
      >
        {still ? (
          <span
            data-org-sidebar-style-preview-still
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${still})` }}
          />
        ) : null}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${resolved.tokens.overlay}, transparent 55%)`,
          }}
        />
        <span
          className="absolute bottom-2 left-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{
            borderColor: resolved.tokens.accent,
            backgroundColor: resolved.tokens.panel,
            color: resolved.tokens.text,
          }}
        >
          {topic}
        </span>
      </div>
      <div className="flex border-b" style={{ borderColor: resolved.tokens.border }}>
        {["Commands", "Help"].map((label, index) => (
          <span
            key={label}
            className="flex-1 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em]"
            style={{
              backgroundColor: index === 0 ? resolved.tokens.accent : "transparent",
              color: index === 0 ? resolved.tokens.background : resolved.tokens.muted,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-px p-2" style={{ backgroundColor: resolved.tokens.panel }}>
        {["Focus", "Next", "Simplify", "Dictate"].map((label) => (
          <span
            key={label}
            className="border px-1 py-2 text-center font-mono text-[8px] uppercase tracking-[0.12em]"
            style={{ borderColor: resolved.tokens.border, color: resolved.tokens.text }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex flex-col border-t" style={{ borderColor: resolved.tokens.border }}>
        <div className="flex" style={{ backgroundColor: resolved.tokens.panel }}>
          {["Audio", "EEG"].map((label, index) => (
            <span
              key={label}
              className="flex-1 px-1 py-1 text-center font-mono text-[8px] uppercase tracking-[0.12em]"
              style={{
                backgroundColor: index === 0 ? resolved.tokens.accent : "transparent",
                color: index === 0 ? resolved.tokens.background : resolved.tokens.muted,
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className="flex items-center justify-center px-2 py-3 font-mono text-[8px] uppercase tracking-[0.16em]"
          style={{
            backgroundColor: resolved.tokens.panel,
            color: resolved.tokens.muted,
          }}
        >
          Data
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 border-t px-2 py-2 font-mono text-[9px] uppercase tracking-[0.16em]"
        style={{
          borderColor: resolved.tokens.border,
          backgroundColor: resolved.tokens.accent,
          color: resolved.tokens.background,
        }}
      >
        Exit
      </div>
    </div>
  );
}

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
  };
}) {
  const canvas = parseSessionCanvasStyle(style.canvas);
  const patchCanvas = (next: Partial<SessionCanvasStyle>) => {
    onCanvasChange?.(parseSessionCanvasStyle({ ...canvas, ...next }));
  };
  return (
    <section className="console-copy p-5 sm:p-6" data-org-custom-aesthetics>
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{labels.kicker}</p>
      <h3 className="mt-1 text-sm font-medium text-white">{labels.title}</h3>
      <p className="mt-2 max-w-xl text-xs text-neutral-500">{labels.helper}</p>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <SessionSidebarStylePreview style={style} urls={urls} />
        <div className="min-w-0 flex-1">
          <label className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500" htmlFor="org-sidebar-style-prompt">
            {labels.prompt}
          </label>
          <textarea
            id="org-sidebar-style-prompt"
            data-org-sidebar-style-prompt
            value={prompt}
            maxLength={SESSION_SIDEBAR_STYLE_PROMPT_MAX}
            placeholder={labels.promptPlaceholder}
            onChange={(event) => onPromptChange(event.target.value)}
            className="mt-2 min-h-[8rem] w-full rounded-none border border-white/40 bg-black px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none"
          />
          <div className="mt-4 border-t border-white/15 pt-4" data-org-canvas-style>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{labels.canvas}</p>
            <p className="mt-1 text-xs text-neutral-500">{labels.canvasHelper}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs text-neutral-300">
                {labels.canvasBackground}
                <input
                  type="color"
                  data-org-canvas-background
                  value={sessionCanvasHex6(canvas.background)}
                  disabled={generating}
                  onChange={(event) => patchCanvas({ background: event.target.value })}
                  className="h-10 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs text-neutral-300">
                {labels.canvasStroke}
                <input
                  type="color"
                  data-org-canvas-stroke
                  value={sessionCanvasHex6(canvas.stroke)}
                  disabled={generating}
                  onChange={(event) => patchCanvas({ stroke: event.target.value })}
                  className="h-10 w-full cursor-pointer rounded-none border border-white/40 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-300 sm:pt-6">
                <input
                  type="checkbox"
                  data-org-canvas-zen
                  checked={canvas.zenMode}
                  disabled={generating}
                  onChange={(event) => patchCanvas({ zenMode: event.target.checked })}
                  className="h-4 w-4 rounded-none border-white/40 bg-black"
                />
                {labels.canvasZen}
              </label>
            </div>
            <div
              data-org-canvas-preview
              className="mt-3 flex h-16 items-center justify-center border font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{
                backgroundColor: canvas.background,
                borderColor: canvas.stroke,
                color: canvas.stroke,
              }}
            >
              {canvas.zenMode ? "Zen" : "Toolbar"}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-org-sidebar-style-apply
              disabled={generating || !prompt.trim()}
              onClick={() => onGenerate()}
              className="inline-flex h-10 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? labels.applying : labels.apply}
            </button>
            <button
              type="button"
              data-org-sidebar-style-reset
              disabled={generating}
              onClick={() => onReset()}
              className="console-button inline-flex h-10 items-center justify-center px-4 text-sm text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labels.reset}
            </button>
            <label className="console-button inline-flex h-10 cursor-pointer items-center px-4 text-sm text-neutral-300 transition hover:border-white/80 hover:text-white">
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
        </div>
      </div>
      {urls.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">{labels.empty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {urls.map((url) => (
            <li key={url} className="console-copy overflow-hidden">
              <img src={url} alt="" className="h-28 w-full object-cover" />
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  data-org-aesthetic-remove
                  className="console-button inline-flex h-8 items-center justify-center px-3 text-xs text-neutral-300 transition hover:border-white/80 hover:text-white disabled:opacity-50"
                  disabled={removingUrl === url}
                  onClick={() => onRemove(url)}
                >
                  {removingUrl === url ? labels.removing : labels.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
