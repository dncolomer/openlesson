import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      })
  );
}

function parseDbPassword(url) {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@/);
  if (!m) throw new Error("Could not parse SUPABASE_DB_URL");
  return decodeURIComponent(m[2]);
}

function buildConnectionCandidates(ref, password) {
  const encoded = encodeURIComponent(password);
  const regions = [
    "us-east-1",
    "us-west-1",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "eu-central-2",
    "eu-north-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-south-1",
    "ca-central-1",
    "sa-east-1",
  ];
  const out = [];
  for (const region of regions) {
    for (const prefix of ["aws-0", "aws-1"]) {
      for (const port of [5432, 6543]) {
        out.push({
          name: `${prefix}-${region}-${port}`,
          url: `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:${port}/postgres`,
        });
      }
    }
  }
  out.push({
    name: "legacy-direct",
    url: `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
  });
  out.push({
    name: "legacy-user",
    url: `postgresql://postgres:${encoded}@${ref}.supabase.co:5432/postgres`,
  });
  return out;
}

async function connect(ref, password) {
  const candidates = buildConnectionCandidates(ref, password);
  for (const candidate of candidates) {
    const client = new Client({
      connectionString: candidate.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      console.log(`Connected via ${candidate.name}`);
      return client;
    } catch (error) {
      const msg = error.message || "";
      if (
        !msg.includes("ENOTFOUND") &&
        !msg.includes("tenant/user") &&
        !msg.includes("ECONNREFUSED")
      ) {
        console.log(`Candidate ${candidate.name}: ${error.code || ""} ${msg.slice(0, 120)}`);
      }
      try {
        await client.end();
      } catch {}
    }
  }
  throw new Error("Could not connect to Supabase Postgres with any known URL format");
}

const PENDING = [
  "048_rename_workspace_evidence_to_proof_of_work",
  "048_workspace_archive",
  "053_workspace_pricing",
  "054_rename_workspace_and_blocks",
];

async function main() {
  const env = loadEnv();
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const password = parseDbPassword(env.SUPABASE_DB_URL);
  const client = await connect(ref, password);

  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text PRIMARY KEY,
        inserted_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const version of PENDING) {
      const file = path.join(root, "supabase/migrations", `${version}.sql`);
      const sql = fs.readFileSync(file, "utf8");
      console.log(`Applying ${version}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version)
           VALUES ($1)
           ON CONFLICT (version) DO NOTHING`,
          [version]
        );
        await client.query("COMMIT");
        console.log(`Applied ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("All pending migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});