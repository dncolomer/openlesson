/**
 * TAPBench extras live on error.details; link/eval routes share one auth return.
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
    expect(envelope.error.details?.expires_at).toBe(extras.expires_at);
    expect(envelope.error.details?.remaining_ms).toBe(0);
    expect(envelope.error.details?.tapbench).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(envelope.error, "expires_at"),
    ).toBe(false);

    const res = jsonError(401, "TAPBench session expired", "session_expired", extras);
    expect(res.status).toBe(401);
    const body = (await res.json()) as typeof envelope;
    expect(body.error.details?.expires_at).toBe(extras.expires_at);
    expect(body.error.details?.remaining_ms).toBe(0);
    expect(body.error.details?.tapbench).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body.error, "expires_at")).toBe(
      false,
    );

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
    expect(linkAuth).toContain("ok: false");
    expect(linkAuth).toContain("ok: true");
    expect(linkAuth).toContain("principal: WorkspacePrincipal");
    expect(linkAuth).not.toMatch(/\{ error: string; status: number \}/);
    expect(linkAuth).toContain("allowProductWorkspaceLinkAccess");
    expect(linkAuth).toContain("allowProductWorkspaceEvalAccess");
    expect(linkAuth).not.toContain("ProductWorkspaceAuthFlags");
    expect(linkAuth).not.toContain("decideProductWorkspaceAccess");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "auth-error-tests.log"),
      [
        `expires_at=${String(body.error.details?.expires_at)}`,
        `remaining_ms=${String(body.error.details?.remaining_ms)}`,
        `tapbench=${String(body.error.details?.tapbench)}`,
        `detailsKeys=${Object.keys(body.error.details || {}).join(",")}`,
        "link/eval routes: no resolveWebAuth; if (!auth.ok) return …",
      ].join("\n"),
      "utf8",
    );
  });
});
