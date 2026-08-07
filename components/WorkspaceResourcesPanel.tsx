"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface PlanFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface WorkspaceResourcesPanelProps {
  workspaceId: string;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return (
      <svg className="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceResourcesPanel({ workspaceId }: WorkspaceResourcesPanelProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workspace/files?workspaceId=${workspaceId}`)
      .then(r => r.json())
      .then(data => {
        if (data.files) setFiles(data.files);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleDownload = async (file: PlanFile) => {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/workspace/files?fileId=${file.id}&download=1`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="px-3 py-2 border-b border-neutral-800/60">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            {t('tools.planResources')}
          </span>
        </div>
        <p className="text-[10px] text-neutral-600 mt-0.5">{t('workspaceFiles.resourcesDesc')}</p>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-neutral-600 text-xs">
            {t('common.loading')}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-neutral-600">
            <svg className="w-6 h-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
            <span className="text-xs text-center">{t('workspaceFiles.noResourcesInSession')}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => handleDownload(file)}
                disabled={downloadingId === file.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-neutral-800/60 transition-colors group disabled:opacity-60"
              >
                <FileTypeIcon mimeType={file.mime_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-300 truncate group-hover:text-white transition-colors">
                    {file.file_name}
                  </p>
                  <p className="text-[10px] text-neutral-600">{formatBytes(file.file_size)}</p>
                </div>
                {downloadingId === file.id ? (
                  <svg className="w-3.5 h-3.5 text-neutral-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
