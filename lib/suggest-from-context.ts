/**
 * Suggest from Context — pure assembler.
 * Corpus is workspace Context materials only: notes text, attached file
 * names (and stored text excerpts), and external resource title/url/description.
 * No network I/O. Empty materials yield no prompt (the route must not call the model).
 */

import {
  surfaceFramingForSuggestKnowledge,
  type SuggestFromKnowledgeContext,
  type SuggestFromKnowledgeXaiMessages,
} from "@/lib/suggest-from-knowledge";

export type ContextSuggestFileInput = {
  name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  mime?: string | null;
  /** Text excerpt already stored with the file. Bytes are never fetched here. */
  excerpt?: string | null;
  text?: string | null;
};

export type ContextSuggestResourceInput = {
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

export type ContextSuggestMaterials = {
  notes?: string | null;
  files?: readonly ContextSuggestFileInput[] | null;
  externalResources?: readonly ContextSuggestResourceInput[] | null;
};

export type SuggestFromContextXaiMessages = SuggestFromKnowledgeXaiMessages & {
  /** True when notes, files, and external resources have no usable text. */
  empty: boolean;
};

const NOTES_MAX = 4_000;
const EXCERPT_MAX = 1_200;
const FIELD_MAX = 400;
const FILE_LIMIT = 24;
const RESOURCE_LIMIT = 24;

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function fileNameOf(file: ContextSuggestFileInput): string {
  return clean(file.name || file.file_name);
}

function fileMimeOf(file: ContextSuggestFileInput): string {
  return clean(file.mime_type || file.mime);
}

function fileExcerptOf(file: ContextSuggestFileInput): string {
  return clean(file.excerpt || file.text);
}

/**
 * True when the Context section has notes, a file name or stored excerpt,
 * or an external resource title/url/description.
 */
export function contextSuggestMaterialsAreEmpty(
  materials: ContextSuggestMaterials | null | undefined,
): boolean {
  if (!materials) return true;
  if (clean(materials.notes)) return false;
  for (const file of materials.files || []) {
    if (!file || typeof file !== "object") continue;
    if (fileNameOf(file) || fileExcerptOf(file)) return false;
  }
  for (const resource of materials.externalResources || []) {
    if (!resource || typeof resource !== "object") continue;
    if (clean(resource.title) || clean(resource.url) || clean(resource.description)) {
      return false;
    }
  }
  return true;
}

function serializeContextCorpus(materials: ContextSuggestMaterials): string {
  const sections: string[] = [];
  const notes = clean(materials.notes);
  if (notes) {
    sections.push(`### Notes\n${clip(notes, NOTES_MAX)}`);
  }

  const fileLines: string[] = [];
  const seenFiles = new Set<string>();
  for (const file of materials.files || []) {
    if (fileLines.length >= FILE_LIMIT) break;
    if (!file || typeof file !== "object") continue;
    const name = fileNameOf(file);
    const mime = fileMimeOf(file);
    const excerpt = fileExcerptOf(file);
    if (!name && !excerpt) continue;
    const key = (name || excerpt).toLowerCase();
    if (seenFiles.has(key)) continue;
    seenFiles.add(key);
    const title = name
      ? mime
        ? `- ${clip(name, 180)} (${clip(mime, 80)})`
        : `- ${clip(name, 180)}`
      : "- (untitled file)";
    fileLines.push(title);
    if (excerpt) fileLines.push(`  excerpt: ${clip(excerpt, EXCERPT_MAX)}`);
  }
  if (fileLines.length) {
    sections.push(`### Attached files\n${fileLines.join("\n")}`);
  }

  const resourceLines: string[] = [];
  const seenResources = new Set<string>();
  for (const resource of materials.externalResources || []) {
    if (resourceLines.length >= RESOURCE_LIMIT) break;
    if (!resource || typeof resource !== "object") continue;
    const title = clean(resource.title);
    const url = clean(resource.url);
    const description = clean(resource.description);
    if (!title && !url && !description) continue;
    const key = `${title}|${url}`.toLowerCase();
    if (seenResources.has(key)) continue;
    seenResources.add(key);
    const head = [title, url].filter(Boolean).join(" · ");
    resourceLines.push(`- ${clip(head || "external resource", 300)}`);
    if (description) {
      resourceLines.push(`  description: ${clip(description, EXCERPT_MAX)}`);
    }
  }
  if (resourceLines.length) {
    sections.push(`### External resources\n${resourceLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

const EMPTY_MESSAGES: SuggestFromContextXaiMessages = {
  empty: true,
  systemPrompt: "",
  userPrompt: "",
  sourceSnapshotIds: [],
  blockCount: 0,
  snapshotCount: 0,
};

/**
 * System + user messages grounded only in Context materials.
 * Empty notes, files, and external resources return no prompt text.
 */
export function assembleSuggestFromContextXaiMessages(
  materials: ContextSuggestMaterials | null | undefined,
  context: SuggestFromKnowledgeContext = {},
): SuggestFromContextXaiMessages {
  const source = materials || {};
  if (contextSuggestMaterialsAreEmpty(source)) return EMPTY_MESSAGES;

  const corpus = serializeContextCorpus(source);
  if (!corpus) return EMPTY_MESSAGES;

  const limit = Math.max(1, Math.min(context.limit ?? 4, 8));
  const surface = clean(context.surface) || "map build";
  const draft = clean(context.draftPrompt);
  const wsTitle = clean(context.workspaceTitle) || "Workspace";
  const wsGoal = clean(context.workspaceGoal);

  const systemPrompt = [
    "You are an authoring assistant for a knowledge-map workspace.",
    "Your job is to propose **author prompts** (guidance text) the map builder will paste into generation fields.",
    "Ground every prompt in the workspace Context materials only: notes text, attached file names, stored text excerpts, and external resource title, url, and description.",
    "Do not use eval snapshots or the simulation collection as the corpus.",
    "Do not invent notes, files, or links that are not in the context.",
    "Each suggestion must be a concrete, actionable generation prompt (topic + angle + constraints).",
    "When an author draft is present, write a different prompt than that draft.",
    "Return JSON only:",
    `{ "suggestions": [ { "label": "short chip label", "prompt": "full author prompt text", "rationale": "one-line why" } ] }`,
    `Return ${limit} high-quality suggestions (or fewer if context is sparse).`,
    surfaceFramingForSuggestKnowledge(surface),
  ].join("\n");

  const userPrompt = [
    `Workspace: ${wsTitle}`,
    wsGoal ? `Workspace goal: ${clip(wsGoal, 240)}` : null,
    draft ? `Author draft / current field text: ${clip(draft, FIELD_MAX)}` : null,
    "",
    "## Workspace Context materials",
    corpus,
    "",
    `Produce ${limit} author prompts for surface "${surface}".`,
  ]
    .filter((line) => line != null)
    .join("\n");

  return {
    empty: false,
    systemPrompt,
    userPrompt,
    sourceSnapshotIds: [],
    blockCount: 0,
    snapshotCount: 0,
  };
}
