"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";

interface PlanFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface PlanFilesTabProps {
  planId: string;
  isOwner: boolean;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PlanFilesTab({ planId, isOwner }: PlanFilesTabProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Pending files staged for upload
  const [pendingFiles, setPendingFiles] = useState<AttachedFile[]>([]);

  const MAX_FILES = 5;
  const atLimit = files.length >= MAX_FILES;

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/learning-plan/files?planId=${planId}`);
      const data = await res.json();
      if (data.files) setFiles(data.files);
    } catch {
      setError(t('planFiles.loadError'));
    } finally {
      setLoading(false);
    }
  }, [planId, t]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of pendingFiles) {
        const res = await fetch("/api/learning-plan/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            fileName: f.name,
            mimeType: f.mimeType,
            data: f.data,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || t('planFiles.uploadError'));
          break;
        }
      }
      setPendingFiles([]);
      await loadFiles();
    } catch {
      setError(t('planFiles.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await fetch(`/api/learning-plan/files?fileId=${fileId}`, { method: "DELETE" });
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch {
      setError(t('planFiles.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file: PlanFile) => {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/learning-plan/files?fileId=${file.id}&download=1`);
      if (!res.ok) {
        setError(t('planFiles.downloadError'));
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
      setError(t('planFiles.downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-500 text-sm">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-4 p-1">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">{t('planFiles.title')}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{t('planFiles.subtitle')}</p>
          </div>
          <span className="text-xs text-neutral-600">{files.length} / {MAX_FILES}</span>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Existing files list */}
        {files.length > 0 ? (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 bg-neutral-900/60 border border-neutral-800 rounded-xl"
              >
                <FileTypeIcon mimeType={file.mime_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.file_name}</p>
                  <p className="text-xs text-neutral-500">{formatBytes(file.file_size)} · {formatDate(file.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {downloadingId === file.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    {t('planFiles.download')}
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deletingId === file.id}
                      className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      title={t('planFiles.removeFile')}
                    >
                      {deletingId === file.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isOwner && (
            <div className="flex flex-col items-center gap-3 py-16 text-neutral-600">
              <svg className="w-8 h-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <span className="text-sm">{t('planFiles.noFiles')}</span>
            </div>
          )
        )}

        {/* Upload zone for owners */}
        {isOwner && !atLimit && (
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <p className="text-xs text-neutral-500">{t('planFiles.addFilesHint')}</p>
            <FileDropZone
              files={pendingFiles}
              onChange={setPendingFiles}
            />
            {pendingFiles.length > 0 && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('planFiles.uploading')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    {t('planFiles.uploadFiles')} ({pendingFiles.length})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {isOwner && atLimit && (
          <p className="text-xs text-amber-400/80 pt-2 border-t border-neutral-800">
            {t('planFiles.fileLimitReached')}
          </p>
        )}

        {/* Empty state for owners with no files */}
        {isOwner && files.length === 0 && !atLimit && (
          <p className="text-xs text-neutral-500 -mt-2">{t('planFiles.noFiles')}</p>
        )}
      </div>
    </div>
  );
}
