/**
 * Product-boundary stored file identity.
 * Postgres `xai_file_id` is an opaque storage key. Keep this module free of
 * Node/xAI client imports so dashboard middleware can stay on Edge.
 */
const XAI_FILE_ID_RE =
  /^file_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FS_ID_RE = /^fs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEM_ID_RE = /^mem_\d+$/i;

/** True when the value looks like a real xAI Files API id (not a test placeholder). */
export function isXaiFileId(value: string | null | undefined): value is string {
  return typeof value === "string" && XAI_FILE_ID_RE.test(value.trim());
}

export function isStoredFileId(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!id) return false;
  return isXaiFileId(id) || FS_ID_RE.test(id) || MEM_ID_RE.test(id);
}
