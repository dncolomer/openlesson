/**
 * Static + structural tests for the non-demo admin status endpoint.
 * Drives the shipped route module shape (export GET, is_admin selection).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("GET /api/me/status (admin gate rehome)", () => {
  it("exports GET and resolves is_admin from profiles", () => {
    const src = readFileSync(join(ROOT, "app/api/me/status/route.ts"), "utf8");
    expect(src).toContain("export async function GET");
    expect(src).toContain('.from("profiles")');
    expect(src).toContain("is_admin");
    expect(src).toContain("authenticated");
    expect(src).toContain("isAdmin");
  });

});
