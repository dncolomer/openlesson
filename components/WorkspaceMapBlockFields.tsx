"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAP_BLOCK_KINDS,
  mapBlockFlowHref,
  mapBlockKindLabel,
  normalizeMapBlock,
  parseMapBlockAttachment,
  type MapBlock,
  type MapBlockAttachment,
  type MapBlockKind,
} from "@/lib/block-kind";
import {
  MAP_BLOCK_FILE_ACCEPT,
  MAP_BLOCK_MAX_ATTACHMENTS,
  mapBlockAttachmentHref,
  uploadMapBlockFile,
} from "@/lib/map-block-files";
import { BlockMapGlyphIcon } from "@/components/block-skill-grid/map-block-glyph-icon";
import { mapBlockKindIconName } from "@/lib/block-map-glyph";
import { DASHBOARD_FLOWS_PATH } from "@/lib/product-flow";
import type { DashboardRecentFlow } from "@/lib/dashboard-home";

export function WorkspaceMapBlockKindPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: MapBlockKind;
  onChange: (kind: MapBlockKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5" data-add-block-kind-picker data-map-block-kind-picker>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Block type
      </p>
      <div className="grid grid-cols-2 gap-1">
        {MAP_BLOCK_KINDS.map((kind) => {
          const selected = value === kind;
          const kindIcon = mapBlockKindIconName(kind);
          return (
            <button
              key={kind}
              type="button"
              data-add-block-kind={kind}
              data-map-block-kind={kind}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(kind)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-none border px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${
                selected
                  ? "border-white/40 bg-white/15 text-white"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {kindIcon ? (
                <BlockMapGlyphIcon
                  name={kindIcon}
                  className="h-3.5 w-3.5 shrink-0"
                />
              ) : null}
              {mapBlockKindLabel(kind)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkspaceOwnerFlowPicker({
  kind,
  selectedId,
  onChange,
  disabled = false,
}: {
  kind: "calibration" | "verification";
  selectedId: string | null;
  onChange: (flow: DashboardRecentFlow | null) => void;
  disabled?: boolean;
}) {
  const [flows, setFlows] = useState<DashboardRecentFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `${DASHBOARD_FLOWS_PATH}?kind=${encodeURIComponent(kind)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Could not load flows",
          );
        }
        const list = Array.isArray(data.flows) ? data.flows : [];
        if (!cancelled) setFlows(list as DashboardRecentFlow[]);
      } catch (err) {
        if (!cancelled) {
          setFlows([]);
          setError(err instanceof Error ? err.message : "Could not load flows");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div className="space-y-1.5" data-map-block-flow-picker data-flow-kind={kind}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Existing {kind === "calibration" ? "calibration" : "verification"} flow
      </p>
      {loading ? (
        <p className="text-[11px] text-neutral-600">Loading flows…</p>
      ) : error ? (
        <p className="text-[11px] text-red-400/90" data-map-block-flow-error>
          {error}
        </p>
      ) : flows.length === 0 ? (
        <p className="text-[11px] text-neutral-500" data-map-block-flow-empty>
          No existing {kind} flows yet. Create one from the dashboard, then link it here.
        </p>
      ) : (
        <select
          data-map-block-flow-select
          value={selectedId || ""}
          disabled={disabled}
          onChange={(e) => {
            const id = e.target.value;
            onChange(flows.find((flow) => flow.id === id) || null);
          }}
          className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select a flow…</option>
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name || flow.title || flow.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function WorkspaceContentAttachmentsEditor({
  attachments,
  onChange,
  disabled = false,
  workspaceId,
  ayclToken,
}: {
  attachments: MapBlockAttachment[];
  onChange: (next: MapBlockAttachment[]) => void;
  disabled?: boolean;
  workspaceId?: string;
  ayclToken?: string | null;
}) {
  const [draftUrl, setDraftUrl] = useState("");
  const [draftName, setDraftName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLink = () => {
    const parsed = parseMapBlockAttachment({
      type: "link",
      name: draftName.trim() || draftUrl.trim(),
      url: draftUrl.trim(),
    });
    if (!parsed || parsed.type !== "link" || !parsed.url) return;
    onChange([...attachments, parsed]);
    setDraftUrl("");
    setDraftName("");
  };

  const addFile = async (file: File) => {
    if (!workspaceId || disabled || uploading) return;
    if (attachments.length >= MAP_BLOCK_MAX_ATTACHMENTS) {
      setUploadError("This block already has the maximum number of attachments.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const next = await uploadMapBlockFile({
        workspaceId,
        ayclToken,
        file,
      });
      onChange([...attachments, next]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2" data-map-block-content-attachments>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Content files and links
      </p>
      <p className="text-[11px] text-neutral-500">
        This content block has no Learn mode. Upload files (org xAI Files) or add external links.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={MAP_BLOCK_FILE_ACCEPT}
        data-map-block-content-file
        className="sr-only"
        disabled={disabled || uploading || !workspaceId}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addFile(file);
        }}
      />
      <button
        type="button"
        data-map-block-content-upload
        disabled={disabled || uploading || !workspaceId}
        onClick={() => fileInputRef.current?.click()}
        className="w-full rounded-none border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-100 hover:bg-white/10 disabled:opacity-40"
      >
        {uploading ? "Uploading…" : "Upload file"}
      </button>
      {uploadError ? (
        <p className="text-[11px] text-red-400/90" data-map-block-content-upload-error>
          {uploadError}
        </p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Link URL</span>
        <input
          data-map-block-content-url
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          disabled={disabled}
          placeholder="https://…"
          className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Link name</span>
        <input
          data-map-block-content-name
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          disabled={disabled}
          placeholder="Optional label"
          className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>
      <button
        type="button"
        data-map-block-content-add
        disabled={disabled || !draftUrl.trim()}
        onClick={addLink}
        className="w-full rounded-none border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-100 hover:bg-white/10 disabled:opacity-40"
      >
        Add link
      </button>
      {attachments.length > 0 ? (
        <ul className="space-y-1" data-map-block-content-list>
          {attachments.map((item, index) => (
            <li
              key={`${item.type}:${item.url || item.name}:${index}`}
              className="flex items-center justify-between gap-2 border border-neutral-800 bg-neutral-950/80 px-2 py-1.5 text-[11px] text-neutral-200"
            >
              <span className="min-w-0 truncate">
                {item.name}
                {item.type === "file" ? (
                  <span className="block truncate text-[10px] text-neutral-500">
                    File
                  </span>
                ) : item.url ? (
                  <span className="block truncate text-[10px] text-neutral-500">
                    {item.url}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                data-map-block-content-remove
                disabled={disabled}
                onClick={() =>
                  onChange(attachments.filter((_, i) => i !== index))
                }
                className="shrink-0 text-[10px] text-neutral-500 hover:text-white disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-neutral-600">No files or links yet</p>
      )}
    </div>
  );
}

export function WorkspaceMapBlockLaunchCard({
  mapBlock,
  onOpen,
  workspaceId,
  ayclToken,
}: {
  mapBlock: MapBlock | unknown;
  onOpen: (href: string) => void;
  workspaceId?: string;
  ayclToken?: string | null;
}) {
  const block = normalizeMapBlock(mapBlock);
  if (block.kind === "learn") return null;
  if (block.kind === "content") {
    return (
      <div className="space-y-2" data-map-block-content-view>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Content
        </p>
        {block.attachments.length === 0 ? (
          <p className="text-[11px] text-neutral-500">No files or links attached.</p>
        ) : (
          <ul className="space-y-1" data-map-block-content-view-list>
            {block.attachments.map((item, index) => {
              const href = mapBlockAttachmentHref(item, { workspaceId, ayclToken });
              return (
              <li key={`${item.name}:${index}`}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    data-map-block-content-link
                    className="block truncate text-[12px] text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
                  >
                    {item.name}
                  </a>
                ) : (
                  <span className="text-[12px] text-neutral-200">{item.name}</span>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
  const href = mapBlockFlowHref(block);
  return (
    <div className="space-y-2" data-map-block-launch>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {block.kind === "calibration" ? "Calibration" : "Verification"} flow
      </p>
      {href ? (
        <button
          type="button"
          data-map-block-launch-open
          onClick={() => onOpen(href)}
          className="inline-flex h-10 w-full items-center justify-center rounded-none bg-white text-sm font-medium text-black hover:bg-neutral-200"
        >
          {block.kind === "calibration"
            ? "Open calibration flow"
            : "Open verification flow"}
        </button>
      ) : (
        <p className="text-[11px] text-neutral-500">
          Link an existing {block.kind} flow to open it from this block.
        </p>
      )}
    </div>
  );
}

export function mapBlockFromPickerState(input: {
  kind: MapBlockKind;
  flow: DashboardRecentFlow | null;
  attachments: MapBlockAttachment[];
}): MapBlock {
  return normalizeMapBlock({
    kind: input.kind,
    flowId: input.flow?.id,
    flowHref: input.flow?.publicPath,
    attachments: input.attachments,
  });
}
