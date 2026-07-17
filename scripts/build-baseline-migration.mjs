import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { loadEnvFile, projectRefFromUrl, parseDbPassword } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const BASELINE_VERSION = "20260711120000_baseline";
const pgDump =
  process.env.PG_DUMP_PATH || "/opt/homebrew/opt/libpq/bin/pg_dump";

function buildProdPoolerUrl(env) {
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const password = parseDbPassword(env.SUPABASE_DB_URL);
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-eu-west-2.pooler.supabase.com:5432/postgres`;
}

function sanitizeDump(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
    .join("\n")
    .replace(/^CREATE SCHEMA public;\n\n/m, "")
    .replace(
      /^COMMENT ON SCHEMA public IS 'standard public schema';\n\n/m,
      ""
    );
}

function main() {
  const env = loadEnvFile(".env.local");
  const url = buildProdPoolerUrl(env);
  const rawPath = path.join(root, ".tmp-public-schema.sql");
  const outPath = path.join(root, "supabase/migrations", `${BASELINE_VERSION}.sql`);

  execSync(
    `${pgDump} "${url}" --schema-only --no-owner --no-privileges --schema=public -f "${rawPath}"`,
    { stdio: "inherit" }
  );

  const body = sanitizeDump(fs.readFileSync(rawPath, "utf8"));
  const header = `-- Uncertain Systems schema baseline (squashed from production public schema)
-- Generated: ${new Date().toISOString()}
-- Do not edit by hand. Create a new forward migration instead.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

  const footer = `
-- Migration tracking (empty on fresh databases)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  inserted_at timestamptz NOT NULL DEFAULT now()
);
`;

  fs.writeFileSync(outPath, `${header}${body}${footer}`);
  fs.unlinkSync(rawPath);
  console.log(`Wrote ${outPath}`);
}

main();