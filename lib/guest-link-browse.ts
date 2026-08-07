/**
 * Client-side browse/search/filter for workspace TAP + ILE + TAPBench links.
 * Pure transforms so the Settings UI can filter large lists without new APIs.
 */

export type GuestLinkBrowseKind = "tap" | "ile" | "tapbench";

/** Normalized row shown on the guest-links Browse surface. */
export type GuestLinkBrowseRow = {
  id: string;
  kind: GuestLinkBrowseKind;
  status: string;
  /** Block title, "entire workspace", or raw block id. */
  scopeLabel: string;
  /** Human-readable participant (anonymous / guest / member / …). */
  participantLabel: string;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  block_id: string | null;
  created_at: string;
  completed_at: string | null;
  /** TAP / TAPBench duration when present. */
  requested_duration_seconds?: number | null;
  /** Optional free-text (e.g. TAPBench exercise) for search. */
  detail?: string | null;
  /** Always-visible share URL when list API provides it. */
  url?: string | null;
};

export type GuestLinkBrowseKindFilter = "all" | GuestLinkBrowseKind;
export type GuestLinkBrowseStatusFilter = "all" | string;

export type GuestLinkBrowseFilters = {
  query: string;
  kind: GuestLinkBrowseKindFilter;
  status: GuestLinkBrowseStatusFilter;
};

export type TapLinkBrowseSource = {
  id: string;
  block_id: string | null;
  status: string;
  requested_duration_seconds?: number | null;
  participant_type: string | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type IleLinkBrowseSource = {
  id: string;
  block_id: string;
  status: string;
  participant_type: string | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TapbenchLinkBrowseSource = {
  id: string;
  block_id: string | null;
  status: string;
  created_at: string;
  duration_seconds?: number | null;
  remaining_ms?: number | null;
  exercise?: string | null;
  url?: string | null;
  public_token?: string | null;
  guest_user_id?: string | null;
};

export type BuildGuestLinkBrowseRowsOptions = {
  blockTitleById: Map<string, string> | Record<string, string>;
  entireWorkspaceLabel: string;
  /** Resolve participant display string for a link row. */
  participantLabelFor: (link: {
    participant_type: string | null;
    assigned_user_id: string | null;
    guest_user_id: string | null;
  }) => string;
  /** Optional TAPBench mint list merged into the same browse surface. */
  tapbenchLinks?: readonly TapbenchLinkBrowseSource[] | null;
  tapbenchParticipantLabel?: string;
};

function blockTitle(
  blockTitleById: Map<string, string> | Record<string, string>,
  blockId: string,
): string {
  if (blockTitleById instanceof Map) {
    return blockTitleById.get(blockId) || blockId;
  }
  return blockTitleById[blockId] || blockId;
}

/**
 * Merge TAP + ILE (+ optional TAPBench) API rows into one browse list
 * (newest first by created_at).
 */
export function buildGuestLinkBrowseRows(
  tapLinks: TapLinkBrowseSource[],
  ileLinks: IleLinkBrowseSource[],
  options: BuildGuestLinkBrowseRowsOptions,
): GuestLinkBrowseRow[] {
  const {
    blockTitleById,
    entireWorkspaceLabel,
    participantLabelFor,
    tapbenchLinks,
    tapbenchParticipantLabel = "Agent",
  } = options;

  const tapRows: GuestLinkBrowseRow[] = tapLinks.map((link) => ({
    id: link.id,
    kind: "tap" as const,
    status: link.status,
    scopeLabel: link.block_id
      ? blockTitle(blockTitleById, link.block_id)
      : entireWorkspaceLabel,
    participantLabel: participantLabelFor(link),
    guest_user_id: link.guest_user_id,
    assigned_user_id: link.assigned_user_id,
    block_id: link.block_id,
    created_at: link.created_at,
    completed_at: link.completed_at,
    requested_duration_seconds: link.requested_duration_seconds ?? null,
  }));

  const ileRows: GuestLinkBrowseRow[] = ileLinks.map((link) => ({
    id: link.id,
    kind: "ile" as const,
    status: link.status,
    scopeLabel: blockTitle(blockTitleById, link.block_id),
    participantLabel: participantLabelFor(link),
    guest_user_id: link.guest_user_id,
    assigned_user_id: link.assigned_user_id,
    block_id: link.block_id,
    created_at: link.created_at,
    completed_at: link.completed_at,
  }));

  const tbRows: GuestLinkBrowseRow[] = (tapbenchLinks ?? []).map((link) => ({
    id: link.id,
    kind: "tapbench" as const,
    status: link.status || "active",
    scopeLabel: link.block_id
      ? blockTitle(blockTitleById, link.block_id)
      : entireWorkspaceLabel,
    participantLabel: tapbenchParticipantLabel,
    guest_user_id: link.guest_user_id ?? null,
    assigned_user_id: null,
    block_id: link.block_id,
    created_at: link.created_at,
    completed_at: null,
    requested_duration_seconds: link.duration_seconds ?? null,
    detail: link.exercise ?? null,
    url: link.url ?? null,
  }));

  return [...tapRows, ...ileRows, ...tbRows].sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    return tb - ta;
  });
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Whether a browse row matches the free-text query.
 * Matches status, scope/block title, participant label, link id, kind, detail.
 */
export function guestLinkBrowseRowMatchesQuery(
  row: GuestLinkBrowseRow,
  query: string,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [
    row.status,
    row.scopeLabel,
    row.participantLabel,
    row.id,
    row.kind,
    row.guest_user_id ?? "",
    row.assigned_user_id ?? "",
    row.block_id ?? "",
    row.detail ?? "",
    row.url ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Apply query + kind + status filters (AND composition).
 * Empty query and "all" filters leave the list unchanged (still sorted as input).
 */
export function filterGuestLinkBrowseRows(
  rows: readonly GuestLinkBrowseRow[],
  filters: GuestLinkBrowseFilters,
): GuestLinkBrowseRow[] {
  const kind = filters.kind ?? "all";
  const status = filters.status ?? "all";
  const query = filters.query ?? "";

  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (status !== "all" && row.status !== status) return false;
    if (!guestLinkBrowseRowMatchesQuery(row, query)) return false;
    return true;
  });
}

/** Distinct statuses present in the list, sorted alphabetically for filter UIs. */
export function collectGuestLinkBrowseStatuses(
  rows: readonly GuestLinkBrowseRow[],
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.status) set.add(row.status);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
