/**
 * Public Bearer/MCP cannot run the headless Proof-of-Work loop.
 * Headless routes and modules are deleted (missing path = 404).
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

const ROOT = join(__dirname, "../..");

describe("deleted public headless proof-of-work", () => {
  it("headless modules are gone", () => {
    expect(existsSync(join(ROOT, "lib/pow-api/headless-session.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/headless-session-run.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/headless-session-store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/pow-api/public-pow-retired.ts"))).toBe(false);
  });

  it("Bearer session/upload/end/embeddings/schema/guests routes are gone", () => {
    expect(existsSync(join(ROOT, "app/api/v3/pow/workspaces"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/v3/pow/org"))).toBe(false);
  });

  it("MCP catalog has no headless session tools", () => {
    const names = AGENT_TOOL_SURFACE.map((tool) => tool.name);
    expect(names).not.toContain("start_session");
    expect(names).not.toContain("upload_proof_of_work");
    expect(names).not.toContain("end_session");
    expect(names).toContain("create_flow");
    expect(names).toContain("link_flow");
  });
});
