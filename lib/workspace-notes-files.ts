/**
 * Helpers for creating separate markdown note files in the workspace files list.
 */

export type NamedFile = { file_name: string };

/** Pick notes.md, notes-2.md, … that is not already used. */
export function nextNotesFileName(existing: readonly NamedFile[]): string {
  const used = new Set(
    existing.map((f) => f.file_name.trim().toLowerCase()).filter(Boolean),
  );
  if (!used.has("notes.md")) return "notes.md";
  let n = 2;
  while (used.has(`notes-${n}.md`)) n += 1;
  return `notes-${n}.md`;
}

/** MIME types treated as inline-editable note files. */
export function isInlineNotesMime(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  return (
    m === "text/markdown" ||
    m === "text/x-markdown" ||
    m === "text/plain" ||
    m.startsWith("text/")
  );
}

export const NOTES_FILE_MIME = "text/markdown";
export const NOTES_FILE_STARTER = "# Notes\n\n";

/** UTF-8 text → base64 for the workspace files upload API. */
export function textToBase64Utf8(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
