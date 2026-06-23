#!/usr/bin/env node
/**
 * Ensures every messages/*.json locale has the same key paths as en.json.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const messagesDir = "messages";
const en = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8"));
const enKeys = new Set(flattenKeys(en));

let failed = false;

for (const file of readdirSync(messagesDir).filter((f) => f.endsWith(".json") && f !== "en.json" && !f.includes("backup") && !f.includes("_full"))) {
  const locale = JSON.parse(readFileSync(join(messagesDir, file), "utf8"));
  const localeKeys = new Set(flattenKeys(locale));
  const missing = [...enKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !enKeys.has(k));

  const missingRatio = missing.length / enKeys.size;
  if (missing.length) {
    console.error(`\n${file}: missing ${missing.length}/${enKeys.size} keys (${(missingRatio * 100).toFixed(1)}%)`);
    missing.slice(0, 10).forEach((k) => console.error(`    - ${k}`));
    if (missingRatio > 0.05) failed = true;
  }
  if (extra.length) {
    console.warn(`${file}: ${extra.length} extra keys (not in en.json)`);
  }
  if (!missing.length) {
    console.log(`OK ${file} (${localeKeys.size} keys)`);
  }
}

if (failed) {
  console.error("\nLocale parity check failed.");
  process.exit(1);
}

console.log(`\nAll locales match en.json (${enKeys.size} keys).`);