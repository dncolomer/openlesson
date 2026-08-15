/**
 * TAPBench extras live on the error object; link/eval routes share one auth return.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNestedApiErrorEnvelope,
  classifyApiErrorEnvelope,
  jsonError,
} from "@/lib/api-error-envelope";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-605d3ab12c6a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("TAPBench stash extras + product workspace auth shape", () => {
  it("extras sit on error (not details); routes call shared helpers directly", async () => {
    const extras = {
      expires_at: "2026-08-16T12:00:00.000Z",
      remaining_ms: 0,
      tapbench: true,
    };
    const envelope = buildNestedApiErrorEnvelope(
      "session_expired",
      "TAPBench session expired",
      extras,
    );
    expect(classifyApiErrorEnvelope(envelope)).toBe("nested_code");
    expect(envelope.error.code).toBe("session_expired");
    expect(envelope.error.message).toBe("TAPBench session expired");
    expect(envelope.error.expires_at).toBe(extras.expires_at);
    expect(envelope.error.remaining_ms).toBe(0);
    expect(envelope.error.tapbench).toBe(true);
    expect(envelope.error.details).toBeUndefined();

    const res = jsonError(401, "TAPBench session expired", "session_expired", extras);
    expect(res.status).toBe(401);
    const body = (await res.json()) as typeof envelope;
    expect(body.error.expires_at).toBe(extras.expires_at);
    expect(body.error.remaining_ms).toBe(0);
    expect(body.error.tapbench).toBe(true);
    expect(body.error.details).toBeUndefined();

    const stashAuth = read("lib/pow-api/authenticate-stash-request.ts");
    expect(stashAuth).toContain("jsonError(tb.status, tb.message, tb.code, tb.body)");

    const linkRoutes = [
      "app/api/workspace/tap-links/route.ts",
      "app/api/workspace/ile-links/route.ts",
      "app/api/workspace/practice-portals/route.ts",
    ];
    for (const rel of linkRoutes) {
      const src = read(rel);
      expect(src).not.toContain("async function resolveWebAuth");
      expect(src).toContain("requireProductWorkspaceLinkAuth");
      expect(src).toMatch(/if \(!access\.ok\) return access\.response/);
    }

    const evalRoutes = [
      "app/api/workspace/knowledge-config/route.ts",
      "app/api/workspace/snapshot-history/route.ts",
    ];
    for (const rel of evalRoutes) {
      const src = read(rel);
      expect(src).not.toContain("async function resolveWebAuth");
      expect(src).toContain("requireProductWorkspaceEvalAuth");
      expect(src).toMatch(/if \(!auth\.ok\) return auth\.response/);
    }

    const linkAuth = read("lib/product-workspace-auth.ts");
    expect(linkAuth).toContain("{ ok: false; response: NextResponse }");
    expect(linkAuth).toContain("{ ok: true;");
    expect(linkAuth).not.toMatch(/\{ error: string; status: number \}/);

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "auth-error-tests.log"),
      [
        `expires_at=${String(body.error.expires_at)}`,
        `remaining_ms=${String(body.error.remaining_ms)}`,
        `tapbench=${String(body.error.tapbench)}`,
        `details=${String(body.error.details)}`,
        "link/eval routes: no resolveWebAuth; if (!auth.ok) return …",
      ].join("\n"),
      "utf8",
    );
  });
});
