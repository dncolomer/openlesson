import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertEnvVars, getPublicEnv, getServerEnv } from "@/lib/config/env";
import { clientIpFromRequest, enforceIpRateLimit } from "@/lib/api/rate-limit";

describe("lib/config/env", () => {
  it("normalizes blank env strings to undefined", () => {
    const pub = getPublicEnv({
      NEXT_PUBLIC_APP_URL: "  ",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    } as unknown as NodeJS.ProcessEnv);
    expect(pub.NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(pub.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("parses server env defaults and validates required keys", () => {
    const env = getServerEnv({ NODE_ENV: "test" } as unknown as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe("test");
    expect(() =>
      assertEnvVars(["STRIPE_SECRET_KEY", "MCP_OAUTH_SECRET"], {
        NODE_ENV: "test",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/STRIPE_SECRET_KEY, MCP_OAUTH_SECRET/);
  });
});

describe("lib/api/rate-limit", () => {
  it("extracts client IP from x-forwarded-for or x-real-ip", () => {
    const req1 = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientIpFromRequest(req1)).toBe("203.0.113.5");

    const req2 = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientIpFromRequest(req2)).toBe("198.51.100.7");
  });

  it("enforces per-IP limit and returns 429 with Retry-After", async () => {
    const scope = `test-scope-${Date.now()}`;
    const makeReq = () =>
      new NextRequest("http://localhost/api/test", {
        headers: { "x-forwarded-for": "192.0.2.42" },
      });

    expect(await enforceIpRateLimit(makeReq(), scope, 2)).toBeNull();
    expect(await enforceIpRateLimit(makeReq(), scope, 2)).toBeNull();

    const blocked = await enforceIpRateLimit(makeReq(), scope, 2);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });
});
