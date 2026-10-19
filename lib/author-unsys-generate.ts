/**
 * Author seed generation uses the same xAI field writer as a Learn session.
 * First generate writes only the first ring. Deeper rings are on demand.
 * Tests inject these functions so they never hit live xAI.
 */

import {
  generateSessionBranchChildren,
  generateSessionBranchFirstLevel,
} from "@/lib/session-branch-model-generate";
import {
  addAuthorUnsysGeneratedChildren,
  authorUnsysDeeperChildCount,
} from "@/lib/author-unsys-model";
import {
  sessionBranchById,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export { AUTHOR_UNSYS_GENERATE_PATH } from "@/lib/author-unsys-model";

export type AuthorUnsysGenerateInput = {
  chapterTitle: string;
  chapterBrief?: string | null;
};

export type AuthorUnsysGenerateResult =
  | { ok: true; model: SessionBranchModel }
  | { ok: false; error: string };

export type AuthorUnsysGenerateDeps = {
  generateFirstLevel?: typeof generateSessionBranchFirstLevel;
  generateChildren?: typeof generateSessionBranchChildren;
};

export async function generateAuthorUnsysSessionField(
  input: AuthorUnsysGenerateInput,
  deps: AuthorUnsysGenerateDeps = {},
): Promise<AuthorUnsysGenerateResult> {
  const chapterTitle = String(input.chapterTitle || "").replace(/\s+/g, " ").trim();
  const chapterBrief = String(input.chapterBrief || "").replace(/\s+/g, " ").trim();
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const generateFirstLevel = deps.generateFirstLevel ?? generateSessionBranchFirstLevel;
  return generateFirstLevel({
    chapterTitle: chapterTitle || chapterBrief,
    chapterBrief: chapterBrief || null,
  });
}

export async function expandAuthorUnsysSessionNode(
  input: AuthorUnsysGenerateInput & {
    model: SessionBranchModel;
    parentId: string;
  },
  deps: AuthorUnsysGenerateDeps = {},
): Promise<AuthorUnsysGenerateResult> {
  const parent = sessionBranchById(input.model, input.parentId);
  if (!parent) return { ok: false, error: "A hidden state is required." };
  const generateChildren = deps.generateChildren ?? generateSessionBranchChildren;
  const siblings = input.model.branches.filter((branch) => branch.parentId === parent.id);
  const prepared = await generateChildren({
    chapterTitle: input.chapterTitle,
    chapterBrief: input.chapterBrief,
    parentTitle: parent.title,
    parentQuestion: parent.question,
    parentTerritory: parent.territory,
    siblingTitles: siblings.map((branch) => branch.title),
    count: authorUnsysDeeperChildCount(parent.depth),
  });
  if (!prepared.ok) return prepared;
  return {
    ok: true,
    model: addAuthorUnsysGeneratedChildren(input.model, parent.id, prepared.children),
  };
}
