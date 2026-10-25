import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  MAP_NEWSLETTER_SUBSCRIBE_NOTE,
  MAP_NEWSLETTER_SUCCESS_MESSAGE,
  MAP_NOT_ON_MAP_MESSAGE,
  isValidNotifyEmail,
  normalizeNotifyEmail,
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

describe("map newsletter UI + API surfaces (no send path)", () => {
  it("leads store, page client, notify route, and send path are absent", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const notifyApi = join(root, "app/api/map-of-knowledge/notify-when-ready/route.ts");
    const processApi = join(
      root,
      "app/api/map-of-knowledge/process-ready-notifications/route.ts",
    );
    const sendMod = join(root, "lib/map-of-knowledge/send-map-ready-email.ts");
    const store = join(root, "lib/map-of-knowledge/map-ready-notify-store.ts");
    expect(existsSync(client)).toBe(false);
    expect(existsSync(notifyApi)).toBe(false);
    expect(existsSync(processApi)).toBe(false);
    expect(existsSync(sendMod)).toBe(false);
    expect(existsSync(store)).toBe(false);
  });
});
