"use client";

import { useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

export interface AttachedFile {
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
  preview?: string; // data URL for images
}

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "text/x-markdown": "MD",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

interface FileDropZoneProps {
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  /** Show inline as a compact add-more row (used in PlanFilesTab) */
  compact?: boolean;
  className?: string;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return (
      <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  // text / markdown
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropZone({ files, onChange, compact = false, className = "" }: FileDropZoneProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = files.length >= MAX_FILES;

  const processFile = useCallback((file: File): Promise<AttachedFile | null> => {
    return new Promise((resolve) => {
      if (!ALLOWED_TYPES[file.type]) {
        setError(t('workspaceFiles.unsupportedType'));
        resolve(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(t('workspaceFiles.fileTooLarge'));
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({
          name: file.name,
          mimeType: file.type,
          data: base64,
          size: file.size,
          preview: file.type.startsWith("image/") ? dataUrl : undefined,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, [t]);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    setError(null);
    const arr = Array.from(incoming);
    const slots = MAX_FILES - files.length;
    if (slots <= 0) {
      setError(t('workspaceFiles.fileLimitReached'));
      return;
    }
    const toProcess = arr.slice(0, slots);
    const results = await Promise.all(toProcess.map(processFile));
    const valid = results.filter(Boolean) as AttachedFile[];
    if (valid.length > 0) {
      onChange([...files, ...valid]);
    }
  }, [files, onChange, processFile, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (atLimit) { setError(t('workspaceFiles.fileLimitReached')); return; }
    addFiles(e.dataTransfer.files);
  }, [atLimit, addFiles, t]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const removeFile = useCallback((idx: number) => {
    setError(null);
    onChange(files.filter((_, i) => i !== idx));
  }, [files, onChange]);

  if (compact) {
    // Compact mode: just the file list + an "Add file" button row
    return (
      <div className={`space-y-2 ${className}`}>
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-neutral-900/60 border border-neutral-800 rounded-lg">
            <FileTypeIcon mimeType={f.mimeType} />
            {f.preview && (
              <img src={f.preview} alt={f.name} className="w-8 h-8 object-cover rounded" />
            )}
            <span className="flex-1 text-xs text-neutral-300 truncate">{f.name}</span>
            <span className="text-[10px] text-neutral-500 flex-shrink-0">{formatBytes(f.size)}</span>
            <button type="button" onClick={() => removeFile(i)} className="text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {!atLimit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 w-full text-xs text-neutral-500 hover:text-neutral-300 border border-dashed border-neutral-800 hover:border-neutral-600 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('workspaceFiles.addFiles')} ({files.length}/{MAX_FILES})
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Full drop zone mode (used on landing page)
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Drop area — only shown when not at limit */}
      {!atLimit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 px-4 py-4 border border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-500/60 bg-blue-500/5"
              : "border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/30"
          }`}
        >
          <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
          <span className="text-xs text-neutral-400">{t('workspaceFiles.dropZoneLabel')}</span>
          <span className="text-[10px] text-neutral-600">PDF, TXT, MD, JPG, PNG, WEBP · max 10 MB · {files.length}/{MAX_FILES}</span>
        </div>
      )}

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-neutral-800/70 border border-neutral-700/50 rounded-lg max-w-[200px]">
              <FileTypeIcon mimeType={f.mimeType} />
              {f.preview && (
                <img src={f.preview} alt={f.name} className="w-5 h-5 object-cover rounded" />
              )}
              <span className="text-xs text-neutral-300 truncate flex-1">{f.name}</span>
              <span className="text-[10px] text-neutral-500 flex-shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-amber-400/80">{t('workspaceFiles.fileLimitReached')}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
