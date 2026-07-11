import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export function loadEnvFile(filename = ".env.local") {
  const envPath = path.join(root, filename);
  if (!fs.existsSync(envPath)) return {};
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

export function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

export function parseDbPassword(url) {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@/);
  if (!m) throw new Error(`Could not parse database URL`);
  return decodeURIComponent(m[2]);
}

/** Convert dashboard db.*.supabase.co URLs to session pooler (db host often IPv6-only). */
export function normalizeSupabaseDbUrl(dbUrl, projectRef) {
  if (!dbUrl || !projectRef) return dbUrl;
  try {
    const parsed = new URL(dbUrl.replace("postgresql://", "http://"));
    if (parsed.hostname === `db.${projectRef}.supabase.co`) {
      const port = parsed.port || "5432";
      const password = parseDbPassword(dbUrl);
      const encodedPassword = password
        .replace(/%/g, "%25")
        .replace(/!/g, "%21")
        .replace(/@/g, "%40")
        .replace(/#/g, "%23");
      const poolerHost = "aws-1-eu-west-2.pooler.supabase.com";
      return `postgresql://postgres.${projectRef}:${encodedPassword}@${poolerHost}:${port}/postgres`;
    }
  } catch {}
  return dbUrl;
}

function buildConnectionCandidates(ref, password) {
  const encoded = encodeURIComponent(password);
  const regions = [
    "eu-west-2",
    "eu-west-1",
    "eu-central-1",
    "us-east-1",
    "us-west-1",
    "us-west-2",
    "ap-southeast-1",
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
  return out;
}

export async function connectSupabasePostgres({ projectRef, password, dbUrl }) {
  const candidates = [];
  if (dbUrl) {
    candidates.push({ name: "explicit-db-url", url: dbUrl });
  }
  candidates.push(...buildConnectionCandidates(projectRef, password));

  let lastError = null;
  for (const candidate of candidates) {
    const client = new Client({
      connectionString: candidate.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { client, via: candidate.name };
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {}
      if (candidate.name === "explicit-db-url") {
        break;
      }
    }
  }

  const detail = lastError?.message || "unknown error";
  throw new Error(
    `Could not connect to Supabase Postgres for project ${projectRef}: ${detail}`
  );
}

export async function connectTarget(target = "prod") {
  const env = loadEnvFile(".env.local");
  const isStaging = target === "staging";

  const supabaseUrl = isStaging
    ? env.STAGING_NEXT_PUBLIC_SUPABASE_URL
    : env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;

  let dbUrl = isStaging
    ? env.STAGING_SUPABASE_DB_URL
    : env.PROD_SUPABASE_DB_URL || env.SUPABASE_DB_URL;

  if (!supabaseUrl) {
    throw new Error(
      isStaging
        ? "Missing STAGING_NEXT_PUBLIC_SUPABASE_URL in .env.local"
        : "Missing NEXT_PUBLIC_SUPABASE_URL or PROD_NEXT_PUBLIC_SUPABASE_URL in .env.local"
    );
  }

  if (!dbUrl && isStaging && env.SUPABASE_DB_URL) {
    const password = parseDbPassword(env.SUPABASE_DB_URL);
    const ref = projectRefFromUrl(supabaseUrl);
    dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }

  if (!dbUrl) {
    throw new Error(
      isStaging
        ? "Missing STAGING_SUPABASE_DB_URL in .env.local"
        : "Missing SUPABASE_DB_URL in .env.local"
    );
  }

  const ref = projectRefFromUrl(supabaseUrl);
  dbUrl = normalizeSupabaseDbUrl(dbUrl, ref);
  const password = parseDbPassword(dbUrl);
  return connectSupabasePostgres({ projectRef: ref, password, dbUrl });
}