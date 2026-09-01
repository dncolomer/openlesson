import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

/** Collect static dotted keys from t("a.b") / translateWithLocale(locale, "a.b"). */
export function collectUsedDottedUiKeys(roots: string[] = ["components", "app"]): string[] {
  const keyRe =
    /\b(?:t|translateWithLocale)\(\s*(?:locale\s*,\s*)?["'`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g;
  const used = new Set<string>();
  for (const root of roots) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const text = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      const re = new RegExp(keyRe.source, "g");
      while ((m = re.exec(text))) used.add(m[1]);
    }
  }
  return [...used].sort();
}

export function getMessageLeaf(
  messages: Record<string, unknown>,
  dotted: string,
): unknown {
  const parts = dotted.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in (cur as object))) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function findMissingUiKeys(
  usedKeys: string[],
  enMessages: Record<string, unknown>,
): string[] {
  return usedKeys.filter((key) => {
    const val = getMessageLeaf(enMessages, key);
    return typeof val !== "string" || !val.trim();
  });
}

describe("UI i18n surface keys resolve in en.json", () => {
  const en = JSON.parse(
    fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8"),
  ) as Record<string, unknown>;

  it("collects dotted t()/translateWithLocale keys from components and app", () => {
    const keys = collectUsedDottedUiKeys();
    expect(keys.length).toBeGreaterThan(100);
    // Known surface that previously showed raw keys
    expect(keys).toContain("chapterMap.editPromptPlaceholder");
    expect(keys).toContain("chapterMap.editSuggest");
  });

  it("every used dotted UI key has a non-empty English string", () => {
    const used = collectUsedDottedUiKeys();
    const missing = findMissingUiKeys(used, en);
    expect(missing, `Missing en strings:\n${missing.join("\n")}`).toEqual([]);
  });

  it("chapterMap edit surface keys are real copy (not raw keys)", () => {
    const placeholder = getMessageLeaf(en, "chapterMap.editPromptPlaceholder");
    const suggest = getMessageLeaf(en, "chapterMap.editSuggest");
    expect(typeof placeholder).toBe("string");
    expect(typeof suggest).toBe("string");
    expect(String(placeholder).trim().length).toBeGreaterThan(5);
    expect(String(suggest).trim().length).toBeGreaterThan(3);
    expect(placeholder).not.toBe("chapterMap.editPromptPlaceholder");
    expect(suggest).not.toBe("chapterMap.editSuggest");
  });

  it("new keys exist on every locale file (parity for filled surface holes)", () => {
    const required = [
      "chapterMap.editPromptPlaceholder",
      "chapterMap.editSuggest",
      "chapterMap.complete",
      "common.signIn",
      "dashboard.noApiKeysYet",
      "probes.pressToToggle",
      "sessionEnd.returnToWorkspace",
      "session.nameSessionTitle",
      "session.nameSessionConfirm",
    ];
    const localeFiles = fs
      .readdirSync(path.join(ROOT, "messages"))
      .filter((f) => f.endsWith(".json") && !f.includes("backup"));
    expect(localeFiles).toContain("en.json");
    for (const file of localeFiles) {
      const data = JSON.parse(
        fs.readFileSync(path.join(ROOT, "messages", file), "utf8"),
      ) as Record<string, unknown>;
      for (const key of required) {
        const val = getMessageLeaf(data, key);
        expect(typeof val, `${file} ${key}`).toBe("string");
        expect(String(val).trim().length, `${file} ${key} empty`).toBeGreaterThan(0);
      }
    }
  });
});
