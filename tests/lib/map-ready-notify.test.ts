import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  MAP_NOT_ON_MAP_MESSAGE,
  buildMapReadyNotifyEmail,
  isValidNotifyEmail,
  normalizeNotifyEmail,
  processPendingMapReadyNotifications,
  shouldNotifyMapReadyRequest,
  validateMapReadyNotifyRegistration,
} from "@/lib/map-of-knowledge";

const root = join(__dirname, "../..");

describe("map-ready notify pure helpers", () => {
  it("validates emails and rejects empty/invalid", () => {
    expect(normalizeNotifyEmail("  You@Example.COM ")).toBe("you@example.com");
    expect(isValidNotifyEmail("a@b.co")).toBe(true);
    expect(isValidNotifyEmail("")).toBe(false);
    expect(isValidNotifyEmail("not-an-email")).toBe(false);
    expect(isValidNotifyEmail(null)).toBe(false);
  });

  it("validateMapReadyNotifyRegistration requires email + identity", () => {
    expect(
      validateMapReadyNotifyRegistration({
        email: "bad",
        guest_user_id: "g1",
        workspace_id: "w1",
      }).ok,
    ).toBe(false);
    expect(
      validateMapReadyNotifyRegistration({
        email: "ok@example.com",
        guest_user_id: "",
        workspace_id: "w1",
      }).ok,
    ).toBe(false);
    const ok = validateMapReadyNotifyRegistration({
      email: "ok@example.com",
      guest_user_id: "g1",
      workspace_id: "w1",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.email).toBe("ok@example.com");
  });

  it("shouldNotifyMapReadyRequest only when present and not yet notified", () => {
    const base = {
      email: "a@b.co",
      guest_user_id: "g1",
      workspace_id: "w1",
      notified_at: null as string | null,
    };
    expect(shouldNotifyMapReadyRequest(base, true)).toBe(true);
    expect(shouldNotifyMapReadyRequest(base, false)).toBe(false);
    expect(shouldNotifyMapReadyRequest({ ...base, notified_at: "2026-01-01T00:00:00Z" }, true)).toBe(
      false,
    );
    expect(shouldNotifyMapReadyRequest({ ...base, email: "nope" }, true)).toBe(false);
  });

  it("buildMapReadyNotifyEmail includes address and map URL", () => {
    const mail = buildMapReadyNotifyEmail({
      email: "you@example.com",
      mapUrl: "https://uncertain.systems/map-of-knowledge",
      workspaceTitle: "Physics",
    });
    expect(mail.to).toBe("you@example.com");
    expect(mail.subject.toLowerCase()).toMatch(/map of knowledge|location is ready/);
    expect(mail.text).toContain("https://uncertain.systems/map-of-knowledge");
    expect(mail.text).toContain("Physics");
    expect(mail.html).toContain("Find yourself");
  });

  it("MAP_NOT_ON_MAP_MESSAGE mentions periodic snapshots and email notify", () => {
    expect(MAP_NOT_ON_MAP_MESSAGE.toLowerCase()).toMatch(/periodic snapshot/);
    expect(MAP_NOT_ON_MAP_MESSAGE.toLowerCase()).toMatch(/email/);
    expect(MAP_NOT_ON_MAP_MESSAGE).not.toMatch(
      /Finish the session and wait until your practice is processed/,
    );
  });
});

describe("processPendingMapReadyNotifications — send path", () => {
  it("invokes sendEmail when subject is ready and marks notified; skips missing subjects", async () => {
    const pending = [
      {
        id: "req-ready",
        email: "ready@example.com",
        guest_user_id: "guest-ready",
        workspace_id: "ws-1",
        notified_at: null,
      },
      {
        id: "req-waiting",
        email: "wait@example.com",
        guest_user_id: "guest-wait",
        workspace_id: "ws-1",
        notified_at: null,
      },
    ];
    const updates: Array<{ id: string; notified_at: string }> = [];
    const sent: string[] = [];

    // Minimal supabase chain mock for select/eq/is/order/limit + snapshot checks + update
    const supabase = {
      from(table: string) {
        if (table === "map_ready_notify_requests") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            is() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return this;
            },
            async maybeSingle() {
              return { data: null, error: null };
            },
            then(resolve: (v: unknown) => void) {
              // await query → list
              resolve({ data: pending, error: null });
            },
            update(payload: { notified_at: string }) {
              return {
                eq(col: string, val: string) {
                  if (col === "id") {
                    updates.push({ id: val, notified_at: payload.notified_at });
                  }
                  return {
                    is() {
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "workspaces") {
          return {
            select() {
              return this;
            },
            eq(_c: string, id: string) {
              this._id = id;
              return this;
            },
            async maybeSingle() {
              return {
                data: {
                  id: this._id,
                  is_public: true,
                  archived_at: null,
                  status: "active",
                  title: "Demo WS",
                },
                error: null,
              };
            },
            _id: "",
          };
        }
        if (table === "knowledge_config_snapshots") {
          return {
            select() {
              return this;
            },
            eq(col: string, val: string) {
              this._filters = this._filters || {};
              this._filters[col] = val;
              return this;
            },
            limit() {
              return this;
            },
            async maybeSingle() {
              const guest = this._filters?.subject_guest_user_id;
              if (guest === "guest-ready") {
                return { data: { id: "snap-1" }, error: null };
              }
              return { data: null, error: null };
            },
            _filters: {} as Record<string, string>,
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await processPendingMapReadyNotifications(supabase as never, {
      sendEmail: async (p) => {
        sent.push(p.email);
        return { ok: true, provider: "test" };
      },
      mapUrl: "https://example.com/map-of-knowledge",
    });

    expect(sent).toEqual(["ready@example.com"]);
    expect(result.notified).toBe(1);
    expect(result.checked).toBe(2);
    expect(updates.some((u) => u.id === "req-ready" && u.notified_at)).toBe(true);
  });
});

describe("map-ready notify UI + API surfaces", () => {
  it("ships not-on-map email capture and notify APIs", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const notifyApi = join(root, "app/api/map-of-knowledge/notify-when-ready/route.ts");
    const processApi = join(root, "app/api/map-of-knowledge/process-ready-notifications/route.ts");
    const mig = join(
      root,
      "supabase/migrations/20260729190000_map_ready_notify_requests.sql",
    );
    expect(existsSync(client)).toBe(true);
    expect(existsSync(notifyApi)).toBe(true);
    expect(existsSync(processApi)).toBe(true);
    expect(existsSync(mig)).toBe(true);

    const clientSrc = readFileSync(client, "utf8");
    expect(clientSrc).toContain("MAP_NOT_ON_MAP_MESSAGE");
    expect(clientSrc).toContain("data-map-ready-notify");
    expect(clientSrc).toContain("data-map-ready-notify-email");
    expect(clientSrc).toContain("data-map-ready-notify-submit");
    expect(clientSrc).toContain("notify-when-ready");
    expect(clientSrc).toContain("findYourselfAwaitingSnapshot");

    const notifySrc = readFileSync(notifyApi, "utf8");
    expect(notifySrc).toContain("registerMapReadyNotifyRequest");

    const processSrc = readFileSync(processApi, "utf8");
    expect(processSrc).toContain("processPendingMapReadyNotifications");

    const storeSrc = readFileSync(
      join(root, "lib/pow-api/knowledge-config-store.ts"),
      "utf8",
    );
    expect(storeSrc).toContain("processPendingMapReadyNotifications");
  });
});
