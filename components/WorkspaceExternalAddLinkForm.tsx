"use client";

import { useState } from "react";
import type { ExternalResourceCreateInput } from "@/lib/workspace-external-resources";

/**
 * Explicit add-link form for Context external sources.
 */
export function WorkspaceExternalAddLinkForm({
  canEdit,
  onAdd,
  busy,
}: {
  canEdit: boolean;
  onAdd: (payload: ExternalResourceCreateInput) => Promise<void> | void;
  busy?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!canEdit) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("URL is required");
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        url: trimmed,
        title: title.trim() || null,
        source: "link",
      });
      setUrl("");
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      data-workspace-add-link-form
      onSubmit={(e) => void submit(e)}
      className="space-y-2 rounded-none border border-neutral-800/80 bg-neutral-950/90 p-3 sm:p-4"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        Add link
      </p>
      <input
        data-add-link-url
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        disabled={busy || saving}
        className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
        required
      />
      <input
        data-add-link-title
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        disabled={busy || saving}
        className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
      />
      {error ? (
        <p className="text-[11px] text-red-400" data-add-link-error>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        data-add-link-submit
        disabled={busy || saving || !url.trim()}
        className="w-full rounded-none border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
      >
        {saving ? "Adding…" : "Add external resource"}
      </button>
    </form>
  );
}
