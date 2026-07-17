/**
 * Sync XAI_MANAGEMENT_API_KEY, XAI_TEAM_ID, XAI_ORG_KEY_ENCRYPTION_SECRET
 * from .env.local into the linked Vercel project (production, preview, development).
 *
 * Prerequisites:
 *   vercel login
 *   vercel link   # once in this repo
 *
 * Usage:
 *   node scripts/sync-xai-env-to-vercel.mjs
 *   VERCEL_TOKEN=... node scripts/sync-xai-env-to-vercel.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnvFile } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const KEYS = [
  "XAI_MANAGEMENT_API_KEY",
  "XAI_TEAM_ID",
  "XAI_ORG_KEY_ENCRYPTION_SECRET",
];

const ENVS = ["production", "preview", "development"];

function vercel(args, input) {
  const token = process.env.VERCEL_TOKEN;
  const full = token ? [...args, "--token", token] : args;
  const res = spawnSync("vercel", full, {
    cwd: root,
    input: input ?? undefined,
    encoding: "utf8",
    env: process.env,
  });
  return res;
}

function main() {
  const env = loadEnvFile(".env.local");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const missing = KEYS.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("Missing in .env.local:", missing.join(", "));
    process.exit(1);
  }

  // Ensure vercel is authenticated
  const who = vercel(["whoami"]);
  if (who.status !== 0) {
    console.error(who.stderr || who.stdout);
    console.error(
      "\nNot logged into Vercel. Run: vercel login\nOr set VERCEL_TOKEN and re-run."
    );
    process.exit(1);
  }
  console.log("Vercel user:", (who.stdout || "").trim());

  // Link project if needed
  if (!fs.existsSync(path.join(root, ".vercel", "project.json"))) {
    console.log("Linking project (vercel link --yes)...");
    const link = vercel(["link", "--yes"]);
    if (link.status !== 0) {
      console.error(link.stderr || link.stdout);
      process.exit(1);
    }
  }

  for (const key of KEYS) {
    const value = process.env[key];
    for (const target of ENVS) {
      // Remove existing so re-run is idempotent (ignore failure if missing)
      vercel(["env", "rm", key, target, "--yes"]);
      const add = vercel(["env", "add", key, target], value + "\n");
      if (add.status !== 0) {
        console.error(`Failed ${key} → ${target}:`, add.stderr || add.stdout);
        process.exit(1);
      }
      console.log(`Set ${key} → ${target}`);
    }
  }

  console.log("Done. Redeploy production for values to take effect: vercel --prod");
}

main();
