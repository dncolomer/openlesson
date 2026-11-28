import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function walkFiles(dir: string, exts: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("repository hygiene guardrails", () => {
  it("forbids hardcoded macOS /var/folders or /Users paths in tests and scripts", () => {
    const files = [
      ...walkFiles(join(ROOT, "tests"), /\.(ts|tsx|mjs|js)$/),
      ...walkFiles(join(ROOT, "scripts"), /\.(ts|tsx|mjs|js)$/),
    ];
    const self = relative(ROOT, __filename);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (rel === self) continue;
      const content = readFileSync(file, "utf8");
      if (/\/var\/folders\/|\/Users\/(?!me\/)[a-zA-Z0-9._-]+\//.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("centralizes Stripe instantiation in lib/stripe/client.ts", () => {
    const files = [
      ...walkFiles(join(ROOT, "app"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "components"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "lib"), /\.(ts|tsx)$/),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (rel === "lib/stripe/client.ts") continue;
      const content = readFileSync(file, "utf8");
      if (/\bnew\s+Stripe\s*\(/.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids @ts-ignore and @ts-nocheck in production code", () => {
    const files = [
      ...walkFiles(join(ROOT, "app"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "components"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "lib"), /\.(ts|tsx)$/),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (/@ts-ignore\b|@ts-nocheck\b/.test(content)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("forbids importing @/lib/supabase/admin from 'use client' modules", () => {
    const files = [
      ...walkFiles(join(ROOT, "app"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "components"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "lib"), /\.(ts|tsx)$/),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (/^\s*["']use client["']/m.test(content) && content.includes("@/lib/supabase/admin")) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
