/**
 * Knowledge subtab rows for a Verification Workspace.
 * A selected flow replaces the workspace roster with that flow's proof rows.
 * No selection returns the workspace rows unchanged.
 */
import type { KnowledgeRankingCard } from "@/lib/pow-api/knowledge-ranking";
import {
  filterKnowledgeRowsByVerificationFlow,
  type VerificationKnowledgeRow,
} from "@/lib/verification-flow";

export type VerificationSubjectRow = {
  user_id: string | null;
  guest_user_id: string | null;
  embedding_model_id: string;
  as_of_ms: number;
  confidence: number;
  label?: string | null;
};

export type VerificationRankingRow = KnowledgeRankingCard & { proofText?: string };

function selectedFlowId(flowId: string | null | undefined): string | null {
  const id = String(flowId ?? "").trim();
  return id || null;
}

function membershipValues(values: Array<string | null | undefined>): string[] {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean);
}

/** A workspace card matches a flow row when they share an id or a label. */
function rowSharesIdentity(
  row: VerificationKnowledgeRow,
  fields: Array<string | null | undefined>,
): boolean {
  const rowKeys = new Set(membershipValues([row.id, row.label]));
  return membershipValues(fields).some((field) => rowKeys.has(field));
}

function proofRankingRow(row: VerificationKnowledgeRow, index: number): VerificationRankingRow {
  return {
    rank: index + 1,
    subjectKey: row.id,
    userId: null,
    guestUserId: row.id,
    label: row.label,
    snapshotScore: null,
    ghcScore: null,
    ranAt: null,
    runId: row.id,
    hasSnapshot: false,
    report: null,
    proofText: row.detail,
  };
}

function proofSubjectRow(row: VerificationKnowledgeRow): VerificationSubjectRow {
  return {
    user_id: null,
    guest_user_id: row.id,
    embedding_model_id: "knowledgecfg-v1-d64",
    as_of_ms: 0,
    confidence: 0,
    label: row.label,
  };
}

export function knowledgeRankingCardsForVerificationFlow(
  cards: readonly KnowledgeRankingCard[],
  flowRows: readonly VerificationKnowledgeRow[],
  flowId: string | null | undefined,
): VerificationRankingRow[] {
  const selected = selectedFlowId(flowId);
  if (!selected) return cards.map((card) => ({ ...card }));
  const rows = filterKnowledgeRowsByVerificationFlow(flowRows, selected);
  const used = new Set<KnowledgeRankingCard>();
  return rows.map((row, index) => {
    const match = cards.find(
      (card) =>
        !used.has(card) &&
        rowSharesIdentity(row, [card.subjectKey, card.label, card.userId, card.guestUserId]),
    );
    if (!match) return proofRankingRow(row, index);
    used.add(match);
    return { ...match, proofText: row.detail };
  });
}

export function knowledgeSubjectsForVerificationFlow<T extends VerificationSubjectRow>(
  subjects: readonly T[],
  flowRows: readonly VerificationKnowledgeRow[],
  flowId: string | null | undefined,
): T[] {
  const selected = selectedFlowId(flowId);
  if (!selected) return subjects.slice();
  const rows = filterKnowledgeRowsByVerificationFlow(flowRows, selected);
  const used = new Set<T>();
  return rows.map((row) => {
    const match = subjects.find(
      (subject) =>
        !used.has(subject) &&
        rowSharesIdentity(row, [subject.user_id, subject.guest_user_id, subject.label]),
    );
    if (!match) return proofSubjectRow(row) as T;
    used.add(match);
    return match;
  });
}

export type LwmSubjectSelection = {
  userId: string;
  guestUserId: string;
};

function selectionMatchesSubjects(
  current: LwmSubjectSelection,
  subjects: readonly VerificationSubjectRow[],
): boolean {
  return subjects.some((subject) => {
    if (current.guestUserId) return subject.guest_user_id === current.guestUserId;
    if (current.userId) return subject.user_id === current.userId && !subject.guest_user_id;
    return false;
  });
}

function selectionFromSubject(subject: VerificationSubjectRow | undefined): LwmSubjectSelection {
  if (subject?.guest_user_id) return { userId: "", guestUserId: subject.guest_user_id };
  if (subject?.user_id) return { userId: subject.user_id, guestUserId: "" };
  return { userId: "", guestUserId: "" };
}

/**
 * Learning Profiles subject for a Verification Workspace.
 * A selected flow keeps the current person when they are in that flow, otherwise
 * the first flow subject, otherwise neither id. Clearing the flow keeps a person
 * who is on the workspace roster and otherwise returns the signed-in user.
 */
export function lwmLoadedSubjectForVerificationFlow(input: {
  subjects: readonly VerificationSubjectRow[];
  roster: readonly VerificationSubjectRow[];
  flowId: string | null | undefined;
  current: LwmSubjectSelection;
  currentUserId?: string | null;
}): LwmSubjectSelection {
  const current = {
    userId: input.current.userId.trim(),
    guestUserId: input.current.guestUserId.trim(),
  };
  if (selectedFlowId(input.flowId)) {
    if (selectionMatchesSubjects(current, input.subjects)) return current;
    return selectionFromSubject(input.subjects[0]);
  }
  if (selectionMatchesSubjects(current, input.roster)) return current;
  return { userId: String(input.currentUserId ?? "").trim(), guestUserId: "" };
}

export function knowledgeCoordsForVerificationFlow<T extends object>(
  coords: readonly T[],
  subjects: readonly VerificationSubjectRow[],
  flowId: string | null | undefined,
): T[] {
  const selected = selectedFlowId(flowId);
  if (!selected) return coords.slice();
  const keys = new Set<string>();
  for (const subject of subjects) {
    if (subject.user_id) keys.add(`u:${subject.user_id}`);
    if (subject.guest_user_id) keys.add(`g:${subject.guest_user_id}`);
    if (subject.label) keys.add(subject.label);
  }
  return coords.filter((coord) => {
    const key = String((coord as { subjectKey?: string | null }).subjectKey || "");
    if (!key) return false;
    if (keys.has(key)) return true;
    if (key.startsWith("u:") && keys.has(key.slice(2))) return true;
    if (key.startsWith("g:") && keys.has(key.slice(2))) return true;
    return false;
  });
}
