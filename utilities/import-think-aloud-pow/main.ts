/**
 * Operator CLI: think-aloud video/audio → ILE Explore Solo PoW.
 * Not a product surface. Persist is default; --dry-run dumps the event list.
 *
 *   npm run import:think-aloud-pow -- --media recording.mp4 --workspace <id>
 */
import { loadEnvFile } from "../../scripts/db-connection.mjs";
import { runImportThinkAloudCli } from "./cli";

function applyLocalEnv() {
  const env = loadEnvFile() as Record<string, string>;
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null && typeof value === "string") {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  applyLocalEnv();
  const code = await runImportThinkAloudCli(process.argv.slice(2));
  process.exit(code);
}

void main();
