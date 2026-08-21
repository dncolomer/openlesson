"use client";

/**
 * Workspace Settings → Data Studio: filterable PoW list, expandable details (metadata),
 * inspect/edit, invalidate (metadata-only).
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";
import { isInvalidatedPoWMetadata } from "@/lib/pow-api/pow-quality";

type PowItem = {
  id: string;
  proofOfWorkType: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
  toolName: string | null;
  toolAction: string | null;
  deviceName?: string | null;
  sampleCount?: number | null;
  sessionId: string | null;
  blockId: string | null;
  chunkIndex?: number;
  timestampMs?: number | null;
  userId: string | null;
  guestUserId?: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  bandPowers?: Record<string, unknown> | null;
  summary?: string;
  invalidated?: boolean;
};

interface WorkspaceDataStudioPanelProps {
  workspaceId: string;
  isOwner: boolean;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-xs">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-300">{children}</dd>
    </div>
  );
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceDataStudioPanel({
  workspaceId,
  isOwner,
}: WorkspaceDataStudioPanelProps) {
  const [items, setItems] = useState<PowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [link, setLink] = useState("");
  const [invalidatedFilter, setInvalidatedFilter] = useState<"all" | "yes" | "no">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState("");
  const [editToolName, setEditToolName] = useState("");
  const [editToolAction, setEditToolAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        workspaceId,
        page: String(page),
        pageSize: "25",
        sort: "created_at",
        order: "desc",
      });
      if (search.trim()) qs.set("search", search.trim());
      if (userId.trim()) qs.set("userId", userId.trim());
      if (link.trim()) qs.set("link", link.trim());
      if (invalidatedFilter !== "all") qs.set("invalidated", invalidatedFilter);

      const res = await fetch(`/api/workspace/data-studio/pow?${qs}`);
      const data = await readJsonResponse<{
        error?: string;
        items?: PowItem[];
        totalCount?: number;
        totalPages?: number;
        page?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to load PoW");
      setItems(data.items || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load PoW");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isOwner, page, search, userId, link, invalidatedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openInspect = (item: PowItem) => {
    setExpandedId(item.id);
    setEditMeta(JSON.stringify(item.metadata || {}, null, 2));
    setEditToolName(item.toolName || "");
    setEditToolAction(item.toolAction || "");
    setStatusMsg("");
  };

  const toggleExpand = (item: PowItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    openInspect(item);
  };

  const saveEdit = async (opts?: { invalidate?: boolean; clearInvalidated?: boolean }) => {
    if (!expandedId) return;
    setSaving(true);
    setStatusMsg("");
    try {
      let metadata: unknown = undefined;
      if (!opts?.invalidate && !opts?.clearInvalidated) {
        try {
          metadata = JSON.parse(editMeta || "{}");
        } catch {
          throw new Error("Metadata must be valid JSON");
        }
      }
      const res = await fetch("/api/workspace/data-studio/pow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          id: expandedId,
          ...(metadata !== undefined ? { metadata } : {}),
          tool_name: editToolName || null,
          tool_action: editToolAction || null,
          invalidate: opts?.invalidate === true,
          clearInvalidated: opts?.clearInvalidated === true,
        }),
      });
      const data = await readJsonResponse<{ error?: string; item?: PowItem }>(res);
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatusMsg(opts?.invalidate ? "Flagged invalidated (metadata)." : "Saved.");
      await load();
      if (data.item) openInspect(data.item);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const bulkInvalidate = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/workspace/data-studio/pow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ids: Array.from(selected),
          action: "invalidate",
          reason: "bulk_workspace_data_studio",
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        updated_count?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Bulk invalidate failed");
      setStatusMsg(`Invalidated ${data.updated_count ?? selected.size} PoW row(s).`);
      setSelected(new Set());
      // Close inspect so Save edits cannot re-PATCH stale pre-invalidate metadata.
      setExpandedId(null);
      setEditMeta("");
      await load();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Bulk invalidate failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  if (!isOwner) {
    return (
      <p className="text-sm text-neutral-500" data-workspace-data-studio-readonly>
        Data Studio is available to workspace owners.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-workspace-data-studio data-settings-section="data-studio">
      <div>
        <h2 className="text-sm font-medium text-white">Data Studio</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Browse proof of work for this workspace. Expand a row to see full details and metadata.
          Filter by user, TAP/ILE/TAPBench link, or search. Edit metadata and flag rows as{" "}
          <span className="text-neutral-300">invalidated</span> (metadata only — excluded from
          future snapshots).
        </p>
      </div>

      <div className="flex flex-wrap gap-2" data-workspace-data-studio-filters>
        <input
          className="min-w-[10rem] flex-1 rounded-none border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          placeholder="Search file, tool, metadata…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          data-studio-filter-search
        />
        <input
          className="min-w-[8rem] rounded-none border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          placeholder="User id"
          value={userId}
          onChange={(e) => {
            setPage(1);
            setUserId(e.target.value);
          }}
          data-studio-filter-user
        />
        <input
          className="min-w-[12rem] flex-1 rounded-none border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          placeholder="Link / token (TAP, ILE, TAPBench)"
          value={link}
          onChange={(e) => {
            setPage(1);
            setLink(e.target.value);
          }}
          data-studio-filter-link
        />
        <select
          className="rounded-none border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          value={invalidatedFilter}
          onChange={(e) => {
            setPage(1);
            setInvalidatedFilter(e.target.value as "all" | "yes" | "no");
          }}
          data-studio-filter-invalidated
        >
          <option value="all">All validity</option>
          <option value="no">Not invalidated</option>
          <option value="yes">Invalidated only</option>
        </select>
        <button
          type="button"
          className="rounded-none border border-neutral-600 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          onClick={() => void load()}
          data-studio-refresh
        >
          Refresh
        </button>
        <button
          type="button"
          className="rounded-none border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-950/70 disabled:opacity-40"
          disabled={selected.size === 0 || bulkBusy}
          onClick={() => void bulkInvalidate()}
          data-studio-bulk-invalidate
        >
          {bulkBusy ? "Invalidating…" : `Invalidate selected (${selected.size})`}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-red-400" data-studio-error>
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="text-xs text-neutral-300/90" data-studio-status>
          {statusMsg}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-none border border-neutral-800" data-studio-pow-table>
        <table className="w-full min-w-[44rem] text-left text-xs">
          <thead className="border-b border-neutral-800 bg-neutral-950/80 text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleSelectAll}
                  data-studio-select-all
                  aria-label="Select all"
                />
              </th>
              <th className="px-2 py-2">When</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Summary</th>
              <th className="px-2 py-2">User / guest</th>
              <th className="px-2 py-2">Flags</th>
              <th className="w-[4.5rem] px-2 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-neutral-500">
                  No proof of work matches.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const inv =
                  item.invalidated === true || isInvalidatedPoWMetadata(item.metadata);
                const expanded = expandedId === item.id;
                const meta = item.metadata || {};
                const metaKeys = Object.keys(meta);
                const textPreview =
                  typeof meta.text === "string"
                    ? meta.text
                    : typeof meta.answer === "string"
                      ? meta.answer
                      : typeof meta.reasoning === "string"
                        ? meta.reasoning
                        : null;

                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`border-b border-neutral-900/80 hover:bg-neutral-900/40 ${
                        expanded ? "bg-neutral-900/50" : ""
                      }`}
                      data-studio-pow-row
                      data-pow-id={item.id}
                      data-pow-invalidated={inv ? "true" : "false"}
                      data-pow-expanded={expanded ? "true" : "false"}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          data-studio-select-row
                          aria-label={`Select ${item.id}`}
                        />
                      </td>
                      <td className="px-2 py-2 font-mono text-[11px] text-neutral-400">
                        <button
                          type="button"
                          className="text-left hover:text-white"
                          onClick={() => toggleExpand(item)}
                          data-studio-inspect
                        >
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : "—"}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-neutral-300">{item.proofOfWorkType}</td>
                      <td className="max-w-[14rem] truncate px-2 py-2 text-neutral-300">
                        {item.summary || item.fileName}
                      </td>
                      <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-[10px] text-neutral-500">
                        {item.userId || item.guestUserId || "—"}
                      </td>
                      <td className="px-2 py-2">
                        {inv ? (
                          <span
                            className="rounded-none bg-red-950/50 px-1.5 py-0.5 text-[10px] text-red-300"
                            data-pow-invalidated-badge
                          >
                            invalidated
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          className="text-[11px] text-neutral-500 hover:text-white"
                          onClick={() => toggleExpand(item)}
                          data-studio-pow-expand={item.id}
                          aria-expanded={expanded}
                        >
                          {expanded ? "Hide" : "Expand"}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr
                        className="border-b border-neutral-800/80 bg-neutral-950/70"
                        data-studio-pow-details-row={item.id}
                        data-studio-pow-inspect
                      >
                        <td colSpan={7} className="px-3 py-4">
                          <div className="space-y-4">
                            {/* Read-only details */}
                            <div
                              className="rounded-none border border-neutral-800 bg-black/30 p-3"
                              data-studio-pow-details
                            >
                              <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                Details
                              </div>
                              <dl className="space-y-1.5">
                                <DetailRow label="ID">
                                  <span className="font-mono text-[11px] text-neutral-400">
                                    {item.id}
                                  </span>
                                </DetailRow>
                                <DetailRow label="Type">{item.proofOfWorkType}</DetailRow>
                                <DetailRow label="File">
                                  {item.fileName}
                                  {item.mimeType ? (
                                    <span className="text-neutral-500"> · {item.mimeType}</span>
                                  ) : null}
                                  {item.fileSize != null ? (
                                    <span className="text-neutral-500">
                                      {" "}
                                      · {formatFileSize(item.fileSize)}
                                    </span>
                                  ) : null}
                                </DetailRow>
                                {(item.toolName || item.toolAction) && (
                                  <DetailRow label="Tool">
                                    {item.toolName || "—"}
                                    {item.toolAction ? (
                                      <span className="text-neutral-500">
                                        {" "}
                                        · {item.toolAction}
                                      </span>
                                    ) : null}
                                  </DetailRow>
                                )}
                                {item.sessionId ? (
                                  <DetailRow label="Session">
                                    <span className="font-mono text-[11px] text-neutral-400">
                                      {item.sessionId}
                                    </span>
                                  </DetailRow>
                                ) : null}
                                {item.blockId ? (
                                  <DetailRow label="Block">
                                    <span className="font-mono text-[11px] text-neutral-400">
                                      {item.blockId}
                                    </span>
                                  </DetailRow>
                                ) : null}
                                {item.userId ? (
                                  <DetailRow label="User">
                                    <span className="font-mono text-[11px] text-neutral-400">
                                      {item.userId}
                                    </span>
                                  </DetailRow>
                                ) : null}
                                {item.guestUserId ? (
                                  <DetailRow label="Guest">
                                    <span className="font-mono text-[11px] text-neutral-400">
                                      {item.guestUserId}
                                    </span>
                                  </DetailRow>
                                ) : null}
                                {item.timestampMs != null ? (
                                  <DetailRow label="Timestamp ms">
                                    {item.timestampMs}
                                  </DetailRow>
                                ) : null}
                                <DetailRow label="Created">
                                  {item.createdAt
                                    ? new Date(item.createdAt).toLocaleString()
                                    : "—"}
                                </DetailRow>
                                <DetailRow label="Invalidated">
                                  {inv ? (
                                    <span className="text-red-300">yes</span>
                                  ) : (
                                    <span className="text-neutral-500">no</span>
                                  )}
                                </DetailRow>
                              </dl>
                            </div>

                            {/* Thought / text preview when present */}
                            {textPreview ? (
                              <div data-studio-pow-text-preview>
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                  Thought / text (from metadata)
                                </div>
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-none border border-neutral-800 bg-black/40 p-2 text-[11px] leading-relaxed text-neutral-300">
                                  {textPreview}
                                </pre>
                              </div>
                            ) : null}

                            {/* Full metadata (read-only pretty view) */}
                            <div data-studio-pow-metadata-view>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                  Metadata ({metaKeys.length} key
                                  {metaKeys.length === 1 ? "" : "s"})
                                </div>
                              </div>
                              {metaKeys.length === 0 ? (
                                <p className="text-xs text-neutral-600">No metadata on this row.</p>
                              ) : (
                                <pre
                                  className="max-h-64 overflow-auto rounded-none border border-neutral-800 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-neutral-300"
                                  data-studio-pow-metadata-json
                                >
                                  {JSON.stringify(meta, null, 2)}
                                </pre>
                              )}
                            </div>

                            {item.bandPowers &&
                            typeof item.bandPowers === "object" &&
                            Object.keys(item.bandPowers).length > 0 ? (
                              <div data-studio-pow-band-powers>
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                  Band powers
                                </div>
                                <pre className="max-h-32 overflow-auto rounded-none border border-neutral-800 bg-black/40 p-2 font-mono text-[11px] text-neutral-400">
                                  {JSON.stringify(item.bandPowers, null, 2)}
                                </pre>
                              </div>
                            ) : null}

                            {/* Edit */}
                            <div
                              className="space-y-2 rounded-none border border-neutral-800 p-3"
                              data-studio-pow-edit
                            >
                              <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                Edit / invalidate
                              </div>
                              <label className="block text-[11px] text-neutral-500">
                                Tool name
                                <input
                                  className="mt-1 w-full rounded-none border border-neutral-700 bg-black/40 px-2 py-1 text-xs text-neutral-200"
                                  value={editToolName}
                                  onChange={(e) => setEditToolName(e.target.value)}
                                  data-studio-edit-tool-name
                                />
                              </label>
                              <label className="block text-[11px] text-neutral-500">
                                Tool action
                                <input
                                  className="mt-1 w-full rounded-none border border-neutral-700 bg-black/40 px-2 py-1 text-xs text-neutral-200"
                                  value={editToolAction}
                                  onChange={(e) => setEditToolAction(e.target.value)}
                                  data-studio-edit-tool-action
                                />
                              </label>
                              <label className="block text-[11px] text-neutral-500">
                                Metadata (JSON — editable)
                                <textarea
                                  className="mt-1 h-48 w-full rounded-none border border-neutral-700 bg-black/40 p-2 font-mono text-[11px] text-neutral-300"
                                  value={editMeta}
                                  onChange={(e) => setEditMeta(e.target.value)}
                                  data-studio-edit-metadata
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-none border border-neutral-600 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                                  disabled={saving}
                                  onClick={() => void saveEdit()}
                                  data-studio-save-edit
                                >
                                  {saving ? "Saving…" : "Save edits"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-none border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-950/50 disabled:opacity-40"
                                  disabled={saving}
                                  onClick={() => void saveEdit({ invalidate: true })}
                                  data-studio-invalidate
                                >
                                  Flag invalidated
                                </button>
                                <button
                                  type="button"
                                  className="rounded-none border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 disabled:opacity-40"
                                  disabled={saving}
                                  onClick={() => void saveEdit({ clearInvalidated: true })}
                                  data-studio-clear-invalidated
                                >
                                  Clear invalidated
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {totalCount} row{totalCount === 1 ? "" : "s"} · page {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-none border border-neutral-700 px-2 py-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-none border border-neutral-700 px-2 py-1 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
