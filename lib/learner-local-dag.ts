/**
 * Learner-mode local DAG: Locked classification, map dependency highlights,
 * and mini-canvas draft seed. Locked = incomplete lock_until prereqs.
 * Local set = focus + prereqs + unlocks + next peers among live blocks.
 */

import {
  isBlockCompletedStatus,
  isBlockLockedUntilCompleted,
  normalizeLockUntilBlockIds,
  type MapGroundBlockRef,
} from "@/lib/map-ground-rules";
import type { MultiBlockDagDraft, MultiBlockDagEdge } from "@/lib/multi-block-dag";
import {
  blockParticipatesInDag,
  buildLearnerDagView,
} from "@/lib/workspace-mode";
import {
  isDynamicEffectEnabled,
  isDynamicEffectLocked,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";

export type LearnerLocalDagBlock = {
  id: string;
  title?: string | null;
  status?: string | null;
  lock_until_block_ids?: readonly string[] | null;
  next_block_ids?: readonly string[] | null;
  position_x?: number | null;
  position_y?: number | null;
  /** Dynamic unlock deps live here (not DAG edges). */
  creator_effects?: unknown;
};

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function uniqIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function asMapRef(b: LearnerLocalDagBlock): MapGroundBlockRef {
  return {
    id: cleanId(b.id),
    title: b.title,
    status: b.status,
    lock_until_block_ids: b.lock_until_block_ids
      ? [...b.lock_until_block_ids]
      : null,
  };
}

/**
 * Blocks that lead-to `block` via next_block_ids and are not completed.
 * Covers DAGs that only stored next edges (no lock_until) so Learner still
 * shows Locked until predecessors are Done.
 */
export function incompleteInboundNextPrerequisites(
  block: LearnerLocalDagBlock,
  blocks: readonly LearnerLocalDagBlock[],
): LearnerLocalDagBlock[] {
  const id = cleanId(block.id);
  if (!id) return [];
  const incomplete: LearnerLocalDagBlock[] = [];
  for (const b of blocks) {
    const bid = cleanId(b.id);
    if (!bid || bid === id) continue;
    const nexts = (b.next_block_ids || []).map(cleanId);
    if (!nexts.includes(id)) continue;
    if (!isBlockCompletedStatus(b.status)) {
      incomplete.push(b);
    }
  }
  return incomplete;
}

/**
 * Learner map "Locked": incomplete lock_until OR incomplete inbound next
 * (A leads-to B and A not done ⇒ B locked) OR Dynamic unlock-after deps
 * (stored on creator_effects, not DAG). Complete prereqs ⇒ not Locked.
 */
export function isLearnerMapBlockLocked(
  block: LearnerLocalDagBlock,
  blocks: readonly LearnerLocalDagBlock[],
): boolean {
  const byId = new Map(
    blocks.map((b) => [cleanId(b.id), asMapRef(b)] as const),
  );
  const self = asMapRef(block);
  if (!self.id) return false;
  if (isBlockLockedUntilCompleted(self, byId)) return true;
  if (incompleteInboundNextPrerequisites(block, blocks).length > 0) return true;
  if (
    isDynamicEffectLocked({
      effects: block.creator_effects,
      selfBlockId: self.id,
      blocks,
    })
  ) {
    return true;
  }
  return false;
}

/** True when block has any dependency signal for the red lock badge. */
export function learnerBlockHasDependencyChrome(
  block: LearnerLocalDagBlock,
  blocks: readonly LearnerLocalDagBlock[],
): boolean {
  const id = cleanId(block.id);
  if (!id) return false;
  if (normalizeLockUntilBlockIds(block.lock_until_block_ids, id).length > 0) {
    return true;
  }
  for (const b of blocks) {
    const bid = cleanId(b.id);
    if (!bid || bid === id) continue;
    if ((b.next_block_ids || []).map(cleanId).includes(id)) return true;
  }
  const dyn = parseBlockCreatorEffects(block.creator_effects, {
    selfBlockId: id,
  });
  if (
    isDynamicEffectEnabled(dyn) &&
    dyn.dynamic.unlockAfterBlockIds.length > 0
  ) {
    return true;
  }
  return false;
}

/** Local peer ids for the focused block (focus + prereqs + unlocks + next). */
export function learnerLocalDagBlockIds(
  focusBlockId: string,
  blocks: readonly LearnerLocalDagBlock[],
): string[] {
  const focus = cleanId(focusBlockId);
  if (!focus) return [];
  const view = buildLearnerDagView({ blockId: focus, blocks });
  const self = blocks.find((b) => cleanId(b.id) === focus);
  const nextIds = (self?.next_block_ids || []).map(cleanId).filter(Boolean);
  // Blocks that point next → focus
  const inboundNext: string[] = [];
  for (const b of blocks) {
    const bid = cleanId(b.id);
    if (!bid || bid === focus) continue;
    if ((b.next_block_ids || []).map(cleanId).includes(focus)) {
      inboundNext.push(bid);
    }
  }
  return uniqIds([
    focus,
    ...view.prerequisites.map((p) => p.id),
    ...view.unlocks.map((u) => u.id),
    ...nextIds,
    ...inboundNext,
  ]);
}

/**
 * Incomplete lock_until + inbound-next ids that currently block `block`.
 * Direct relationship only — not downstream unlocks or completed prereqs.
 */
export function directBlockingPrerequisiteIds(
  block: LearnerLocalDagBlock,
  blocks: readonly LearnerLocalDagBlock[],
): string[] {
  const id = cleanId(block.id);
  if (!id) return [];
  const byId = new Map(blocks.map((b) => [cleanId(b.id), b] as const));
  const ids: string[] = [];
  for (const pid of normalizeLockUntilBlockIds(block.lock_until_block_ids, id)) {
    const p = byId.get(pid);
    if (!p || !isBlockCompletedStatus(p.status)) ids.push(pid);
  }
  for (const inbound of incompleteInboundNextPrerequisites(block, blocks)) {
    ids.push(cleanId(inbound.id));
  }
  return uniqIds(ids);
}

/** ILE chapter is locked when it has any incomplete direct DAG prereq. */
export function isChapterMapTileLocked(
  chapter: LearnerLocalDagBlock,
  chapters: readonly LearnerLocalDagBlock[],
): boolean {
  return directBlockingPrerequisiteIds(chapter, chapters).length > 0;
}

/** Lock badge on a chapter when a DAG edge (lock_until or inbound next) exists. */
export function chapterHasDagLockChrome(
  chapter: LearnerLocalDagBlock,
  chapters: readonly LearnerLocalDagBlock[],
): boolean {
  const id = cleanId(chapter.id);
  if (!id) return false;
  if (normalizeLockUntilBlockIds(chapter.lock_until_block_ids, id).length > 0) {
    return true;
  }
  for (const b of chapters) {
    const bid = cleanId(b.id);
    if (!bid || bid === id) continue;
    if ((b.next_block_ids || []).map(cleanId).includes(id)) return true;
  }
  return false;
}

/**
 * Selecting a locked ILE chapter highlights only the incomplete direct prereqs
 * that unblock it. Unlocked / available selection → empty set.
 */
export function ileChapterUnlockHighlightIds(
  selectedId: string,
  chapters: readonly LearnerLocalDagBlock[],
): string[] {
  const focus = cleanId(selectedId);
  if (!focus) return [];
  const self = chapters.find((c) => cleanId(c.id) === focus);
  if (!self || !isChapterMapTileLocked(self, chapters)) return [];
  return directBlockingPrerequisiteIds(self, chapters);
}

/**
 * Map highlight set when a block is selected in Learner mode:
 * other members of the local DAG (prereqs, unlocks, next peers) — not self.
 */
export function learnerMapDependencyHighlightIds(
  focusBlockId: string,
  blocks: readonly LearnerLocalDagBlock[],
): string[] {
  const focus = cleanId(focusBlockId);
  return learnerLocalDagBlockIds(focus, blocks).filter((id) => id !== focus);
}

/**
 * Seed a leads-to draft for the learner mini canvas among the local set.
 * Includes real next edges plus synthetic prereq→dependent edges from lock_until
 * so incomplete dependencies are visible as arrows into the locked block.
 */
export function seedLearnerLocalDagDraft(
  focusBlockId: string,
  blocks: readonly LearnerLocalDagBlock[],
): MultiBlockDagDraft {
  const focus = cleanId(focusBlockId);
  const blockIds = learnerLocalDagBlockIds(focus, blocks);
  const idSet = new Set(blockIds);
  const byId = new Map(blocks.map((b) => [cleanId(b.id), b]));
  const edges: MultiBlockDagEdge[] = [];
  const edgeKey = new Set<string>();

  const pushNext = (from: string, to: string) => {
    const f = cleanId(from);
    const t = cleanId(to);
    if (!f || !t || f === t || !idSet.has(f) || !idSet.has(t)) return;
    const k = `${f}->${t}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push({ from: f, to: t, kind: "next" });
  };

  for (const id of blockIds) {
    const b = byId.get(id);
    if (!b) continue;
    for (const to of b.next_block_ids || []) {
      pushNext(id, to);
    }
  }

  // lock_until of any local block: prereq → dependent (journey order)
  for (const id of blockIds) {
    const b = byId.get(id);
    if (!b) continue;
    for (const prereq of normalizeLockUntilBlockIds(
      b.lock_until_block_ids,
      id,
    )) {
      pushNext(prereq, id);
    }
  }

  return { blockIds, edges };
}

/** Whether the focused block should open the local DAG drawer emphasis. */
export function learnerLocalDagDrawerRelevant(
  focusBlockId: string,
  blocks: readonly LearnerLocalDagBlock[],
): boolean {
  const focus = cleanId(focusBlockId);
  if (!focus) return false;
  const self = blocks.find((b) => cleanId(b.id) === focus);
  if (!self) return false;
  if (isLearnerMapBlockLocked(self, blocks)) return true;
  return blockParticipatesInDag({
    blockId: focus,
    lockUntilIds: self.lock_until_block_ids,
    nextIds: self.next_block_ids,
    peers: blocks,
  });
}

/**
 * Pure chrome flag: show Locked label + red lock when learner + incomplete prereqs.
 */
export function learnerMapShowsLockedChrome(
  learnerMode: boolean,
  block: LearnerLocalDagBlock,
  blocks: readonly LearnerLocalDagBlock[],
): boolean {
  if (!learnerMode) return false;
  return isLearnerMapBlockLocked(block, blocks);
}

/** Prereq completion snapshot for ops evidence / Done transitions. */
export function learnerPrereqCompletionSnapshot(
  focusBlockId: string,
  blocks: readonly LearnerLocalDagBlock[],
): {
  locked: boolean;
  incompleteIds: string[];
  completeIds: string[];
} {
  const focus = cleanId(focusBlockId);
  const self = blocks.find((b) => cleanId(b.id) === focus);
  if (!self) {
    return { locked: false, incompleteIds: [], completeIds: [] };
  }
  const byId = new Map(blocks.map((b) => [cleanId(b.id), b]));
  const lockIds = normalizeLockUntilBlockIds(self.lock_until_block_ids, focus);
  const incompleteIds: string[] = [];
  const completeIds: string[] = [];
  for (const id of lockIds) {
    const p = byId.get(id);
    if (!p || !isBlockCompletedStatus(p.status)) incompleteIds.push(id);
    else completeIds.push(id);
  }
  return {
    locked: incompleteIds.length > 0,
    incompleteIds,
    completeIds,
  };
}
