/**
 * Live product language names Calibrate, Learn, and Verify.
 * TAP, TAP Learning, and the retired environment acronym are not product
 * names on live surfaces. Identifiers, billing fields, and stored proof
 * action ids stay. Science Think Aloud Protocol copy is out of scope here.
 *
 * Drives shipped sources — not a hand-copied fixture.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

/** Retired product acronym, built so this file does not contain the token. */
const RETIRED = ["I", "L", "E"].join("");
const RETIRED_PHRASE = ["Integrated Learning", " Environment"].join("");
const RETIRED_WORD = new RegExp(`(?<![A-Za-z0-9_])${RETIRED}(?![A-Za-z0-9_])`);
const RETIRED_PHRASE_RE = new RegExp(RETIRED_PHRASE, "i");
const RETIRED_AGENT = ["A", "L", "E"].join("");
const RETIRED_AGENT_PHRASE = ["Agentic Learning", " Environment"].join("");
const RETIRED_AGENT_WORD = new RegExp(`(?<![A-Za-z0-9_])${RETIRED_AGENT}(?![A-Za-z0-9_])`);
const RETIRED_AGENT_PHRASE_RE = new RegExp(RETIRED_AGENT_PHRASE, "i");

function namesRetiredProduct(text: string) {
  return (
    RETIRED_WORD.test(text) ||
    RETIRED_PHRASE_RE.test(text) ||
    RETIRED_AGENT_WORD.test(text) ||
    RETIRED_AGENT_PHRASE_RE.test(text)
  );
}

const FORMER_PRODUCT_SLOTS = [
  "app/layout.tsx",
  "app/knowledge-verification/page.tsx",
  "app/skill-verification/SkillVerificationLanding.tsx",
  "lib/seo/platform-page.ts",
  "lib/seo/product-page.ts",
  "lib/seo/products.ts",
  "lib/prompt-kernel/ontology.ts",
  "lib/prompt-kernel/surfaces/ile.ts",
  "lib/prompt-kernel/surfaces/tap.ts",
  "lib/sales/platform-pitch-deck.ts",
  "lib/marketing/verification-product.ts",
];

/** Live product surfaces — identifiers and internal comments elsewhere may keep stored names. */
const LIVE_SURFACES = [
  ...FORMER_PRODUCT_SLOTS,
  "README.md",
  "docs/PROOF_OF_WORK_API.md",
  "public/docs/proof-of-work-api-guide.md",
  "public/skill.md",
  "lib/session-instructions.ts",
  "lib/pow-api/agent-tool-surface.ts",
  "lib/pow-api/mcp-tools/evidence-tools.ts",
  "lib/pow-api/pow-model-agent-contract.ts",
  "lib/pow-api/stash-api.ts",
  "lib/prompt-kernel/surfaces/score-context.ts",
  "app/docs/proof-of-work-api/layout.tsx",
  "app/docs/proof-of-work-api/page.tsx",
  "components/tap-score/tap-score-phases.tsx",
  "components/tap-score/use-tap-score-flow.ts",
  "components/SessionItem.tsx",
  "components/workspace-view/use-workspace-learner.ts",
  "components/InsightsDashboardTab.tsx",
  "components/CustomVerificationModelsPanel.tsx",
  "components/WorkspaceDataStudioPanel.tsx",
];

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Drop // and block comments so a lineup ban does not police engineering notes. */
function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("retired product language is gone from shipped prose", () => {
  it("live product surfaces do not name the retired environment", () => {
    const tapWord = /\bTAP\b/;
    const hits: string[] = [];
    for (const rel of LIVE_SURFACES) {
      const text = stripComments(read(rel));
      if (namesRetiredProduct(text) || tapWord.test(text) || text.includes("TAP Learning")) {
        const line = text
          .split("\n")
          .findIndex(
            (row) =>
              namesRetiredProduct(row) || tapWord.test(row) || row.includes("TAP Learning"),
          );
        hits.push(`${rel}:${line + 1}`);
      }
    }
    for (const code of ["en", "de", "es", "pl", "vi", "zh"]) {
      const rel = `messages/${code}.json`;
      const text = read(rel);
      if (namesRetiredProduct(text) || tapWord.test(text) || text.includes("TAP Learning")) {
        const line = text
          .split("\n")
          .findIndex(
            (row) =>
              namesRetiredProduct(row) || tapWord.test(row) || row.includes("TAP Learning"),
          );
        hits.push(`${rel}:${line + 1}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("former product slots name Calibrate, Learn, and Verify", () => {
    const tapWord = /\bTAP\b/;
    for (const rel of FORMER_PRODUCT_SLOTS) {
      const text = stripComments(read(rel));
      expect(text, rel).toContain("Calibrate");
      expect(text, rel).toContain("Learn");
      expect(text, rel).toContain("Verify");
      expect(text, rel).not.toMatch(tapWord);
      expect(text, rel).not.toContain("TAP Learning");
    }
  });

  it("keeps the stored meter and proof id", () => {
    expect(read("lib/ile-tim-chapter-complete.ts")).toContain("upload_ile_chapter_done");
    expect(read("app/api/stripe/webhook/route.ts")).toContain("ileSessions");
    expect(read("app/api/stripe/webhook/route.ts")).toContain("Learning session");
    expect(read("app/api/stripe/webhook/route.ts")).not.toContain("TAP Learning session");
  });

  it("translated locales drop the retired environment names", () => {
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
      "Agentische Lernumgebung",
      "Entorno de Aprendizaje Agéntico",
      "Agentowe Środowisko Nauki",
      "Môi trường Học tập Tác nhân",
      "智能体学习环境",
    ];
    for (const code of ["de", "es", "pl", "vi", "zh"]) {
      const text = read(`messages/${code}.json`);
      for (const name of retiredEnvironmentNames) {
        expect(text, `${code} still names ${name}`).not.toContain(name);
      }
    }
  });

  it("lineup copy is Calibrate, Learn, and Verify", () => {
    const lineup = "Calibrate, Learn, and Verify";
    const tapWord = /\bTAP\b/;
    const lineupFiles = [
      "app/layout.tsx",
      "app/knowledge-verification/page.tsx",
      "app/skill-verification/SkillVerificationLanding.tsx",
      "app/docs/proof-of-work-api/page.tsx",
      "lib/marketing/verification-product.ts",
      "lib/seo/platform-page.ts",
      "lib/seo/product-page.ts",
      "lib/seo/products.ts",
      "lib/seo/use-case-page.ts",
      "lib/sales/platform-pitch-deck.ts",
      "lib/sales/verification-pitch-deck.ts",
      "lib/sales/augmentation-pitch-deck.ts",
      "lib/sales/optimization-pitch-deck.ts",
      "lib/sales/pitch-index.ts",
      "components/ProductTable.tsx",
      "components/SeoSolutionPage.tsx",
      "docs/pitch/build-product-pitch.mjs",
      "lib/prompt-kernel/ontology.ts",
      "lib/prompt-kernel/surfaces/ile.ts",
      "lib/prompts.ts",
      "lib/prompt-workspace-context.ts",
      "app/api/stripe/webhook/route.ts",
      "public/skill.md",
    ];
    for (const rel of lineupFiles) {
      const text = stripComments(read(rel));
      expect(text, rel).toContain(lineup);
      expect(text, rel).not.toContain("TAP Learning");
      expect(text, rel).not.toMatch(tapWord);
    }
    expect(read("lib/ile-tim-chapter-complete.ts")).toContain("upload_ile_chapter_done");
    expect(read("app/api/stripe/webhook/route.ts")).toContain("ileSessions");
  });

  it("Verify session chrome names Verify instead of TAP", () => {
    const tapWord = /\bTAP\b/;
    const chrome = [
      "components/tap-score/tap-score-phases.tsx",
      "components/tap-score/use-tap-score-flow.ts",
    ];
    for (const rel of chrome) {
      const text = stripComments(read(rel));
      expect(text, rel).not.toMatch(tapWord);
      expect(text, rel).not.toContain("TAP Learning");
      expect(text, rel).not.toContain("Exercise TAP");
    }
    expect(existsSync(join(ROOT, "components/exercise-tap/exercise-tap-phases.tsx"))).toBe(false);

    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      'title="Could not end Verify session"',
    );
    expect(read("components/tap-score/use-tap-score-flow.ts")).toContain(
      "Could not start Verify session",
    );
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);
  });

  it("session chrome locales drop TAP as a product name", () => {
    const tapWord = /\bTAP\b/;
    for (const code of ["en", "de", "es", "pl", "vi", "zh"]) {
      const data = JSON.parse(read(`messages/${code}.json`)) as {
        tap: { welcome: { panelIntro: string } };
        onboardingGuide: { tap: { title: string } };
        welcome: { panelIntro: string };
      };
      expect(data.tap.welcome.panelIntro, code).toMatch(/^Welcome to Verify\./);
      expect(data.tap.welcome.panelIntro, code).not.toMatch(tapWord);
      expect(data.tap.welcome.panelIntro, code).not.toContain("TAP Learning");
      expect(data.tap.welcome.panelIntro, code).not.toContain("Think Aloud Protocol");
      expect(data.onboardingGuide.tap.title, code).toBe("Verify");
      expect(data.welcome.panelIntro, code).toMatch(/^Welcome to Learn\./);
    }
  });

  it("locale product rows name Calibrate, Learn, and Verify", () => {
    const lineup = "Calibrate, Learn, and Verify";
    for (const code of ["en", "de", "es", "pl", "vi", "zh"]) {
      const data = JSON.parse(read(`messages/${code}.json`)) as {
        planView: Record<string, string>;
        welcome: { panelIntro: string };
      };
      const plan = data.planView;
      expect(plan.productIle, code).toBe("Learn");
      expect(plan.productIleHint, code).toBe(lineup);
      expect(plan.guestLinksFilterKindTap, code).toBe("Calibrate and Verify");
      expect(plan.guestLinksFilterKindIle, code).toBe("Learn");
      expect(plan.productIle, code).not.toContain("TAP");
      expect(data.welcome.panelIntro.startsWith("Welcome to Learn.")).toBe(true);
    }
  });

  it("every locale welcome follows the English Learn wording", () => {
    const en = JSON.parse(read("messages/en.json")) as {
      welcome: { panelIntro: string; panelIntroMobile: string };
    };
    expect(en.welcome.panelIntro.startsWith("Welcome to Learn.")).toBe(true);
    expect(en.welcome.panelIntroMobile.startsWith("Welcome to Learn.")).toBe(true);
    expect(en.welcome.panelIntro).not.toMatch(/\bTAP\b/);
    expect(en.welcome.panelIntroMobile).not.toMatch(/\bTAP\b/);
    for (const code of ["en", "de", "es", "pl", "vi", "zh"]) {
      const data = JSON.parse(read(`messages/${code}.json`)) as {
        welcome: { panelIntro: string; panelIntroMobile: string };
      };
      expect(data.welcome.panelIntro, code).toBe(en.welcome.panelIntro);
      expect(data.welcome.panelIntroMobile, code).toBe(en.welcome.panelIntroMobile);
    }
  });
});
