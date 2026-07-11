import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectTarget } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function listLocalMigrations() {
  const dir = path.join(root, "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
}

async function main() {
  const target = process.argv.includes("--staging") ? "staging" : "prod";
  const local = listLocalMigrations();
  const { client } = await connectTarget(target);

  try {
    const remote = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
    );
    const applied = remote.rows.map((row) => row.version);
    const appliedSet = new Set(applied);
    const pending = local.filter((version) => !appliedSet.has(version));
    const unknown = applied.filter((version) => !local.includes(version));

    console.log(`Target: ${target}`);
    console.log(`Local migrations: ${local.length}`);
    console.log(`Applied migrations: ${applied.length}`);

    if (pending.length) {
      console.log("\nPending:");
      for (const version of pending) console.log(`  - ${version}`);
    }

    if (unknown.length) {
      console.log("\nApplied but missing locally:");
      for (const version of unknown) console.log(`  - ${version}`);
    }

    if (pending.length || unknown.length) {
      process.exit(1);
    }

    console.log("\nMigration history matches local files.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});