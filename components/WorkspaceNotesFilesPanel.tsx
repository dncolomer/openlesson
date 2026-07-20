"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/lib/i18n";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  buildWorkspaceResourceList,
  type WorkspaceFileListEntry,
} from "@/lib/workspace-resource-list";
import {
  isInlineNotesMime,
  nextNotesFileName,
  NOTES_FILE_MIME,
  NOTES_FILE_STARTER,
  textToBase64Utf8,
} from "@/lib/workspace-notes-files";

interface WorkspaceNotesFilesPanelProps {
  notesContent: string;
  setNotesContent: (value: string) => void;
  isEditingNotes: boolean;
  setIsEditingNotes: (value: boolean) => void;
  savingNotes: boolean;
  onSaveNotes: () => void | Promise<void>;
  onCancelNotes: () => void;
  isOwner: boolean;
  workspaceId: string;
  /** When false, hide files (e.g. AYCL token sessions without files API auth). */
  showFiles?: boolean;
}

function FileTypeIcon({ mimeType, className = "w-5 h-5" }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) {
    return (
      <svg className={`${className} text-violet-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className={`${className} text-red-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg className={`${className} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function NotesTypeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function notesPreview(content: string): string {
  const plain = content
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 72 ? `${plain.slice(0, 72)}…` : plain;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Unified Notes + Files list for the Workspace section.
 * "New notes file" creates a separate markdown attachment (not the single workspace notes field).
 */
export function WorkspaceNotesFilesPanel({
  notesContent,
  setNotesContent,
  isEditingNotes,
  setIsEditingNotes,
  savingNotes,
  onSaveNotes,
  onCancelNotes,
  isOwner,
  workspaceId,
  showFiles = true,
}: WorkspaceNotesFilesPanelProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<WorkspaceFileListEntry[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(showFiles);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);
  const [creatingNotesFile, setCreatingNotesFile] = useState(false);
  /** File id currently open for inline notes edit (separate from workspace notes). */
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileEditName, setFileEditName] = useState("");
  const [fileEditContent, setFileEditContent] = useState("");
  const [fileEditLoading, setFileEditLoading] = useState(false);
  const [savingFileId, setSavingFileId] = useState<string | null>(null);

  const MAX_FILES = 5;
  const atLimit = files.length >= MAX_FILES;

  const loadFiles = useCallback(async () => {
    if (!showFiles) {
      setLoadingFiles(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspace/files?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (data.files) setFiles(data.files);
    } catch {
      setError(t("workspaceFiles.loadError"));
    } finally {
      setLoadingFiles(false);
    }
  }, [workspaceId, t, showFiles]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const listItems = useMemo(
    () =>
      buildWorkspaceResourceList({
        notes: notesContent,
        files,
        includeNotes: true,
        includeFiles: showFiles,
      }),
    [notesContent, files, showFiles],
  );

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of pendingFiles) {
        const res = await fetch("/api/workspace/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            fileName: f.name,
            mimeType: f.mimeType,
            data: f.data,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || t("workspaceFiles.uploadError"));
          break;
        }
      }
      setPendingFiles([]);
      await loadFiles();
    } catch {
      setError(t("workspaceFiles.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await fetch(`/api/workspace/files?fileId=${fileId}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (editingFileId === fileId) {
        setEditingFileId(null);
        setFileEditContent("");
      }
    } catch {
      setError(t("workspaceFiles.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file: WorkspaceFileListEntry) => {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/workspace/files?fileId=${file.id}&download=1`);
      if (!res.ok) {
        setError(t("workspaceFiles.downloadError"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("workspaceFiles.downloadError"));
    } finally {
      setDownloadingId(null);
    }
  };

  const openFileEditor = async (file: WorkspaceFileListEntry) => {
    if (!isInlineNotesMime(file.mime_type)) return;
    setEditingFileId(file.id);
    setFileEditName(file.file_name);
    setFileEditContent("");
    setFileEditLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/files?fileId=${file.id}&download=1`);
      if (!res.ok) {
        setError(t("workspaceFiles.downloadError"));
        setEditingFileId(null);
        return;
      }
      const text = await res.text();
      setFileEditContent(text);
    } catch {
      setError(t("workspaceFiles.downloadError"));
      setEditingFileId(null);
    } finally {
      setFileEditLoading(false);
    }
  };

  const cancelFileEditor = () => {
    setEditingFileId(null);
    setFileEditContent("");
    setFileEditName("");
  };

  /** Replace note file content: delete old row + upload new markdown with same name. */
  const saveFileEditor = async (file: WorkspaceFileListEntry) => {
    setSavingFileId(file.id);
    setError(null);
    try {
      const fileName = fileEditName.trim() || file.file_name;
      const mimeType = isInlineNotesMime(file.mime_type) ? file.mime_type : NOTES_FILE_MIME;
      // API rejects empty base64; keep a newline so blank notes still save.
      const data = textToBase64Utf8(fileEditContent.length > 0 ? fileEditContent : "\n");

      // Upload first so we don't lose content if delete succeeds and upload fails.
      const createRes = await fetch("/api/workspace/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName,
          mimeType,
          data,
        }),
      });
      if (!createRes.ok) {
        // At file limit: delete old first then re-upload.
        if (createRes.status === 400 && atLimit) {
          await fetch(`/api/workspace/files?fileId=${file.id}`, { method: "DELETE" });
          const retry = await fetch("/api/workspace/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId, fileName, mimeType, data }),
          });
          if (!retry.ok) {
            const err = await retry.json().catch(() => ({}));
            setError(err.error || t("workspaceFiles.uploadError"));
            return;
          }
        } else {
          const err = await createRes.json().catch(() => ({}));
          setError(err.error || t("workspaceFiles.uploadError"));
          return;
        }
      } else {
        // New copy created; remove previous version.
        await fetch(`/api/workspace/files?fileId=${file.id}`, { method: "DELETE" });
      }

      setEditingFileId(null);
      setFileEditContent("");
      await loadFiles();
    } catch {
      setError(t("workspaceFiles.uploadError"));
    } finally {
      setSavingFileId(null);
    }
  };

  /**
   * Create a brand-new separate markdown file in the workspace files list,
   * then open it for inline editing.
   */
  const createNotesFile = async () => {
    if (!showFiles || !isOwner) return;
    if (atLimit) {
      setError(t("workspaceFiles.fileLimitReached"));
      return;
    }
    setCreatingNotesFile(true);
    setError(null);
    setIsEditingNotes(false);
    try {
      const fileName = nextNotesFileName(files);
      const res = await fetch("/api/workspace/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName,
          mimeType: NOTES_FILE_MIME,
          data: textToBase64Utf8(NOTES_FILE_STARTER),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("workspaceFiles.uploadError"));
        return;
      }
      await loadFiles();
      const created = data.file as WorkspaceFileListEntry | undefined;
      if (created?.id) {
        setEditingFileId(created.id);
        setFileEditName(created.file_name);
        setFileEditContent(NOTES_FILE_STARTER);
      }
    } catch {
      setError(t("workspaceFiles.uploadError"));
    } finally {
      setCreatingNotesFile(false);
    }
  };

  if (showFiles && loadingFiles) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <LoadingStatusMessage size="sm" tone="subtle" message={t("common.loading")} />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-neutral-800/70 bg-neutral-950/80 p-3 shadow-lg shadow-black/20 backdrop-blur-md sm:p-4"
      data-workspace-notes-files-panel
      data-unified-resource-list
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-medium text-white">
          {t("planView.notes")}
          {showFiles ? ` · ${t("planView.files")}` : ""}
        </h3>
        {showFiles ? (
          <span className="text-xs text-neutral-600">
            {files.length} / {MAX_FILES}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2" role="list" data-resource-list>
        {listItems.map((item) => {
          if (item.kind === "notes") {
            const preview = notesPreview(item.content);
            const subtitle = item.content
              ? preview || t("planView.notes")
              : isOwner
                ? t("planView.addNotes")
                : t("planView.noNotes");

            return (
              <li
                key={item.id}
                role="listitem"
                data-resource-kind="notes"
                data-resource-row="attachment"
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <NotesTypeIcon />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {item.content ? `${t("planView.notes")}.md` : t("planView.notes")}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{subtitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingNotes) onCancelNotes();
                          else {
                            setEditingFileId(null);
                            setIsEditingNotes(true);
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
                      >
                        {isEditingNotes
                          ? t("common.cancel")
                          : item.content
                            ? t("common.edit")
                            : t("planView.addNotes")}
                      </button>
                    ) : item.content ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                        className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
                      >
                        {isEditingNotes ? t("common.cancel") : "Open"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {isEditingNotes && isOwner ? (
                  <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder={t("planView.notesPlaceholder")}
                      className="h-[min(32vh,16rem)] w-full resize-none rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 font-mono text-sm text-white focus:border-neutral-400 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void onSaveNotes()}
                        disabled={savingNotes}
                        className="rounded-md bg-white px-3 py-1.5 text-sm text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-white"
                      >
                        {savingNotes ? t("common.saving") : t("common.save")}
                      </button>
                      <button
                        type="button"
                        onClick={onCancelNotes}
                        className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-700"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isEditingNotes && !isOwner && item.content ? (
                  <div className="prose prose-invert prose-sm mt-3 max-w-none border-t border-neutral-800 pt-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                  </div>
                ) : null}
              </li>
            );
          }

          const isEditingThis = editingFileId === item.id;
          const canInlineEdit = isInlineNotesMime(item.mime_type);

          return (
            <li
              key={item.id}
              role="listitem"
              data-resource-kind="file"
              data-resource-row="attachment"
              data-notes-file={canInlineEdit ? "true" : undefined}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <FileTypeIcon mimeType={item.mime_type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{item.file_name}</p>
                  <p className="text-xs text-neutral-500">
                    {formatBytes(item.file_size)} · {formatDate(item.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canInlineEdit && isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingThis) cancelFileEditor();
                        else void openFileEditor(item);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
                    >
                      {isEditingThis ? t("common.cancel") : t("common.edit")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDownload(item)}
                    disabled={downloadingId === item.id}
                    className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-50"
                  >
                    {t("workspaceFiles.download")}
                  </button>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-neutral-600 transition-colors hover:text-red-400 disabled:opacity-50"
                      title={t("workspaceFiles.removeFile")}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>

              {isEditingThis ? (
                <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3" data-inline-notes-editor>
                  {fileEditLoading ? (
                    <LoadingStatusMessage size="sm" tone="subtle" message={t("common.loading")} />
                  ) : (
                    <>
                      <input
                        type="text"
                        value={fileEditName}
                        onChange={(e) => setFileEditName(e.target.value)}
                        className="w-full rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
                        aria-label="File name"
                      />
                      <textarea
                        value={fileEditContent}
                        onChange={(e) => setFileEditContent(e.target.value)}
                        placeholder={t("planView.notesPlaceholder")}
                        className="h-[min(32vh,16rem)] w-full resize-none rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 font-mono text-sm text-white focus:border-neutral-400 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveFileEditor(item)}
                          disabled={savingFileId === item.id}
                          className="rounded-md bg-white px-3 py-1.5 text-sm text-black transition-colors hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-white"
                        >
                          {savingFileId === item.id ? t("common.saving") : t("common.save")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelFileEditor}
                          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-700"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isOwner && showFiles && !atLimit ? (
        <button
          type="button"
          data-create-notes-file-row
          onClick={() => void createNotesFile()}
          disabled={creatingNotesFile}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/30 px-4 py-3 text-left transition-colors hover:border-neutral-500 hover:bg-neutral-900/60 disabled:opacity-40"
        >
          <NotesTypeIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">New notes file</p>
            <p className="text-xs text-neutral-500">
              Creates a separate markdown file in this list ({nextNotesFileName(files)})
            </p>
          </div>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
        </button>
      ) : null}

      {showFiles && isOwner && !atLimit ? (
        <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
          <p className="text-xs text-neutral-500">{t("workspaceFiles.addFilesHint")}</p>
          <FileDropZone files={pendingFiles} onChange={setPendingFiles} />
          {pendingFiles.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:bg-neutral-700"
            >
              {uploading
                ? t("workspaceFiles.uploading")
                : `${t("workspaceFiles.uploadFiles")} (${pendingFiles.length})`}
            </button>
          ) : null}
        </div>
      ) : null}

      {showFiles && isOwner && atLimit ? (
        <p className="mt-3 border-t border-neutral-800 pt-3 text-xs text-amber-400/80">
          {t("workspaceFiles.fileLimitReached")}
        </p>
      ) : null}
    </div>
  );
}
