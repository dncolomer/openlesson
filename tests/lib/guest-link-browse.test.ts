/**
 * Guest-link Browse surface: pure search/filter helpers + structural UI hooks.
 * Drives shipped lib/guest-link-browse.ts — no re-implementation of match rules.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGuestLinkBrowseRows,
  collectGuestLinkBrowseStatuses,
  filterGuestLinkBrowseRows,
  guestLinkBrowseRowMatchesQuery,
  type GuestLinkBrowseRow,
  type IleLinkBrowseSource,
  type TapLinkBrowseSource,
} from "@/lib/guest-link-browse";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const TAP_PENDING: TapLinkBrowseSource = {
  id: "tap-pending-1111-aaaa",
  block_id: "block-intro",
  status: "pending",
  requested_duration_seconds: 1800,
  participant_type: "anonymous",
  guest_user_id: null,
  assigned_user_id: null,
  created_at: "2026-07-20T10:00:00.000Z",
  completed_at: null,
};

const TAP_REVOKED: TapLinkBrowseSource = {
  id: "tap-revoked-2222-bbbb",
  block_id: null,
  status: "revoked",
  requested_duration_seconds: 900,
  participant_type: "guest",
  guest_user_id: "guest-uuid-aaaa-bbbb",
  assigned_user_id: null,
  created_at: "2026-07-19T10:00:00.000Z",
  completed_at: null,
};

const ILE_ACTIVE: IleLinkBrowseSource = {
  id: "ile-active-3333-cccc",
  block_id: "block-advanced",
  status: "active",
  participant_type: "user",
  guest_user_id: null,
  assigned_user_id: "member-uuid-dddd",
  created_at: "2026-07-21T10:00:00.000Z",
  completed_at: null,
};

const ILE_COMPLETED: IleLinkBrowseSource = {
  id: "ile-done-4444-eeee",
  block_id: "block-intro",
  status: "completed",
  participant_type: "anonymous",
  guest_user_id: null,
  assigned_user_id: null,
  created_at: "2026-07-18T10:00:00.000Z",
  completed_at: "2026-07-18T11:00:00.000Z",
};

function participantLabelFor(link: {
  participant_type: string | null;
  assigned_user_id: string | null;
  guest_user_id: string | null;
}): string {
  if (link.participant_type === "anonymous") return "Anonymous";
  if (link.participant_type === "user" || link.assigned_user_id) return "Member";
  if (link.participant_type === "guest" || link.guest_user_id) return "Guest";
  return "—";
}

function buildFixture(): GuestLinkBrowseRow[] {
  return buildGuestLinkBrowseRows(
    [TAP_PENDING, TAP_REVOKED],
    [ILE_ACTIVE, ILE_COMPLETED],
    {
      blockTitleById: {
        "block-intro": "Intro Block",
        "block-advanced": "Advanced Topics",
      },
      entireWorkspaceLabel: "Entire workspace",
      participantLabelFor,
    },
  );
}

describe("buildGuestLinkBrowseRows", () => {
  it("merges TAP and ILE with kind labels, scope, and participant", () => {
    const rows = buildFixture();
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.kind === "tap" || r.kind === "ile")).toBe(true);

    const tapPending = rows.find((r) => r.id === TAP_PENDING.id);
    expect(tapPending).toMatchObject({
      kind: "tap",
      status: "pending",
      scopeLabel: "Intro Block",
      participantLabel: "Anonymous",
    });

    const tapRevoked = rows.find((r) => r.id === TAP_REVOKED.id);
    expect(tapRevoked).toMatchObject({
      kind: "tap",
      status: "revoked",
      scopeLabel: "Entire workspace",
      participantLabel: "Guest",
    });

    const ileActive = rows.find((r) => r.id === ILE_ACTIVE.id);
    expect(ileActive).toMatchObject({
      kind: "ile",
      status: "active",
      scopeLabel: "Advanced Topics",
      participantLabel: "Member",
    });
  });

  it("sorts newest created_at first", () => {
    const rows = buildFixture();
    expect(rows.map((r) => r.id)).toEqual([
      ILE_ACTIVE.id,
      TAP_PENDING.id,
      TAP_REVOKED.id,
      ILE_COMPLETED.id,
    ]);
  });
});

describe("filterGuestLinkBrowseRows", () => {
  const rows = buildFixture();

  it("empty query + all filters returns all rows", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "",
      kind: "all",
      status: "all",
    });
    expect(filtered).toHaveLength(rows.length);
    expect(filtered.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it("query matches block title and excludes non-matches", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "Advanced Topics",
      kind: "all",
      status: "all",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(ILE_ACTIVE.id);
  });

  it("query matches status", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "revoked",
      kind: "all",
      status: "all",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(TAP_REVOKED.id);
  });

  it("query matches id fragment", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "3333-cccc",
      kind: "all",
      status: "all",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(ILE_ACTIVE.id);
  });

  it("query matches participant label", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "guest",
      kind: "all",
      status: "all",
    });
    expect(filtered.map((r) => r.id)).toEqual([TAP_REVOKED.id]);
  });

  it("kind filter keeps only TAP", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "",
      kind: "tap",
      status: "all",
    });
    expect(filtered.every((r) => r.kind === "tap")).toBe(true);
    expect(filtered).toHaveLength(2);
  });

  it("kind filter keeps only ILE", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "",
      kind: "ile",
      status: "all",
    });
    expect(filtered.every((r) => r.kind === "ile")).toBe(true);
    expect(filtered).toHaveLength(2);
  });

  it("status filter keeps only the chosen status", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "",
      kind: "all",
      status: "pending",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe("pending");
  });

  it("combined query + kind + status intersects correctly", () => {
    // Intro Block appears on TAP pending and ILE completed
    const byScope = filterGuestLinkBrowseRows(rows, {
      query: "Intro",
      kind: "all",
      status: "all",
    });
    expect(byScope.map((r) => r.id).sort()).toEqual(
      [TAP_PENDING.id, ILE_COMPLETED.id].sort(),
    );

    const tapOnly = filterGuestLinkBrowseRows(rows, {
      query: "Intro",
      kind: "tap",
      status: "all",
    });
    expect(tapOnly).toHaveLength(1);
    expect(tapOnly[0].id).toBe(TAP_PENDING.id);

    const completedIle = filterGuestLinkBrowseRows(rows, {
      query: "Intro",
      kind: "ile",
      status: "completed",
    });
    expect(completedIle).toHaveLength(1);
    expect(completedIle[0].id).toBe(ILE_COMPLETED.id);

    const noMatch = filterGuestLinkBrowseRows(rows, {
      query: "Intro",
      kind: "tap",
      status: "completed",
    });
    expect(noMatch).toHaveLength(0);
  });

  it("returns empty when nothing matches", () => {
    const filtered = filterGuestLinkBrowseRows(rows, {
      query: "zzzz-no-such-link",
      kind: "all",
      status: "all",
    });
    expect(filtered).toEqual([]);
  });
});

describe("guestLinkBrowseRowMatchesQuery", () => {
  it("is case-insensitive and treats blank query as match-all", () => {
    const row = buildFixture()[0];
    expect(guestLinkBrowseRowMatchesQuery(row, "")).toBe(true);
    expect(guestLinkBrowseRowMatchesQuery(row, "   ")).toBe(true);
    expect(guestLinkBrowseRowMatchesQuery(row, row.kind.toUpperCase())).toBe(true);
  });
});

describe("collectGuestLinkBrowseStatuses", () => {
  it("returns sorted unique statuses", () => {
    expect(collectGuestLinkBrowseStatuses(buildFixture())).toEqual([
      "active",
      "completed",
      "pending",
      "revoked",
    ]);
  });
});

describe("WorkspaceGuestLinksPanel browse UI structure", () => {
  it("exposes Create|Browse inner tabs, search, and kind+status filters", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("data-guest-links-inner-tabs");
    expect(panel).toContain('data-guest-links-inner-tab="create"');
    expect(panel).toContain('data-guest-links-inner-tab="browse"');
    expect(panel).toContain("data-guest-links-search");
    expect(panel).toContain("data-guest-links-filter-kind");
    expect(panel).toContain("data-guest-links-filter-status");
    expect(panel).toContain("data-guest-links-browse-list");
    expect(panel).toContain("filterGuestLinkBrowseRows");
    expect(panel).toContain("buildGuestLinkBrowseRows");
  });

  it("create controls remain and browse keeps invalidate/reissue/copy hooks", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("createTapLink");
    expect(panel).toContain("createIleLink");
    expect(panel).toContain('data-guest-link-invalidate="tap"');
    expect(panel).toContain('data-guest-link-invalidate="ile"');
    expect(panel).toContain('data-guest-link-invalidate-all="tap"');
    expect(panel).toContain('data-guest-link-invalidate-all="ile"');
    expect(panel).toContain("reissueTapLink");
    expect(panel).toContain("reissueIleLink");
    expect(panel).toContain("copyLink");
  });
});
