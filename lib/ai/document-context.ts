/**
 * Optional document-context port for flow-start artifacts and synthetic regions.
 * xAI adapter: Responses `input_file` ids. Portable: BlobStore.get + text extract.
 */
import { getBlobStore, isXaiBlobStore } from "@/lib/ai/blob-store";
import { extractDocumentText } from "@/lib/ai/extract-document-text";
import { capXaiFileAttachments } from "@/lib/xai-client";
import { isXaiFileId } from "@/lib/xai-files";

export type DocumentTurn = {
  extraPrompt: string;
  responsesFiles?: string[];
};

export type DocumentContext = {
  forTurn(fileIds: string[]): Promise<DocumentTurn>;
};

const MAX_PROMPT_CHARS = 48_000;
const MAX_FILE_CHARS = 12_000;

let override: DocumentContext | null = null;

export function setDocumentContextForTests(port: DocumentContext | null): void {
  override = port;
}

export function mergeDocumentContextPrompt(prompt: string, extraPrompt: string): string {
  const extra = extraPrompt.trim();
  if (!extra) return prompt;
  return `${prompt}\n\n${extra}`;
}

function cleanIds(fileIds: string[]): string[] {
  return [...new Set(fileIds.map((id) => String(id || "").trim()).filter(Boolean))];
}

async function extractPrompt(ids: string[]): Promise<string> {
  if (!ids.length) return "";
  const store = getBlobStore();
  const parts: string[] = [];
  let used = 0;
  for (const id of ids) {
    if (used >= MAX_PROMPT_CHARS) break;
    try {
      const file = await store.get(id);
      if (file.status !== 200 || !file.bytes.length) {
        parts.push(`--- ${id} ---\n[unreadable]`);
        continue;
      }
      const extracted =
        extractDocumentText({
          name: file.name,
          mimeType: file.mimeType,
          bytes: file.bytes,
        }) || `[binary omitted: ${file.name} (${file.mimeType})]`;
      const body = extracted.slice(0, Math.min(MAX_FILE_CHARS, MAX_PROMPT_CHARS - used));
      used += body.length;
      parts.push(`--- ${file.name || id} (${file.mimeType}) ---\n${body}`);
    } catch {
      parts.push(`--- ${id} ---\n[unreadable]`);
    }
  }
  if (!parts.length) return "";
  return `Attached file excerpts:\n${parts.join("\n\n")}`;
}

const xaiDocumentContext: DocumentContext = {
  async forTurn(fileIds) {
    const ids = cleanIds(fileIds);
    if (!ids.length) return { extraPrompt: "" };
    const responsesFiles = capXaiFileAttachments(ids.filter(isXaiFileId));
    const other = ids.filter((id) => !isXaiFileId(id));
    return {
      extraPrompt: await extractPrompt(other),
      responsesFiles: responsesFiles.length ? responsesFiles : undefined,
    };
  },
};

const portableDocumentContext: DocumentContext = {
  async forTurn(fileIds) {
    const ids = cleanIds(fileIds);
    if (!ids.length) return { extraPrompt: "" };
    return { extraPrompt: await extractPrompt(ids) };
  },
};

export function getDocumentContext(): DocumentContext {
  if (override) return override;
  return isXaiBlobStore() ? xaiDocumentContext : portableDocumentContext;
}
