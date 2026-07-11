import { execSync } from "child_process";
import { loadEnvFile } from "./db-connection.mjs";

const env = loadEnvFile(".env.local");
const stagingUrl =
  env.STAGING_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = new URL(stagingUrl).hostname.split(".")[0];

const output = execSync(
  `npx supabase@latest projects api-keys --project-ref ${projectRef} -o json`,
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
);

const keys = JSON.parse(output);
const anon = keys.find((k) => k.name === "anon")?.api_key;
const serviceRole = keys.find((k) => k.name === "service_role")?.api_key;

if (!anon || !serviceRole) {
  throw new Error(`Could not find anon/service_role keys for ${projectRef}`);
}

console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRole}`);