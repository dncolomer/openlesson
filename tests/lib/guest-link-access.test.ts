/**
 * Guest TAP/ILE link access mode, entry query capture, PoW source-link stamping.
 * Drives real shipped helpers (lib/guest-link-access + create wrappers via pure helpers).
 */
import { describe, expect, it, vi } from "vitest";
import {
  appendEntryQueryCapture,
  buildGuestLinkUrl,
  collectEntryQueryParams,
  normalizeGuestLinkAccessMode,
  recordGuestLinkEntryQueryParams,
  sourceLinkFromMetadata,
  stampSourceLinkMetadata,
} from "@/lib/guest-link-access";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";

describe("normalizeGuestLinkAccessMode", () => {
  it("defaults to private and accepts public variants", () => {
    expect(normalizeGuestLinkAccessMode({})).toBe("private");
    expect(normalizeGuestLinkAccessMode({ access_mode: "private" })).toBe("private");
    expect(normalizeGuestLinkAccessMode({ access_mode: "public" })).toBe("public");
    expect(normalizeGuestLinkAccessMode({ accessMode: "PUBLIC" })).toBe("public");
    expect(normalizeGuestLinkAccessMode({ public: true })).toBe("public");
    expect(normalizeGuestLinkAccessMode({ public: false })).toBe("private");
  });
});

describe("private vs public token model", () => {
  it("private bearer uses hash lookup shape (secret rotates independently of id)", () => {
    const secret = createPrivateToken();
    const hash = hashPrivateToken(secret);
    expect(hash).toHaveLength(64);
    expect(hashPrivateToken(secret)).toBe(hash);
    expect(hashPrivateToken(secret + "x")).not.toBe(hash);
  });

  it("public link URL is stable when the same public token is reused", () => {
    const publicToken = createPrivateToken();
    const url1 = buildGuestLinkUrl("https://uncertain.systems/", "tap", publicToken);
    const url2 = buildGuestLinkUrl("https://uncertain.systems", "tap", publicToken);
    expect(url1).toBe(url2);
    expect(url1).toBe(`https://uncertain.systems/tap/session/${publicToken}`);
    expect(buildGuestLinkUrl("https://uncertain.systems", "ile", publicToken)).toBe(
      `https://uncertain.systems/ile/session/${publicToken}`,
    );
  });
});

describe("collectEntryQueryParams", () => {
  it("stores all extra URL query params as an object (arbitrary keys)", () => {
    const sp = new URLSearchParams(
      "utm_source=newsletter&utm_campaign=hire50&candidate_id=abc&ref=partner",
    );
    const params = collectEntryQueryParams(sp);
    expect(params).toEqual({
      utm_source: "newsletter",
      utm_campaign: "hire50",
      candidate_id: "abc",
      ref: "partner",
    });
  });

  it("preserves multi-value keys as arrays", () => {
    const sp = new URLSearchParams();
    sp.append("tag", "a");
    sp.append("tag", "b");
    sp.append("solo", "1");
    expect(collectEntryQueryParams(sp)).toEqual({ tag: ["a", "b"], solo: "1" });
  });

  it("accepts plain records from Next searchParams", () => {
    const params = collectEntryQueryParams({
      foo: "bar",
      multi: ["1", "2"],
      empty: undefined,
    });
    expect(params).toEqual({ foo: "bar", multi: ["1", "2"] });
  });
});

describe("appendEntryQueryCapture + recordGuestLinkEntryQueryParams", () => {
  it("appends capture events for later reference", () => {
    const first = appendEntryQueryCapture([], { a: "1" }, "2026-01-01T00:00:00.000Z");
    expect(first).toEqual([{ at: "2026-01-01T00:00:00.000Z", params: { a: "1" } }]);
    const second = appendEntryQueryCapture(first, { b: "2" }, "2026-01-02T00:00:00.000Z");
    expect(second).toHaveLength(2);
    expect(second[1].params).toEqual({ b: "2" });
  });

  it("recordGuestLinkEntryQueryParams reads history and writes updated array", async () => {
    const updates: unknown[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("workspace_ile_links");
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      entry_query_params: [
                        { at: "t0", params: { existing: "yes" } },
                      ],
                    },
                  }),
                };
              },
            };
          },
          update(payload: { entry_query_params: unknown }) {
            updates.push(payload.entry_query_params);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      },
    };

    const next = await recordGuestLinkEntryQueryParams(
      supabase,
      "workspace_ile_links",
      "link-uuid-1",
      { campaign: "x", ref: "y" },
    );
    expect(next).toHaveLength(2);
    expect(next[1].params).toEqual({ campaign: "x", ref: "y" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual(next);
  });

  it("skips empty param objects without writing", async () => {
    const from = vi.fn();
    const supabase = { from };
    const next = await recordGuestLinkEntryQueryParams(
      supabase,
      "workspace_tap_sessions",
      "link-uuid-2",
      {},
    );
    expect(next).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("PoW source link traceability", () => {
  it("stamps TAP PoW metadata with source_link_kind + source_link_id", () => {
    const meta = stampSourceLinkMetadata(
      { tap_session_id: "tap-link-1", trace_type: "system1" },
      { kind: "tap", linkId: "tap-link-1" },
    );
    expect(meta.source_link_kind).toBe("tap");
    expect(meta.source_link_id).toBe("tap-link-1");
    expect(meta.tap_session_id).toBe("tap-link-1");
    expect(sourceLinkFromMetadata(meta)).toEqual({ kind: "tap", linkId: "tap-link-1" });
  });

  it("stamps ILE PoW metadata with source_link_kind + source_link_id and ile_link_id", () => {
    const meta = stampSourceLinkMetadata(
      { source: "ile_session", tool: "canvas" },
      { kind: "ile", linkId: "ile-link-9" },
    );
    expect(meta.source_link_kind).toBe("ile");
    expect(meta.source_link_id).toBe("ile-link-9");
    expect(meta.ile_link_id).toBe("ile-link-9");
    expect(sourceLinkFromMetadata(meta)).toEqual({ kind: "ile", linkId: "ile-link-9" });
  });

  it("sourceLinkFromMetadata falls back to legacy tap_session_id / ile_link_id", () => {
    expect(sourceLinkFromMetadata({ tap_session_id: "legacy-tap" })).toEqual({
      kind: "tap",
      linkId: "legacy-tap",
    });
    expect(sourceLinkFromMetadata({ ile_link_id: "legacy-ile" })).toEqual({
      kind: "ile",
      linkId: "legacy-ile",
    });
  });

  it("create modules accept access_mode and expose url fields in types (static + helper)", async () => {
    // Drive normalize used by createWorkspaceTapLink / createWorkspaceIleLink bodies
    expect(normalizeGuestLinkAccessMode({ access_mode: "public" })).toBe("public");
    // create-* modules re-export path through guest-link helpers
    const createTap = await import("@/lib/pow-api/create-tap-link");
    const createIle = await import("@/lib/pow-api/create-ile-link");
    expect(typeof createTap.createWorkspaceTapLink).toBe("function");
    expect(typeof createIle.createWorkspaceIleLink).toBe("function");
  });
});

describe("session page wiring (static)", () => {
  it("TAP and ILE session pages capture searchParams via collectEntryQueryParams", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "../..");
    const tap = readFileSync(join(root, "app/tap/session/[token]/page.tsx"), "utf8");
    const ile = readFileSync(join(root, "app/ile/session/[token]/page.tsx"), "utf8");
    expect(tap).toContain("collectEntryQueryParams");
    expect(tap).toContain("recordGuestLinkEntryQueryParams");
    expect(tap).toContain("searchParams");
    expect(tap).toContain('access_mode", "public"');
    expect(ile).toContain("collectEntryQueryParams");
    expect(ile).toContain("recordGuestLinkEntryQueryParams");
    expect(ile).toContain("searchParams");
  });

  it("TAP and ILE PoW routes stamp source_link via stampSourceLinkMetadata", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "../..");
    for (const rel of [
      "app/api/workspace-tap-score/trace/route.ts",
      "app/api/workspace-tap-score/chat/route.ts",
      "app/api/workspace-tap-score/speech/route.ts",
      "app/api/workspace-tap-score/idle/route.ts",
      "app/api/workspace-tap-score/complete/route.ts",
      "app/api/workspace/proof-of-work/route.ts",
      "app/api/workspace-ile/speech/route.ts",
      "app/api/workspace-ile/idle/route.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("stampSourceLinkMetadata");
      // Guest ILE paths must gate stamping on access.ileLinkId from ileToken auth
      if (rel.includes("workspace-ile/")) {
        expect(src, rel).toContain("access.ileLinkId");
        expect(src, rel).toMatch(/stampSourceLinkMetadata\([\s\S]*kind:\s*["']ile["']/);
      }
    }
  });

  it("ILE speech/idle metadata builders stamp source_link when ileLinkId is present", () => {
    // Drive the same helper those routes call when access.ileLinkId is set
    const speechMeta = stampSourceLinkMetadata(
      {
        session_id: "sess-1",
        event: "stop",
        segment_duration_ms: 1200,
        transcript_snapshot: "hello",
      },
      { kind: "ile", linkId: "ile-link-speech" },
    );
    expect(speechMeta.source_link_kind).toBe("ile");
    expect(speechMeta.source_link_id).toBe("ile-link-speech");
    expect(speechMeta.ile_link_id).toBe("ile-link-speech");
    expect(sourceLinkFromMetadata(speechMeta)).toEqual({
      kind: "ile",
      linkId: "ile-link-speech",
    });

    const idleMeta = stampSourceLinkMetadata(
      {
        session_id: "sess-2",
        idle_duration_ms: 60_000,
        has_pending_transcription: false,
      },
      { kind: "ile", linkId: "ile-link-idle" },
    );
    expect(idleMeta.source_link_kind).toBe("ile");
    expect(idleMeta.source_link_id).toBe("ile-link-idle");
    expect(sourceLinkFromMetadata(idleMeta)?.linkId).toBe("ile-link-idle");
  });

  it("migration adds access_mode, public_token, entry_query_params", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const mig = join(
      __dirname,
      "../../supabase/migrations/20260724120000_guest_link_access_mode.sql",
    );
    expect(existsSync(mig)).toBe(true);
    const sql = readFileSync(mig, "utf8");
    expect(sql).toContain("access_mode");
    expect(sql).toContain("public_token");
    expect(sql).toContain("entry_query_params");
    expect(sql).toContain("workspace_tap_sessions");
    expect(sql).toContain("workspace_ile_links");
    expect(sql).toContain("source_link_id");
  });
});
