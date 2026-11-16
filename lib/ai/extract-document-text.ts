/**
 * Best-effort text extract for portable DocumentContext.
 * Text/JSON/CSV decode as UTF-8. PDFs try `pdftotext` then a string scrape.
 * Images are described, not OCR'd.
 */
import { spawnSync } from "node:child_process";

const TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "text/csv",
  "application/xml",
  "text/xml",
  "text/html",
]);

const IMAGE_PREFIX = "image/";
const MAX_CHARS = 12_000;

export type ExtractDocumentInput = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

function mimeOf(input: ExtractDocumentInput): string {
  return (input.mimeType || "").toLowerCase().split(";")[0].trim();
}

function looksTextName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".json") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm")
  );
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    const text = Buffer.from(bytes).toString("utf8");
    if (!text.trim()) return null;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text.slice(0, 200))) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

function tryPdftotext(bytes: Uint8Array): string | null {
  try {
    const result = spawnSync("pdftotext", ["-q", "-", "-"], {
      input: Buffer.from(bytes),
      encoding: "utf8",
      timeout: 8_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout?.trim()) {
      return result.stdout.trim();
    }
  } catch {
    /* binary missing */
  }
  return null;
}

function scrapePdfStrings(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const strings: string[] = [];
  const re = /\((?:\\.|[^\\)]){3,}\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const decoded = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[\x20-\x7E]{4,}/.test(decoded)) strings.push(decoded);
  }
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

export function extractDocumentText(input: ExtractDocumentInput): string | null {
  const mime = mimeOf(input);
  const name = input.name || "file";

  if (mime.startsWith(IMAGE_PREFIX)) {
    return `[image omitted: ${name} (${mime})]`;
  }

  if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const fromTool = tryPdftotext(input.bytes);
    if (fromTool) return fromTool.slice(0, MAX_CHARS);
    const scraped = scrapePdfStrings(input.bytes);
    return scraped ? scraped.slice(0, MAX_CHARS) : `[pdf omitted: ${name}]`;
  }

  if (TEXT_MIME.has(mime) || looksTextName(name)) {
    const text = decodeUtf8(input.bytes);
    return text ? text.slice(0, MAX_CHARS) : null;
  }

  const fallback = decodeUtf8(input.bytes);
  return fallback ? fallback.slice(0, MAX_CHARS) : `[binary omitted: ${name} (${mime || "unknown"})]`;
}
