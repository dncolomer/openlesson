import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionGuestTokensFromBody } from "@/lib/api/require-auth";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("session-scoped PoW and embeddings", () => {
  it("ships session proof and embed routes", () => {
    expect(existsSync(join(ROOT, "app/api/session/proof-of-work/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/session/embed/route.ts"))).toBe(true);
    const pow = read("app/api/session/proof-of-work/route.ts");
    expect(pow).toContain("requireSessionProofAccess");
    expect(pow).toContain("uploadWorkspaceProofOfWork");
    const embed = read("app/api/session/embed/route.ts");
    expect(embed).toContain("persistCompletedFlowEmbedding");
    expect(embed).not.toContain("persistSolveCompletedEmbedding");
  });

  it("clients post to session routes without requiring a workspace id", () => {
    const embedClient = read("lib/flow-embedding-client.ts");
    expect(embedClient).toContain("/api/session/embed");
    expect(embedClient).not.toContain("/api/workspace/flow-embeddings");
  });

  it("extracts guest tokens cleanly without AYCL token", () => {
    expect(sessionGuestTokensFromBody({ ayclToken: "legacy", ileToken: "t1", solveToken: "s1" })).toEqual({
      ayclToken: null,
      ileToken: "t1",
      solveToken: "s1",
    });
  });
});
