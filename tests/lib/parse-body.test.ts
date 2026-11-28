import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-body";

const schema = z.object({
  name: z.string().min(1, "name is required"),
  count: z.number().int().positive().optional(),
});

describe("parseJsonBody", () => {
  it("parses valid payloads into typed data", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "protocol", count: 3 }),
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody(req, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "protocol", count: 3 });
    }
  });

  it("returns 400 jsonError envelope on invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody(req, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("Invalid JSON body");
    }
  });

  it("returns 400 jsonError envelope with first schema issue message", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody(req, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.message).toBe("name is required");
    }
  });
});
