import { describe, expect, it } from "vitest";
import {
  isBlockedWebhookHost,
  normalizeWebhookUrl,
} from "@/lib/pow-api/tap-link-config";

describe("webhook URL SSRF hardening", () => {
  it("allows public https hosts", () => {
    expect(normalizeWebhookUrl("https://hooks.example.com/tap")).toBe(
      "https://hooks.example.com/tap"
    );
  });

  it("blocks private and metadata hosts", () => {
    expect(isBlockedWebhookHost("127.0.0.1")).toBe(true);
    expect(isBlockedWebhookHost("localhost")).toBe(true);
    expect(isBlockedWebhookHost("10.0.0.5")).toBe(true);
    expect(isBlockedWebhookHost("192.168.1.1")).toBe(true);
    expect(isBlockedWebhookHost("172.16.0.1")).toBe(true);
    expect(isBlockedWebhookHost("169.254.169.254")).toBe(true);
    expect(isBlockedWebhookHost("metadata.google.internal")).toBe(true);

    expect(normalizeWebhookUrl("http://127.0.0.1/")).toBeNull();
    expect(normalizeWebhookUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(normalizeWebhookUrl("https://10.1.2.3/hook")).toBeNull();
  });

  it("still rejects non-http schemes", () => {
    expect(normalizeWebhookUrl("ftp://example.com")).toBeNull();
    expect(normalizeWebhookUrl("not-a-url")).toBeNull();
  });
});
