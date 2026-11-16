/**
 * Product-boundary stored file identity.
 * Postgres `xai_file_id` is an opaque storage key. The xAI adapter still
 * validates `file_<uuid>` internally.
 */
import { isXaiFileId } from "@/lib/xai-files";

const FS_ID_RE = /^fs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEM_ID_RE = /^mem_\d+$/i;

export function isStoredFileId(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!id) return false;
  return isXaiFileId(id) || FS_ID_RE.test(id) || MEM_ID_RE.test(id);
}
