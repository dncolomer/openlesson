/**
 * TAP is the interface for Preparing, Learning, Drilling, and Validating.
 * The retired product word must not remain in comments, markdown, locale
 * strings, or quoted copy. Identifiers, /ile/ routes, billing fields, and
 * stored proof action ids stay.
 *
 * Drives shipped sources — not a hand-copied fixture.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = join(__dirname, "../..");
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "coverage", "dist", "out"]);
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".mdx",
  ".json",
  ".html",
  ".txt",
  ".yml",
  ".yaml",
  ".css",
]);

/** Retired product acronym, built so this file does not contain the token. */
const RETIRED = ["I", "L", "E"].join("");
const RETIRED_PHRASE = ["Integrated Learning", " Environment"].join("");
const RETIRED_WORD = new RegExp(`(?<![A-Za-z0-9_])${RETIRED}(?![A-Za-z0-9_])`);
const RETIRED_PHRASE_RE = new RegExp(RETIRED_PHRASE, "i");

const FORMER_PRODUCT_SLOTS = [
  "app/layout.tsx",
  "app/knowledge-verification/page.tsx",
  "app/skill-verification/SkillVerificationLanding.tsx",
  "lib/seo/platform-page.ts",
  "lib/seo/product-page.ts",
  "lib/seo/products.ts",
  "lib/prompt-kernel/ontology.ts",
  "lib/prompt-kernel/surfaces/ile.ts",
  "lib/sales/platform-pitch-deck.ts",
  "lib/marketing/verification-product.ts",
];

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TEXT_EXT.has(extname(name))) out.push(path);
  }
}

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("retired product language is gone from shipped prose", () => {
  it("comments, markdown, locale strings, and quoted strings do not name the retired product", () => {
    const files: string[] = [];
    walk(ROOT, files);
    const hits: string[] = [];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      const ext = extname(path);
      const prose =
        ext === ".md" || ext === ".mdx" || ext === ".json" || ext === ".html" || ext === ".txt"
          ? text
          : text;
      if (RETIRED_WORD.test(prose) || RETIRED_PHRASE_RE.test(prose)) {
        const rel = path.slice(ROOT.length + 1);
        const line = prose.split("\n").findIndex((row) => RETIRED_WORD.test(row) || RETIRED_PHRASE_RE.test(row));
        hits.push(`${rel}:${line + 1}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("former product slots name TAP with Preparing, Learning, Drilling, and Validating", () => {
    for (const rel of FORMER_PRODUCT_SLOTS) {
      const text = read(rel);
      expect(text, rel).toMatch(/\bTAP\b/);
      expect(text, rel).toContain("Preparing");
      expect(text, rel).toContain("Learning");
      expect(text, rel).toContain("Drilling");
      expect(text, rel).toContain("Validating");
    }
  });

  it("keeps Agentic Learning Environment and the stored route, meter, and proof id", () => {
    expect(read("app/layout.tsx")).toContain("Agentic Learning Environment");
    expect(read("lib/ile-tim-chapter-complete.ts")).toContain("upload_ile_chapter_done");
    expect(read("app/ile/session/[token]/page.tsx")).toContain("/ile/session/");
    expect(read("app/api/stripe/webhook/route.ts")).toContain("ileSessions");
    expect(read("app/api/stripe/webhook/route.ts")).toContain("TAP Learning session");
  });

  it("translated locales drop the retired environment name and keep the agent one", () => {
    const retiredEnvironmentNames = [
      "Integrierte Lernumgebung",
      "Integrierten Lernumgebung",
      "Integrierte Lernumg.",
      "Entorno de Aprendizaje Integrado",
      "Entorno de Aprendizaje Int.",
      "Zintegrowane Środowisko Nauki",
      "Zintegrowanym Środowisku Nauki",
      "Zintegrowane Środ. Nauki",
      "Môi trường Học tập Tích hợp",
      "集成学习环境",
      "综合学习环境",
    ];
    const agentNames: Record<string, string> = {
      de: "Agentische Lernumgebung",
      es: "Entorno de Aprendizaje Agéntico",
      pl: "Agentowe Środowisko Nauki",
      vi: "Môi trường Học tập Tác nhân",
      zh: "智能体学习环境",
    };
    for (const code of Object.keys(agentNames)) {
      const text = read(`messages/${code}.json`);
      for (const name of retiredEnvironmentNames) {
        expect(text, `${code} still names ${name}`).not.toContain(name);
      }
      expect(text, code).toContain(agentNames[code]);
    }
  });

  it("every locale welcome follows the English TAP Learning wording", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      welcome: { panelIntro: string; panelIntroMobile: string };
    };
    expect(en.welcome.panelIntro.startsWith("Welcome to TAP Learning.")).toBe(true);
    expect(en.welcome.panelIntroMobile.startsWith("Welcome to TAP Learning.")).toBe(true);
    for (const code of ["en", "de", "es", "pl", "vi", "zh"]) {
      const data = JSON.parse(read(`messages/${code}.json`)) as {
        welcome: { panelIntro: string; panelIntroMobile: string };
      };
      expect(data.welcome.panelIntro, code).toBe(en.welcome.panelIntro);
      expect(data.welcome.panelIntroMobile, code).toBe(en.welcome.panelIntroMobile);
    }
  });
});
