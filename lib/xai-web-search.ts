/**
 * xAI Responses web_search for Helios resource finding.
 */

import { callXaiResponses, DEFAULT_MODEL } from "@/lib/xai-client";

export type XaiWebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type XaiWebSearchResult = {
  query: string;
  summary: string;
  hits: XaiWebSearchHit[];
};

const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

export function urlsFromSearchText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const source = String(text || "");
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE);
  while ((match = re.exec(source))) {
    const url = match[0].replace(/[.,;:]+$/, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function citationsFromRaw(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const bags: unknown[] = [];
  if (Array.isArray(rec.citations)) bags.push(...rec.citations);
  if (Array.isArray(rec.output)) {
    for (const item of rec.output) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.url === "string") bags.push(row.url);
      if (Array.isArray(row.citations)) bags.push(...row.citations);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of bags) {
    let url = "";
    if (typeof item === "string") url = item.trim();
    else if (item && typeof item === "object") {
      url = String(
        (item as { url?: unknown; uri?: unknown }).url ??
          (item as { uri?: unknown }).uri ??
          "",
      ).trim();
    }
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function parseXaiWebSearchResult(
  query: string,
  text: string,
  raw?: unknown,
): XaiWebSearchResult {
  const summary = String(text || "").trim().slice(0, 4000);
  const urls = [...citationsFromRaw(raw), ...urlsFromSearchText(summary)];
  const seen = new Set<string>();
  const hits: XaiWebSearchHit[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    hits.push({ title: titleFromUrl(url), url, snippet: "" });
    if (hits.length >= 8) break;
  }
  return { query: String(query || "").trim(), summary, hits };
}

export function formatHeliosSearchResultsForPrompt(
  results: XaiWebSearchResult[],
): string {
  if (results.length === 0) return "";
  const blocks = results.map((result) => {
    const hits =
      result.hits
        .map((hit) => `- ${hit.title} ${hit.url}`)
        .join("\n") || "(no URLs)";
    return [
      `Query: ${result.query}`,
      result.summary ? `Summary:\n${result.summary}` : "",
      `URLs:\n${hits}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [
    "SEARCH RESULTS",
    "Summarize these for the author and ask which to attach as a link or file on a content block.",
    "Do not attach until the author confirms, unless they already named the exact resource.",
    ...blocks,
  ].join("\n\n");
}

export async function searchXaiWeb(
  query: string,
  opts?: { apiKey?: string | null },
): Promise<XaiWebSearchResult> {
  const q = String(query || "").trim();
  if (!q) return { query: "", summary: "", hits: [] };
  const ai = await callXaiResponses({
    model: DEFAULT_MODEL,
    instructions:
      "Search the live web. Return useful resources with titles, URLs, and one line on why each matters. Prefer primary sources, PDFs, and official docs.",
    input: [{ role: "user", content: q }],
    tools: [{ type: "web_search" }],
    maxOutputTokens: 2000,
    temperature: 0.2,
    fetchTimeout: 60_000,
    apiKey: opts?.apiKey,
  });
  const text = ai.text || "";
  if (!ai.success && !ai.raw) {
    return {
      query: q,
      summary: ai.error || "search_failed",
      hits: [],
    };
  }
  const parsed = parseXaiWebSearchResult(q, text, ai.raw);
  if (!parsed.summary && ai.error) {
    return { ...parsed, summary: ai.error };
  }
  return parsed;
}
