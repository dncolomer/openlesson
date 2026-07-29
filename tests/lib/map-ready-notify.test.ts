import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  MAP_NEWSLETTER_SUBSCRIBE_NOTE,
  MAP_NEWSLETTER_SUCCESS_MESSAGE,
  MAP_NOT_ON_MAP_MESSAGE,
  isValidNotifyEmail,
  normalizeNotifyEmail,
  registerMapNewsletterLead,
  validateMapNewsletterRegistration,
} from "@/lib/map-of-knowledge";

const root = join(__dirname, "../..");

describe("map newsletter pure helpers", () => {
  it("validates emails and rejects empty/invalid", () => {
    expect(normalizeNotifyEmail("  You@Example.COM ")).toBe("you@example.com");
    expect(isValidNotifyEmail("a@b.co")).toBe(true);
    expect(isValidNotifyEmail("")).toBe(false);
    expect(isValidNotifyEmail("not-an-email")).toBe(false);
    expect(isValidNotifyEmail(null)).toBe(false);
  });

  it("validateMapNewsletterRegistration requires valid email only", () => {
    expect(validateMapNewsletterRegistration({ email: "bad" }).ok).toBe(false);
    const ok = validateMapNewsletterRegistration({ email: "ok@example.com" });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.email).toBe("ok@example.com");
  });

  it("not-on-map + newsletter copy (no transactional map-ready send promise)", () => {
    expect(MAP_NOT_ON_MAP_MESSAGE.toLowerCase()).toMatch(/periodic snapshot/);
    expect(MAP_NOT_ON_MAP_MESSAGE.toLowerCase()).toMatch(/newsletter/);
    expect(MAP_NOT_ON_MAP_MESSAGE).not.toMatch(/we will notify you when your map location is ready/i);
    expect(MAP_NEWSLETTER_SUBSCRIBE_NOTE.toLowerCase()).toMatch(
      /subscribing to the uncertain systems newsletter/,
    );
    expect(MAP_NEWSLETTER_SUCCESS_MESSAGE.toLowerCase()).toMatch(/newsletter/);
  });
});

describe("registerMapNewsletterLead — real insert path", () => {
  it("persists valid email to leads and rejects invalid email", async () => {
    const inserts: unknown[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe("leads");
        return {
          insert(row: unknown) {
            inserts.push(row);
            return {
              select() {
                return this;
              },
              async maybeSingle() {
                return { data: { id: "lead-1" }, error: null };
              },
            };
          },
        };
      },
    };

    const bad = await registerMapNewsletterLead(supabase as never, { email: "nope" });
    expect(bad.ok).toBe(false);
    expect(inserts).toHaveLength(0);

    const ok = await registerMapNewsletterLead(supabase as never, {
      email: "you@example.com",
      placement_link: "https://x/tap/session/abc",
      guest_user_id: "g1",
      workspace_id: "w1",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.email).toBe("you@example.com");
    expect(ok.message).toBe(MAP_NEWSLETTER_SUCCESS_MESSAGE);
    expect(inserts).toHaveLength(1);
    const row = inserts[0] as {
      email: string;
      audience: string;
      organization: string;
      role: string;
      message: string;
    };
    expect(row.email).toBe("you@example.com");
    expect(row.audience).toBe("newsletter");
    expect(row.organization.toLowerCase()).toMatch(/newsletter/);
    expect(row.role).toBe("map_of_knowledge");
    expect(row.message).toContain("Map of Knowledge");
  });
});

describe("map newsletter UI + API surfaces (no send path)", () => {
  it("ships newsletter subscribe UI and lead API; no Resend/process-ready path", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const notifyApi = join(root, "app/api/map-of-knowledge/notify-when-ready/route.ts");
    const processApi = join(
      root,
      "app/api/map-of-knowledge/process-ready-notifications/route.ts",
    );
    const sendMod = join(root, "lib/map-of-knowledge/send-map-ready-email.ts");
    const store = join(root, "lib/map-of-knowledge/map-ready-notify-store.ts");
    const knowledgeStore = join(root, "lib/pow-api/knowledge-config-store.ts");

    expect(existsSync(client)).toBe(true);
    expect(existsSync(notifyApi)).toBe(true);
    expect(existsSync(processApi)).toBe(false);
    expect(existsSync(sendMod)).toBe(false);

    const clientSrc = readFileSync(client, "utf8");
    expect(clientSrc).toContain("data-map-newsletter-subscribe");
    expect(clientSrc).toContain("data-map-newsletter-subscribe-note");
    expect(clientSrc).toContain("MAP_NEWSLETTER_SUBSCRIBE_NOTE");
    expect(clientSrc).toContain("Subscribe to newsletter");
    expect(clientSrc).not.toContain("Notify me when ready");
    expect(clientSrc).not.toContain("sendMapReadyEmail");
    expect(clientSrc).not.toContain("processPendingMapReadyNotifications");

    const notifySrc = readFileSync(notifyApi, "utf8");
    expect(notifySrc).toContain("registerMapNewsletterLead");
    expect(notifySrc).not.toContain("RESEND");
    expect(notifySrc).not.toContain("sendMapReadyEmail");

    const storeSrc = readFileSync(store, "utf8");
    expect(storeSrc).toContain('.from("leads")');
    expect(storeSrc).toContain('audience: "newsletter"');
    expect(storeSrc).not.toContain("processPendingMapReadyNotifications");
    expect(storeSrc).not.toContain("sendMapReadyEmail");

    const ks = readFileSync(knowledgeStore, "utf8");
    expect(ks).not.toContain("processPendingMapReadyNotifications");
  });
});
