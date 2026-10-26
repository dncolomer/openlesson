/**
 * First Work-canvas prompt for a Learn session.
 * Grounded in the opening hidden-state tree. Never the bare block title.
 */

import type { SessionBranch, SessionBranchModel } from "@/lib/session-branch-model";

const SCOPE_LIMIT = 8;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isBareChapterTitle(text: string, chapterTitle: string): boolean {
  const a = compact(text).replace(/[.?!:]+$/g, "").toLowerCase();
  const b = compact(chapterTitle).replace(/[.?!:]+$/g, "").toLowerCase();
  return Boolean(a && b && a === b);
}

export function learnOpeningWorkScope(model: SessionBranchModel): SessionBranch[] {
  const branches = Array.isArray(model?.branches) ? model.branches : [];
  const root = branches.find((branch) => branch.id === model.rootId) ?? branches[0];
  if (!root) return [];
  const children = (root.edges ?? [])
    .map((edge) => branches.find((branch) => branch.id === edge.toId))
    .filter((branch): branch is SessionBranch => Boolean(branch));
  return [root, ...children].slice(0, SCOPE_LIMIT);
}

export function learnOpeningWorkScopeText(model: SessionBranchModel): string {
  const lines = learnOpeningWorkScope(model).map((branch) => {
    const question = compact(String(branch.question || ""));
    const observation = compact(String(branch.observation || ""));
    const detail = question || observation || compact(String(branch.territory || ""));
    return `- ${compact(branch.title) || branch.id}: ${detail}`.trim();
  });
  return [`Chapter: ${compact(model.chapterTitle) || "this topic"}`, "Opening hidden states:", ...lines].join(
    "\n",
  );
}

function pickIndex(length: number, salt: string): number {
  if (length <= 1) return 0;
  let hash = 0;
  for (let index = 0; index < salt.length; index += 1) {
    hash = (hash * 31 + salt.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function scopedLines(model: SessionBranchModel, key: "question" | "observation"): string[] {
  const title = model.chapterTitle || "";
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const branch of learnOpeningWorkScope(model)) {
    const line = compact(String(branch[key] || ""));
    if (!line || isBareChapterTitle(line, title) || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

/** A genuine line from the opening tree. Empty when the tree is only the chapter title. */
export function learnOpeningWorkFallback(
  model: SessionBranchModel,
  salt?: string | null,
): string {
  const questions = scopedLines(model, "question");
  const pool = questions.length ? questions : scopedLines(model, "observation");
  if (!pool.length) return "";
  return pool[pickIndex(pool.length, compact(salt || ""))];
}

export function resolveLearnOpeningWork(
  model: SessionBranchModel,
  generated?: string | null,
  salt?: string | null,
): string {
  const text = compact(generated || "");
  if (text && !isBareChapterTitle(text, model.chapterTitle)) return text;
  return learnOpeningWorkFallback(model, salt);
}
