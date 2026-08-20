"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assembleFocusedBlockPromptContext,
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

/**
 * Local block knowledge inspection + optional authoring.
 * Shown when an existing block is selected on the map (builder and consumer).
 * Empty-cell Add drawer only shows “Create a base block first”; attach/save
 * happens here after the block exists. Saved local_context is always
 * surfaced as already-attached materials when present.
 */
export function WorkspaceBlockLocalContextPanel({
  canEdit,
  blockId,
  blockTitle,
  blockDescription,
  blockStatus,
  lockUntilTitles,
  localContext,
  workspaceTitle,
  rootTopic,
  workspaceGoal,
  workspaceDescription,
  notes,
  workspaceFiles,
  blocks,
  unusableCells,
  onSaveLocalContext,
  busy,
  /** @deprecated Prompt impact is rendered in WorkspaceBlockDetailTabs */
  showPromptImpact = false,
}: {
  canEdit: boolean;
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  blockStatus?: string | null;
  lockUntilTitles?: string[];
  localContext?: BlockLocalContextInput | null;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  workspaceFiles?: WorkspaceFileContextItem[] | null;
  blocks?: Parameters<typeof assembleFocusedBlockPromptContext>[0]["blocks"];
  unusableCells?: Array<{ row: number; col: number }> | null;
  onSaveLocalContext?: (
    blockId: string,
    next: BlockLocalContextInput,
  ) => Promise<void> | void;
  busy?: boolean;
  showPromptImpact?: boolean;
}) {
  void showPromptImpact;
  void workspaceTitle;
  void rootTopic;
  void workspaceGoal;
  void workspaceDescription;
  void notes;
  void blocks;
  void unusableCells;

  const initial = normalizeBlockLocalContext(localContext);
  const [localNotes, setLocalNotes] = useState(initial.notes || "");
  const [globalRefs, setGlobalRefs] = useState<string[]>(initial.globalFileRefs);
  const [localFileName, setLocalFileName] = useState("");
  const [localFileExcerpt, setLocalFileExcerpt] = useState("");
  const [localFiles, setLocalFiles] = useState(initial.localFiles);
  const [externalResourceIds, setExternalResourceIds] = useState<string[]>(
    initial.externalResourceIds,
  );
  const [saving, setSaving] = useState(false);

  // Reset draft when the selected block or its saved local_context changes.
  // Without this, switching blocks keeps the previous draft and Save can
  // write block A's materials onto block B.
  // Serialize localContext so parent re-renders with equal content do not wipe typing.
  const localContextKey = useMemo(
    () => JSON.stringify(localContext ?? null),
    [localContext],
  );
  useEffect(() => {
    const next = normalizeBlockLocalContext(
      localContextKey ? (JSON.parse(localContextKey) as BlockLocalContextInput) : null,
    );
    setLocalNotes(next.notes || "");
    setGlobalRefs(next.globalFileRefs);
    setLocalFiles(next.localFiles);
    setExternalResourceIds(next.externalResourceIds);
    setLocalFileName("");
    setLocalFileExcerpt("");
  }, [blockId, localContextKey]);

  const fileNames = useMemo(
    () => (workspaceFiles || []).map((f) => f.name).filter(Boolean),
    [workspaceFiles],
  );

  // File refs attached to the block but not currently in the workspace file list
  // (still show as already attached so create-time attach is never invisible).
  const orphanFileRefs = useMemo(() => {
    const known = new Set(fileNames.map((n) => n.toLowerCase()));
    return globalRefs.filter((r) => !known.has(r.toLowerCase()));
  }, [fileNames, globalRefs]);

  const draft: BlockLocalContextInput = {
    notes: localNotes.trim() || null,
    local_files: localFiles,
    global_file_refs: globalRefs,
    external_resource_ids: externalResourceIds.length ? externalResourceIds : null,
  };

  const draftNormalized = normalizeBlockLocalContext(draft);
  const hasAttached = draftNormalized.hasLocalMaterials;
  const savedNormalized = normalizeBlockLocalContext(localContext);
  const dirty =
    (draftNormalized.notes || "") !== (savedNormalized.notes || "") ||
    JSON.stringify(draftNormalized.globalFileRefs) !==
      JSON.stringify(savedNormalized.globalFileRefs) ||
    JSON.stringify(draftNormalized.localFiles) !==
      JSON.stringify(savedNormalized.localFiles) ||
    JSON.stringify(draftNormalized.externalResourceIds) !==
      JSON.stringify(savedNormalized.externalResourceIds);

  const assembled = assembleFocusedBlockPromptContext({
    workspaceTitle,
    rootTopic,
    workspaceGoal,
    workspaceDescription,
    notes,
    files: workspaceFiles,
    blocks,
    focusedBlockId: blockId,
    blockTitle,
    blockDescription,
    blockLocalContext: draft,
    unusableCells,
  });

  const save = async () => {
    if (!canEdit || !onSaveLocalContext || !dirty) return;
    setSaving(true);
    try {
      await onSaveLocalContext(blockId, draft);
    } finally {
      setSaving(false);
    }
  };

  const toggleRef = (name: string) => {
    setGlobalRefs((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const addLocalFile = () => {
    const name = localFileName.trim();
    if (!name) return;
    setLocalFiles((prev) => [
      ...prev.filter((f) => f.name.toLowerCase() !== name.toLowerCase()),
      { name, excerpt: localFileExcerpt.trim() || null },
    ]);
    setLocalFileName("");
    setLocalFileExcerpt("");
  };

  const externalLocalFiles = localFiles.filter((f) =>
    f.name.toLowerCase().startsWith("[external]"),
  );
  const pureLocalFiles = localFiles.filter(
    (f) => !f.name.toLowerCase().startsWith("[external]"),
  );

  return (
    <div
      data-workspace-block-local-context
      data-block-id={blockId}
      data-has-local-section={hasAttached ? "true" : "false"}
      data-has-attached-local={hasAttached ? "true" : "false"}
      className="space-y-2.5"
    >
      <div className="space-y-0.5" data-block-local-summary>
        {lockUntilTitles && lockUntilTitles.length > 0 ? (
          <p className="text-[11px] text-neutral-300/80" data-block-lock-until>
            Locked until: {lockUntilTitles.join(", ")}
          </p>
        ) : null}
        {blockStatus ? (
          <p className="text-[10px] text-neutral-600">Status: {blockStatus}</p>
        ) : null}
      </div>

      {/* Always show what is already attached (create-time + later edits). */}
      <div
        data-block-local-attached
        className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Already attached
        </p>
        {!hasAttached ? (
          <p className="text-[11px] text-neutral-600" data-block-local-attached-empty>
            Nothing attached yet. Materials chosen when creating this block (or saved
            below) show here.
          </p>
        ) : (
          <ul className="space-y-1.5 text-[11px] text-neutral-300" data-block-local-attached-list>
            {localNotes.trim() ? (
              <li data-attached-kind="notes" className="space-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Notes
                </span>
                <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed text-neutral-300">
                  {localNotes.trim()}
                </pre>
              </li>
            ) : null}
            {globalRefs.length > 0 ? (
              <li data-attached-kind="files">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Workspace files
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {globalRefs.map((name) => (
                    <span
                      key={name}
                      data-attached-file={name}
                      className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-200"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </li>
            ) : null}
            {externalLocalFiles.length > 0 || externalResourceIds.length > 0 ? (
              <li data-attached-kind="external">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  External sources
                </span>
                <ul className="mt-1 space-y-1">
                  {externalLocalFiles.map((f) => (
                    <li
                      key={f.name}
                      data-attached-external={f.name}
                      className="rounded border border-white/10 bg-neutral-900/60 px-1.5 py-1"
                    >
                      <span className="block truncate font-medium text-neutral-200">
                        {f.name.replace(/^\[external\]\s*/i, "")}
                      </span>
                      {f.excerpt ? (
                        <span className="mt-0.5 block line-clamp-2 text-[10px] text-neutral-500">
                          {f.excerpt}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {externalResourceIds.length > 0 && externalLocalFiles.length === 0
                    ? externalResourceIds.map((id) => (
                        <li
                          key={id}
                          data-attached-external-id={id}
                          className="truncate text-neutral-400"
                        >
                          External id: {id}
                        </li>
                      ))
                    : null}
                </ul>
              </li>
            ) : null}
            {pureLocalFiles.length > 0 ? (
              <li data-attached-kind="local_files">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Local materials
                </span>
                <ul className="mt-1 space-y-1">
                  {pureLocalFiles.map((f) => (
                    <li
                      key={f.name}
                      data-attached-local-file={f.name}
                      className="rounded border border-white/10 bg-neutral-900/60 px-1.5 py-1"
                    >
                      <span className="block truncate font-medium text-neutral-200">
                        {f.name}
                      </span>
                      {f.excerpt ? (
                        <span className="mt-0.5 block line-clamp-2 text-[10px] text-neutral-500">
                          {f.excerpt}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {canEdit ? (
        <div data-block-local-authoring className="space-y-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {hasAttached ? "Edit local context" : "Attach local context"}
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] text-neutral-500">Block notes</span>
            <textarea
              data-block-local-notes
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
              placeholder="Notes only this block should feed into prompts…"
            />
          </label>

          {fileNames.length > 0 || orphanFileRefs.length > 0 ? (
            <div className="space-y-1" data-block-global-refs>
              <p className="text-[11px] text-neutral-500">
                Reference workspace files (from global Context)
              </p>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-neutral-800 p-2">
                {fileNames.map((name) => (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      data-global-file-ref={name}
                      checked={globalRefs.some(
                        (r) => r.toLowerCase() === name.toLowerCase(),
                      )}
                      onChange={() => toggleRef(name)}
                    />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
                {orphanFileRefs.map((name) => (
                  <label
                    key={`orphan-${name}`}
                    className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      data-global-file-ref={name}
                      data-orphan-file-ref
                      checked
                      onChange={() => toggleRef(name)}
                    />
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 text-[9px] uppercase text-neutral-600">
                      attached
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-600">
              No workspace files yet — add them under the Context tab, then reference them here.
            </p>
          )}

          <div className="space-y-1.5" data-block-local-files>
            <p className="text-[11px] text-neutral-500">Local-only material (name + optional excerpt)</p>
            <div className="flex flex-col gap-1.5 sm:flex-row">
              <input
                data-local-file-name
                value={localFileName}
                onChange={(e) => setLocalFileName(e.target.value)}
                placeholder="snippet.md"
                className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
              />
              <button
                type="button"
                data-local-file-add
                onClick={addLocalFile}
                className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs text-white"
              >
                Add
              </button>
            </div>
            <textarea
              data-local-file-excerpt
              value={localFileExcerpt}
              onChange={(e) => setLocalFileExcerpt(e.target.value)}
              rows={2}
              placeholder="Optional excerpt substance…"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
            />
            {localFiles.length > 0 ? (
              <ul className="space-y-1 text-[11px] text-neutral-400">
                {localFiles.map((f) => (
                  <li key={f.name} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="text-neutral-500 hover:text-white"
                      onClick={() => {
                        setLocalFiles((prev) => prev.filter((x) => x.name !== f.name));
                        // Drop matching external id if this was an external attach chip.
                        if (f.name.toLowerCase().startsWith("[external]")) {
                          // External ids are independent; leave ids unless user clears all externals.
                        }
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {externalResourceIds.length > 0 ? (
              <div className="space-y-1" data-block-external-ids>
                <p className="text-[10px] text-neutral-600">
                  External resource links ({externalResourceIds.length})
                </p>
                <button
                  type="button"
                  data-block-clear-external
                  className="text-[10px] text-neutral-500 underline hover:text-neutral-300"
                  onClick={() => {
                    setExternalResourceIds([]);
                    setLocalFiles((prev) =>
                      prev.filter((f) => !f.name.toLowerCase().startsWith("[external]")),
                    );
                  }}
                >
                  Clear external sources
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            data-block-local-save
            disabled={saving || busy || !dirty || !onSaveLocalContext}
            onClick={() => void save()}
            className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "Saving…"
              : dirty
                ? "Save context to this block"
                : "Saved to this block"}
          </button>
        </div>
      ) : (
        <div data-block-local-readonly className="space-y-1">
          {assembled.hasLocalContext ? (
            <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-neutral-300">
              {assembled.localContextLines.join("\n")}
            </pre>
          ) : (
            <p className="text-[11px] text-neutral-500">
              This block has no local materials. Prompts use workspace-wide context only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
