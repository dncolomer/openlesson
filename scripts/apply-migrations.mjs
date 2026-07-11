import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function listMigrations() {
  const dir = path.join(root, "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      inserted_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedVersions(client) {
  await ensureTrackingTable(client);
  const result = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
  );
  return new Set(result.rows.map((row) => row.version));
}

async function schemaAlreadyInitialized(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspaces'
    ) AS ready
  `);
  return result.rows[0]?.ready === true;
}

async function recordMigration(client, version) {
  await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (version)
     VALUES ($1)
     ON CONFLICT (version) DO NOTHING`,
    [version]
  );
}

async function main() {
  const target = process.argv.includes("--staging") ? "staging" : "prod";
  const reset = process.argv.includes("--reset-tracking");
  const { client, via } = await connectTarget(target);
  console.log(`Target: ${target} (${via})`);

  try {
    const migrations = listMigrations();
    let applied = await getAppliedVersions(client);

    if (reset) {
      await client.query("TRUNCATE supabase_migrations.schema_migrations");
      applied = new Set();
      console.log("Reset migration tracking table.");
    }

    const initialized = await schemaAlreadyInitialized(client);

    for (const version of migrations) {
      if (applied.has(version)) {
        console.log(`Skip ${version} (already applied)`);
        continue;
      }

      const isBaseline = version.endsWith("_baseline");
      if (isBaseline && initialized) {
        await recordMigration(client, version);
        console.log(`Recorded ${version} (schema already present)`);
        continue;
      }

      const sql = fs.readFileSync(
        path.join(root, "supabase/migrations", `${version}.sql`),
        "utf8"
      );
      console.log(`Applying ${version}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await recordMigration(client, version);
        await client.query("COMMIT");
        console.log(`Applied ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const final = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
    );
    console.log("Recorded migrations:");
    for (const row of final.rows) console.log(`  - ${row.version}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});