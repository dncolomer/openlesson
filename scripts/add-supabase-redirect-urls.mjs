#!/usr/bin/env node
import { execSync } from "child_process";

const NEW_URLS = [
  "https://uncertain.systems",
  "https://uncertain.systems/*",
  "https://uncertain.systems/**",
  "https://www.uncertain.systems",
  "https://www.uncertain.systems/*",
  "https://www.uncertain.systems/**",
  "https://uncertain.systems/auth/callback",
  "https://uncertain.systems/auth/callback/**",
  "https://uncertain.systems/reset-password",
];

const PROJECTS = [
  { ref: "xzwjlkngxuxttvqbboea", label: "production" },
  { ref: "zdlohvfhkepzvbtxguos", label: "staging" },
];

function getAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return execSync('security find-generic-password -s "Supabase CLI" -a "supabase" -w', {
    encoding: "utf8",
  }).trim();
}

async function updateProject(token, ref, label) {
  const headers = { Authorization: `Bearer ${token}` };
  const getRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers });
  if (!getRes.ok) {
    throw new Error(`GET ${label} failed: ${getRes.status} ${await getRes.text()}`);
  }

  const config = await getRes.json();
  const existing = (config.uri_allow_list || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const merged = [...existing];
  const added = [];
  for (const url of NEW_URLS) {
    if (!merged.includes(url)) {
      merged.push(url);
      added.push(url);
    }
  }

  if (added.length === 0) {
    console.log(`[${label}] No new URLs to add (${existing.length} existing).`);
    return;
  }

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ uri_allow_list: merged.join(",") }),
  });

  if (!patchRes.ok) {
    throw new Error(`PATCH ${label} failed: ${patchRes.status} ${await patchRes.text()}`);
  }

  console.log(`[${label}] Added ${added.length} URL(s). Total: ${merged.length} (was ${existing.length}).`);
  for (const url of added) console.log(`  + ${url}`);
}

const token = getAccessToken();
for (const project of PROJECTS) {
  await updateProject(token, project.ref, project.label);
}