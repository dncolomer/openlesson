/**
 * Generate a single ILE chapter the same way workspace blocks are authored:
 * title + description + a 1–2 word map keyword (not a truncation of the title).
 */
import {
  BLOCK_MAP_GLYPH_JSON_SHAPE,
  blockMapGlyphDbFields,
  composeBlockMapGlyphJsonInstruction,
  composeChapterMapGlyphJsonInstruction,
} from "@/lib/block-map-glyph";
import { ILE_SESSION_MODE_DEFAULT, normalizeIleSessionMode, type IleSessionMode } from "@/lib/ile-mode";

export type IleChapterGenerateResult = {
  title: string;
  description: string;
  keyword: string;
};

export function composeIleChapterGenerateSystemMessage(
  mode?: IleSessionMode | string | null,
): string {
  const resolved = normalizeIleSessionMode(mode, ILE_SESSION_MODE_DEFAULT);
  const grain =
    resolved === "project"
      ? "Description: a standalone longer-horizon exercise (1–3 sentences, self-contained). Do not script a conversation."
      : "Description: a topic-horizon conversation (1–2 sentences naming what they can do after a deep dialogue).";
  return [
    "You create a single ILE chapter for a skill-grid slot.",
    `Return JSON only: ${BLOCK_MAP_GLYPH_JSON_SHAPE}.`,
    "Title: 4-14 words, specific and actionable.",
    grain,
    composeBlockMapGlyphJsonInstruction(),
    composeChapterMapGlyphJsonInstruction(),
  ].join(" ");
}

export function composeIleChapterGenerateUserPrompt(input: {
  seed: string;
  sessionGoal?: string | null;
  existingChapters?: string[] | null;
  neighborSummary?: string | null;
}): string {
  const existing =
    (input.existingChapters || [])
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24)
      .map((t) => `- ${t.slice(0, 160)}`)
      .join("\n") || "(none)";
  const neighbors = String(input.neighborSummary || "").trim() || "none";
  return [
    `Session goal / topic: ${String(input.sessionGoal || "").trim() || "practice"}`,
    `Learner seed / picked title: ${String(input.seed || "").trim() || "(untitled)"}`,
    `Existing chapters (do not duplicate):`,
    existing,
    `Nearby chapters: ${neighbors}`,
    `Author one chapter from the seed. Invent title, description, and keyword together.`,
  ].join("\n");
}

export function normalizeIleChapterGenerateResult(
  raw: unknown,
  seed: string,
): IleChapterGenerateResult | null {
  const fallback = String(seed || "").trim();
  const rec =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const title = String(rec?.title || rec?.name || fallback).trim() || fallback;
  const description =
    String(rec?.description || rec?.body || rec?.summary || title).trim() || title;
  if (!description) return null;
  const glyph = blockMapGlyphDbFields(
    rec ?? { title },
    title || description,
  );
  return {
    title: title.slice(0, 120),
    description: description.slice(0, 800),
    keyword: glyph.map_keyword,
  };
}
