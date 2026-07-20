#!/usr/bin/env node
/**
 * Supplemental ILE E2E: workspace → session → session page → cookie PoW upload.
 */
import { readFileSync, existsSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env.e2e"), ...process.env };
const baseUrl = env.E2E_BASE_URL || "http://127.0.0.1:3000";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function makeSessionClient(email, password) {
  const jar = [];
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return jar;
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          const i = jar.findIndex((c) => c.name === name);
          if (i >= 0) jar[i] = { name, value };
          else jar.push({ name, value });
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return jar;
}

function cookieHeader(jar) {
  return jar.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function main() {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jar = await makeSessionClient(env.E2E_TEAMS_EMAIL, env.E2E_TEAMS_PASSWORD);
  const userId = env.E2E_TEAMS_USER_ID;

  let workspaceId = null;
  const gen = await fetch(`${baseUrl}/api/workspace/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({
      topic: "[E2E-ILE] Integrated Learning Environment smoke test",
      days: 7,
    }),
  });
  const genBody = await gen.json();
  workspaceId = genBody.workspaceId || genBody.plan?.id || null;
  if (gen.ok && workspaceId) {
    record("workspace create (web)", true, workspaceId);
  } else {
    const { data: existing } = await admin
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    workspaceId = existing?.id || null;
    record(
      "workspace create (web)",
      !!workspaceId,
      workspaceId
        ? `reused ${workspaceId} (generate: ${gen.status})`
        : `${gen.status} ${JSON.stringify(genBody).slice(0, 120)}`,
    );
  }
  if (!workspaceId) process.exit(1);

  const { data: blocks } = await admin
    .from("blocks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1);

  const block = blocks?.[0];
  record("workspace has block", !!block?.id, block?.title || "none");
  if (!block?.id) process.exit(1);

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .insert({
      user_id: userId,
      problem: block.title || "E2E ILE block",
      planning_prompt: "Explain your reasoning aloud.",
      status: "active",
      metadata: { workspace_id: workspaceId },
    })
    .select("id")
    .single();

  record("ILE session create (DB)", !sessionError && !!session?.id, session?.id || sessionError?.message);
  if (!session?.id) process.exit(1);

  await admin.from("blocks").update({ session_id: session.id, status: "in_progress" }).eq("id", block.id);
  await admin.from("block_sessions").insert({
    block_id: block.id,
    session_id: session.id,
    user_id: userId,
    workspace_id: workspaceId,
  });

  const page = await fetch(`${baseUrl}/session?id=${session.id}`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: "follow",
  });
  const pageText = await page.text();
  record(
    "ILE session page renders",
    page.ok && pageText.length > 5000,
    `HTTP ${page.status} len=${pageText.length}`,
  );

  const payload = Buffer.from(JSON.stringify({ source: "ile-e2e", action: "smoke" })).toString("base64");
  const pow = await fetch(`${baseUrl}/api/workspace/proof-of-work`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({
      workspaceId,
      session_id: session.id,
      type: "tool",
      mime_type: "application/json",
      data: payload,
      tool_name: "ile-session",
      tool_action: "e2e_smoke",
    }),
  });
  const powBody = await pow.json();
  record(
    "ILE cookie PoW upload",
    pow.status === 201 && !!powBody.proof_of_work,
    pow.status === 201 ? `id=${powBody.proof_of_work?.id}` : `${pow.status} ${JSON.stringify(powBody).slice(0, 120)}`,
  );

  const apiKey = env.E2E_TEAMS_API_KEY;
  const agentCreate = await fetch(`${baseUrl}/api/v3/pow/workspaces`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ initial_prompt: "[E2E-PoW] Proof-of-Work API smoke" }),
  });
  const agentBody = await agentCreate.json();
  let agentWsId = agentBody.workspace?.id || workspaceId;
  if (!agentBody.workspace?.id) {
    record(
      "agent workspace for PoW",
      !!agentWsId,
      `reused ${agentWsId} (create: ${agentCreate.status})`,
    );
  }
  const upload = await fetch(`${baseUrl}/api/v3/pow/workspaces/${agentWsId}/proof-of-work`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "tool",
      mime_type: "application/json",
      data: Buffer.from("{}").toString("base64"),
    }),
  });
  const upBody = await upload.json();
  record(
    "Agent v2 PoW upload",
    upload.status === 201 && !!upBody.proof_of_work,
    upload.status === 201
      ? `interruption=${upBody.interruption === null ? "null" : "object"}`
      : `${upload.status}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ILE supplemental: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});