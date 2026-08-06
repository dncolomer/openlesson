/**
 * Pure helpers for generate-in-shape context source multi-select.
 * Selection → BlockLocalContextInput + generation-context snippet.
 */

import type { BlockLocalContextInput } from "@/lib/prompt-workspace-context";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import {
  absorbExternalResourcesIntoLocalContext,
  mergeLinkBodyIntoExcerpt,
  normalizeLinkBodyText,
  type ExternalLinkAbsorbInput,
} from "@/lib/workspace-external-resources";

export type ShapeContextSourceKind = "file" | "external" | "notes";

/** One selectable row in the generate-in-shape dialog. */
export type ShapeContextSourceOption = {
  /** Stable key: "notes" | "file:<name>" | "external:<id>" */
  key: string;
  kind: ShapeContextSourceKind;
  id: string;
  label: string;
  /** Substance for generation (notes body, file excerpt, external desc). */
  excerpt?: string | null;
  url?: string | null;
  /** Workspace file name (kind=file). */
  fileName?: string | null;
};

export type ShapeContextCatalogInput = {
  notes?: string | null;
  files?: ReadonlyArray<{
    id?: string | null;
    file_name?: string | null;
    name?: string | null;
    excerpt?: string | null;
  }> | null;
  externalResources?: ReadonlyArray<{
    id: string;
    title?: string | null;
    url?: string | null;
    description?: string | null;
  }> | null;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export function shapeContextSourceKey(
  kind: ShapeContextSourceKind,
  id: string,
): string {
  if (kind === "notes") return "notes";
  return `${kind}:${id}`;
}

export function parseShapeContextSourceKey(
  key: string,
): { kind: ShapeContextSourceKind; id: string } | null {
  const k = clean(key);
  if (!k) return null;
  if (k === "notes") return { kind: "notes", id: "notes" };
  const colon = k.indexOf(":");
  if (colon <= 0) return null;
  const kind = k.slice(0, colon);
  const id = k.slice(colon + 1).trim();
  if (!id) return null;
  if (kind === "file" || kind === "external") return { kind, id };
  return null;
}

/**
 * Build ordered picker options from workspace Context inventory.
 * Order: external, notes (if non-empty or always shown), files.
 */
export function buildShapeContextSourceOptions(
  input: ShapeContextCatalogInput,
): ShapeContextSourceOption[] {
  const options: ShapeContextSourceOption[] = [];

  for (const r of input.externalResources || []) {
    const id = clean(r.id);
    if (!id) continue;
    const title = clean(r.title) || clean(r.url) || "External source";
    const desc = clean(r.description);
    const url = clean(r.url) || null;
    options.push({
      key: shapeContextSourceKey("external", id),
      kind: "external",
      id,
      label: title,
      url,
      excerpt: [url ? `URL: ${url}` : null, desc || null].filter(Boolean).join("\n") || null,
    });
  }

  const notes = typeof input.notes === "string" ? input.notes : "";
  // Always offer notes when there is content; still list empty notes as optional attach.
  options.push({
    key: "notes",
    kind: "notes",
    id: "notes",
    label: "Workspace notes",
    excerpt: notes.trim() ? clip(notes.trim(), 2_000) : null,
  });

  for (const f of input.files || []) {
    const fileName = clean(f.file_name || f.name);
    if (!fileName) continue;
    const id = clean(f.id) || fileName;
    options.push({
      key: shapeContextSourceKey("file", fileName),
      kind: "file",
      id,
      label: fileName,
      fileName,
      excerpt: clean(f.excerpt) || null,
    });
  }

  return options;
}

export function toggleShapeContextSelection(
  selectedKeys: readonly string[],
  key: string,
): string[] {
  const k = clean(key);
  if (!k) return [...selectedKeys];
  if (selectedKeys.includes(k)) return selectedKeys.filter((x) => x !== k);
  return [...selectedKeys, k];
}

/**
 * Map selected option keys → BlockLocalContextInput for persistence on the new block.
 * Empty selection → null (no local materials).
 */
export function shapeSelectionToLocalContext(
  selectedKeys: readonly string[],
  options: readonly ShapeContextSourceOption[],
): BlockLocalContextInput | null {
  if (!selectedKeys.length) return null;
  const byKey = new Map(options.map((o) => [o.key, o]));
  let notes: string | null = null;
  const global_file_refs: string[] = [];
  const local_files: Array<{ name: string; excerpt?: string | null }> = [];
  const external_resource_ids: string[] = [];
  const externalLinks: ExternalLinkAbsorbInput[] = [];
  const seenFiles = new Set<string>();
  const seenExt = new Set<string>();

  for (const key of selectedKeys) {
    const opt = byKey.get(key) || resolveOrphanKey(key);
    if (!opt) continue;
    if (opt.kind === "notes") {
      notes = opt.excerpt?.trim() || null;
      continue;
    }
    if (opt.kind === "file") {
      const name = clean(opt.fileName || opt.label);
      if (!name || seenFiles.has(name.toLowerCase())) continue;
      seenFiles.add(name.toLowerCase());
      global_file_refs.push(name);
      continue;
    }
    if (opt.kind === "external") {
      const id = clean(opt.id);
      if (id && !seenExt.has(id)) {
        seenExt.add(id);
        external_resource_ids.push(id);
      }
      const name = clean(opt.label) || `External ${id}`;
      const url = clean(opt.url) || null;
      // Pull URL from excerpt "URL: …" when option.url is missing (orphan keys).
      let resolvedUrl = url;
      if (!resolvedUrl && opt.excerpt) {
        const m = String(opt.excerpt).match(/URL:\s*(\S+)/i);
        if (m?.[1]) resolvedUrl = m[1].trim();
      }
      // Prefer Content: body from enriched excerpts for durable absorb.
      const bodyFromExcerpt = extractContentFromExcerpt(opt.excerpt);
      // Summary lines only — strip URL: and Content: so body is not duplicated.
      let descFromExcerpt: string | null = null;
      if (opt.excerpt) {
        const withoutUrl = String(opt.excerpt)
          .replace(/^URL:\s*\S+\s*/im, "")
          .replace(/Content:\s*[\s\S]*/i, "")
          .trim();
        descFromExcerpt = withoutUrl || null;
      }
      externalLinks.push({
        id: id || null,
        title: name,
        url: resolvedUrl,
        description: descFromExcerpt || null,
        body: bodyFromExcerpt || null,
      });
      local_files.push({
        name: `[external] ${name}`,
        excerpt:
          opt.excerpt ||
          (resolvedUrl ? `URL: ${resolvedUrl}` : null),
      });
    }
  }

  // Locally absorb each external link into durable notes (title + URL + summary),
  // not only opaque resource ids.
  const absorbed = absorbExternalResourcesIntoLocalContext(
    {
      notes,
      local_files,
      global_file_refs,
      external_resource_ids,
    },
    externalLinks,
  );

  const raw: BlockLocalContextInput = {
    notes: absorbed.notes,
    global_file_refs: absorbed.global_file_refs,
    local_files: absorbed.local_files,
    external_resource_ids: absorbed.external_resource_ids,
  };
  const norm = normalizeBlockLocalContext(raw);
  // normalize may drop external_resource_ids — preserve if present
  const extIds = absorbed.external_resource_ids || [];
  if (!norm.hasLocalMaterials && !extIds.length) return null;
  return {
    notes: norm.notes || absorbed.notes,
    global_file_refs: norm.globalFileRefs.length ? norm.globalFileRefs : null,
    local_files: norm.localFiles.length
      ? norm.localFiles
      : absorbed.local_files,
    external_resource_ids: extIds.length ? extIds : null,
  };
}

/** Pull `Content:` section from an enriched option excerpt. */
export function extractContentFromExcerpt(
  excerpt: string | null | undefined,
): string | null {
  if (!excerpt) return null;
  const m = String(excerpt).match(/Content:\s*([\s\S]+)/i);
  if (!m?.[1]) return null;
  const body = normalizeLinkBodyText(m[1]);
  return body || null;
}

/**
 * Selected external options that have a fetchable URL (for link-body enrichment).
 */
export function selectedExternalLinkTargets(
  selectedKeys: readonly string[],
  options: readonly ShapeContextSourceOption[],
): Array<{ key: string; id: string; url: string; label: string }> {
  if (!selectedKeys.length) return [];
  const byKey = new Map(options.map((o) => [o.key, o]));
  const out: Array<{ key: string; id: string; url: string; label: string }> = [];
  const seen = new Set<string>();
  for (const key of selectedKeys) {
    const opt = byKey.get(key) || resolveOrphanKey(key);
    if (!opt || opt.kind !== "external") continue;
    let url = clean(opt.url);
    if (!url && opt.excerpt) {
      const m = String(opt.excerpt).match(/URL:\s*(\S+)/i);
      if (m?.[1]) url = m[1].trim();
    }
    if (!url) continue;
    const k = url.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      key: opt.key,
      id: clean(opt.id) || opt.key,
      url,
      label: clean(opt.label) || url,
    });
  }
  return out;
}

/**
 * Pure: merge fetched link bodies into selected external options' excerpts
 * so generation snippet + local_context absorb include page substance.
 *
 * `bodiesByUrl` maps URL (case-insensitive) → raw or plain body text.
 */
export function enrichShapeOptionsWithLinkBodies(
  options: readonly ShapeContextSourceOption[],
  selectedKeys: readonly string[],
  bodiesByUrl: Readonly<Record<string, string | null | undefined>>,
): ShapeContextSourceOption[] {
  if (!options.length || !selectedKeys.length) return [...options];
  const selected = new Set(selectedKeys.map((k) => clean(k)).filter(Boolean));
  const bodyMap = new Map<string, string>();
  for (const [u, body] of Object.entries(bodiesByUrl || {})) {
    const key = clean(u).toLowerCase();
    const text = normalizeLinkBodyText(body);
    if (key && text) bodyMap.set(key, text);
  }
  if (!bodyMap.size) return options.map((o) => ({ ...o }));

  return options.map((opt) => {
    if (opt.kind !== "external" || !selected.has(opt.key)) return { ...opt };
    let url = clean(opt.url);
    if (!url && opt.excerpt) {
      const m = String(opt.excerpt).match(/URL:\s*(\S+)/i);
      if (m?.[1]) url = m[1].trim();
    }
    if (!url) return { ...opt };
    const body = bodyMap.get(url.toLowerCase());
    if (!body) return { ...opt };
    return {
      ...opt,
      excerpt: mergeLinkBodyIntoExcerpt(opt.excerpt, body, url),
    };
  });
}

/**
 * Async enrichment used by create APIs: fetch bodies for selected externals,
 * then return options ready for snippet + local_context mapping.
 * `fetchBody` is injectable for unit tests; failures → null (degrade gracefully).
 */
export async function enrichSelectedOptionsWithFetchedLinkBodies(input: {
  selectedKeys: readonly string[];
  options: readonly ShapeContextSourceOption[];
  fetchBody: (url: string) => Promise<string | null | undefined>;
  /** Cap parallel fetches (default 4). */
  concurrency?: number;
}): Promise<{
  options: ShapeContextSourceOption[];
  fetchedCount: number;
  targets: Array<{ key: string; url: string }>;
}> {
  const targets = selectedExternalLinkTargets(input.selectedKeys, input.options);
  if (!targets.length) {
    return {
      options: input.options.map((o) => ({ ...o })),
      fetchedCount: 0,
      targets: [],
    };
  }
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 4, 8));
  const bodiesByUrl: Record<string, string | null> = {};
  let fetchedCount = 0;
  let i = 0;
  while (i < targets.length) {
    const batch = targets.slice(i, i + concurrency);
    i += concurrency;
    const results = await Promise.all(
      batch.map(async (t) => {
        try {
          const raw = await input.fetchBody(t.url);
          const text = normalizeLinkBodyText(raw);
          return { url: t.url, text: text || null };
        } catch {
          return { url: t.url, text: null as string | null };
        }
      }),
    );
    for (const r of results) {
      bodiesByUrl[r.url] = r.text;
      if (r.text) fetchedCount += 1;
    }
  }
  return {
    options: enrichShapeOptionsWithLinkBodies(
      input.options,
      input.selectedKeys,
      bodiesByUrl,
    ),
    fetchedCount,
    targets: targets.map((t) => ({ key: t.key, url: t.url })),
  };
}

function resolveOrphanKey(key: string): ShapeContextSourceOption | null {
  const parsed = parseShapeContextSourceKey(key);
  if (!parsed) return null;
  if (parsed.kind === "notes") {
    return { key: "notes", kind: "notes", id: "notes", label: "Workspace notes" };
  }
  if (parsed.kind === "file") {
    return {
      key,
      kind: "file",
      id: parsed.id,
      label: parsed.id,
      fileName: parsed.id,
    };
  }
  return {
    key,
    kind: "external",
    id: parsed.id,
    label: parsed.id,
  };
}

/**
 * Human-readable materials section injected into generate-in-shape AI context.
 * Empty selection → empty string (caller keeps workspace-global context only).
 */
export function shapeSelectionToGenerationSnippet(
  selectedKeys: readonly string[],
  options: readonly ShapeContextSourceOption[],
): string {
  if (!selectedKeys.length) return "";
  const byKey = new Map(options.map((o) => [o.key, o]));
  const lines: string[] = [
    "Selected context sources for this block (generation source + local attach):",
  ];
  let any = false;
  for (const key of selectedKeys) {
    const opt = byKey.get(key) || resolveOrphanKey(key);
    if (!opt) continue;
    any = true;
    if (opt.kind === "notes") {
      lines.push(`- Workspace notes`);
      if (opt.excerpt?.trim()) lines.push(clip(opt.excerpt.trim(), 1_200));
      continue;
    }
    if (opt.kind === "file") {
      lines.push(`- File: ${opt.fileName || opt.label}`);
      if (opt.excerpt?.trim()) lines.push(`  Excerpt: ${clip(opt.excerpt.trim(), 600)}`);
      continue;
    }
    lines.push(`- External: ${opt.label}${opt.url ? ` (${opt.url})` : ""}`);
    if (opt.excerpt?.trim()) lines.push(`  ${clip(opt.excerpt.trim(), 600)}`);
  }
  if (!any) return "";
  return lines.join("\n");
}

/**
 * Merge base workspace generation context with selected-sources snippet.
 * When selection is non-empty, the selected materials are the primary generation source.
 */
export function composeShapeGenerationContext(input: {
  baseContext: string;
  selectedSnippet: string;
}): string {
  const base = input.baseContext.trim();
  const sel = input.selectedSnippet.trim();
  if (!sel) return base;
  if (!base) return sel;
  return [
    base,
    "",
    "---",
    "Creator selected the following materials as primary generation source for this shaped block:",
    sel,
  ].join("\n");
}
