import { describe, expect, it } from "vitest";
import {
  createEmptyTransferHealth,
  isDuplicateProbe,
  readErrorResponse,
} from "@/components/session/sessionViewHelpers";

describe("sessionViewHelpers", () => {
  it("isDuplicateProbe detects normalized duplicates", () => {
    const existing = [{ text: "Why is the sky blue?" }, { text: "Unrelated" }];
    expect(isDuplicateProbe("Why is the sky blue?", existing)).toBe(true);
    expect(isDuplicateProbe("Completely different question here!", existing)).toBe(false);
  });

  it("createEmptyTransferHealth initializes counters", () => {
    const health = createEmptyTransferHealth();
    expect(health.audio).toEqual({ sent: 0, saved: 0, failed: 0 });
    expect(health.tools.failed).toBe(0);
  });

  it("readErrorResponse prefers JSON error messages", async () => {
    const response = new Response(JSON.stringify({ error: "Nope" }), { status: 422 });
    const message = await readErrorResponse(response, "fallback");
    expect(message).toContain("Nope");
    expect(message).toContain("422");
  });
});
