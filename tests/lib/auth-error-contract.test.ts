/**
 * Session extras live on error.details.
 */
import { describe, expect, it } from "vitest";
import {
  buildNestedApiErrorEnvelope,
  classifyApiErrorEnvelope,
  jsonError,
} from "@/lib/api-error-envelope";

describe("session extras + nested API errors", () => {
  it("puts extras on error.details", async () => {
    const extras = {
      expires_at: "2026-08-16T12:00:00.000Z",
      remaining_ms: 0,
    };
    const envelope = buildNestedApiErrorEnvelope(
      "session_expired",
      "This session has expired.",
      extras,
    );
    expect(classifyApiErrorEnvelope(envelope)).toBe("nested_code");
    expect(envelope.error.code).toBe("session_expired");
    expect(envelope.error.message).toBe("This session has expired.");
    expect(envelope.error.details?.expires_at).toBe(extras.expires_at);
    expect(envelope.error.details?.remaining_ms).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(envelope.error, "expires_at")).toBe(false);

    const res = jsonError(401, "This session has expired.", "session_expired", extras);
    expect(res.status).toBe(401);
    const body = (await res.json()) as typeof envelope;
    expect(body.error.details?.expires_at).toBe(extras.expires_at);
    expect(body.error.details?.remaining_ms).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(body.error, "expires_at")).toBe(false);
  });
});
