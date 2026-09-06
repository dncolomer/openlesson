import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { BRAND_NAME, BRAND_SHORT, BRAND_SLUG, MCP_RESOURCE_SCHEME } from "@/lib/brand";
import { MCP_PROOF_OF_WORK_SERVER_NAME } from "@/lib/pow-api/mcp-proof-of-work-server";
import { buildTapThoughtTracePayload } from "@/lib/tap-score-traces";
import { buildIleThoughtTracePayload } from "@/lib/ile-thought-traces";
import { deriveSkillName } from "@/lib/pow-api/integration-skill";
import { buildMcpClientConfig } from "@/lib/pow-api/mcp-proof-of-work-catalog";
import { UNCERTAIN_SYSTEMS_SCOPE } from "@/lib/pow-api/integration-discovery";

const ROOT = process.cwd();

/** Directory scopes scanned recursively for product-brand tokens. */
const SCOPES = ["app", "components", "lib", "messages", "public", "supabase"];

/**
 * Explicit residual files outside SCOPES walk (env templates, docs entry points).
 * These must not carry OpenLesson as product name.
 */
const RESIDUAL_FILES = [
  ".env.local.example",
  ".env.e2e.example",
  ".env.example",
  "supabase/schema.sql",
  "docs/PROOF_OF_WORK_API.md",
  "README.md",
];

const EXT = new Set([".ts", ".tsx", ".json", ".md", ".mjs", ".sql", ".example", ""]);

/** Product-name forms that must not appear as brand (repo path / external hosts excluded). */
const FORBIDDEN = [
  /\bOpenLesson\b/,
  /\bopenLesson\b/,
  /\bOPENLESSON\b/,
  /\bOpen Lesson\b/,
  /used by openLesson/i,
  /Product "openLesson/i,
  /openlesson:\/\//i,
  /openlesson_scope/,
  /openlesson_tap_/,
  /openlesson_ile_/,
  /openlesson-proof-of-work/,
  /@\/lib\/openlesson-demo\//,
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "migrations") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name)) || name.endsWith(".example")) out.push(full);
  }
  return out;
}

function scrubAllowed(text: string, root: string): string {
  let t = text.replaceAll(root, "");
  // allow github repo URL path and external hosts we do not control
  t = t.replace(/github\.com\/dncolomer\/openlesson/g, "");
  t = t.replace(/openlesson\.academy/g, "");
  t = t.replace(/cal\.com\/[^\s"]*openlesson[^\s"]*/g, "");
  t = t.replace(/pc-hackathon\.openlesson\.academy/g, "");
  return t;
}

function collectOffenders(files: string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    // remediation filter may still ban the token as platform language
    if (file.endsWith("performance-report.ts") && file.includes("pow-api")) continue;
    // this test file itself lists forbidden patterns
    if (file.endsWith("brand-rebrand.test.ts")) continue;
    let text = scrubAllowed(readFileSync(file, "utf8"), ROOT);
    for (const re of FORBIDDEN) {
      if (re.test(text)) {
        offenders.push(`${path.relative(ROOT, file)} :: ${re}`);
        break;
      }
    }
  }
  return offenders;
}

describe("Uncertain Systems brand", () => {
  it("exports brand constants", () => {
    expect(BRAND_NAME).toBe("Uncertain Systems");
    expect(BRAND_SHORT).toBe("unsys");
    expect(BRAND_SLUG).toBe("uncertain-systems");
    expect(MCP_RESOURCE_SCHEME).toBe("uncertain-systems://");
    expect(MCP_PROOF_OF_WORK_SERVER_NAME).toBe("uncertain-systems-proof-of-work-api");
    expect(UNCERTAIN_SYSTEMS_SCOPE.mission.length).toBeGreaterThan(10);
  });

  it("payload builders use uncertain_systems type prefixes", () => {
    const tap = buildTapThoughtTracePayload({
      traceType: "system1",
      action: "crystallize",
      tapSessionId: "t1",
      workspaceId: "w1",
      text: "hello",
    });
    expect(tap.type).toBe("uncertain_systems_tap_thought_trace");

    const ile = buildIleThoughtTracePayload({
      traceType: "system2",
      action: "send",
      sessionId: "s1",
      workspaceId: "w1",
      text: "hi",
    });
    expect(ile.type).toBe("uncertain_systems_ile_thought_trace");
  });

  it("skill names and MCP catalog use uncertain-systems", () => {
    expect(deriveSkillName("Acme Sales Copilot")).toBe(
      "acme-sales-copilot-uncertain-systems-proof-of-work-performance"
    );
    const config = JSON.parse(buildMcpClientConfig("http://localhost:3000", "sk_test"));
    expect(config.mcpServers["uncertain-systems"]).toBeTruthy();
  });

  it("scoped source trees do not reintroduce OpenLesson product brand", () => {
    const files: string[] = [];
    for (const scope of SCOPES) {
      files.push(...walk(path.join(ROOT, scope)));
    }
    expect(collectOffenders(files)).toEqual([]);
  });

  it("env templates and schema entry point do not brand as openLesson", () => {
    const residual = RESIDUAL_FILES.map((rel) => path.join(ROOT, rel));
    const offenders = collectOffenders(residual);
    expect(offenders).toEqual([]);

    // Positive assertions on the files the skeptic named
    const envExample = path.join(ROOT, ".env.local.example");
    expect(existsSync(envExample)).toBe(true);
    const envText = readFileSync(envExample, "utf8");
    expect(envText).toMatch(/Uncertain Systems/);
    expect(envText).not.toMatch(/openLesson|OpenLesson|OPENLESSON/);

    const schema = path.join(ROOT, "supabase/schema.sql");
    expect(existsSync(schema)).toBe(true);
    const schemaText = readFileSync(schema, "utf8");
    expect(schemaText).toMatch(/Uncertain Systems/);
    expect(schemaText).not.toMatch(/OPENLESSON|OpenLesson|openLesson/);
  });
});
