#!/usr/bin/env node
/**
 * Dedicated Proof-of-Work API product E2E.
 *
 * Teams (pro_teams): direct REST + MCP access — list/read workspaces, proof of work, scores, TAP links.
 * Workspace create is UI-only (POST /api/v3/pow/workspaces → 403) for all keys.
 * Individual (regular_2026): Proof-of-Work API gated (api_plan_required); proof of work via ILE/TAP web routes + Performance tab.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
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
const liveWrites = env.E2E_ALLOW_LIVE_WRITES === "1";
const results = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${area} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function cookieHeader(jar) {
  return jar.map((c) => `${c.name}=${c.value}`).join("; ");
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
  if (error) throw new Error(`${email}: ${error.message}`);
  return jar;
}

async function agentJson(path, apiKey, init = {}) {
  const long =
    /proof-of-work-schema|lwm-snapshot|performance|integration-skill/i.test(
      path,
    );
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(long ? 300_000 : 60_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function mcpCall(apiKey, method, params = {}, id = 1) {
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const body = await res.json();
  return { res, body };
}

function mcpToolText(body) {
  const text = body?.result?.content?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function mintRegularApiKey(admin, userId) {
  const rawKey = `sk_e2e_regular_${crypto.randomBytes(20).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const { data, error } = await admin
    .from("agent_api_keys")
    .insert({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 12),
      label: "[E2E-PoW] regular tier gate test",
      scopes: ["*"],
      rate_limit: 120,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to mint regular API key");
  return { rawKey, id: data.id };
}

function isVerticalScoreReport(body) {
  const report = body?.report;
  return (
    (body?.mode === "score" || body?.mode === "report" || !body?.mode) &&
    report &&
    typeof report.score === "number" &&
    Array.isArray(report.marker_scores) &&
    report.marker_scores.length >= 1 &&
    report.gap_analysis &&
    Array.isArray(report.gap_analysis.gaps)
  );
}

function planGateCode(body) {
  return body?.error?.code || body?.code || "";
}

async function runTierGates(admin, regularJar) {
  console.log("\n== Tier gates ==");

  const keysDenied = await fetch(`${baseUrl}/api/v3/pow/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
    body: JSON.stringify({ label: "should-fail" }),
  });
  const keysBody = await keysDenied.json();
  const deniedCode = planGateCode(keysBody);
  record(
    "individual-gate",
    "regular session cannot mint API keys",
    keysDenied.status === 403 &&
      (deniedCode === "teams_required" ||
        deniedCode === "api_plan_required" ||
        /teams|metered|pro/i.test(String(keysBody?.error || keysBody?.message || ""))),
    `HTTP ${keysDenied.status} code=${deniedCode || "n/a"}`,
  );

  let regularKeyId = null;
  try {
    const { rawKey, id } = await mintRegularApiKey(admin, env.E2E_REGULAR_USER_ID);
    regularKeyId = id;
    const blocked = await agentJson("/api/v3/pow/workspaces", rawKey, {
      method: "POST",
      body: JSON.stringify({ initial_prompt: "should be blocked" }),
    });
    const blockedCode = planGateCode(blocked.body);
    record(
      "individual-gate",
      "regular-owned API key rejected (plan gate)",
      blocked.res.status === 403 &&
        (blockedCode === "teams_required" ||
          blockedCode === "api_plan_required" ||
          /teams|metered|pro/i.test(JSON.stringify(blocked.body || {}))),
      `HTTP ${blocked.res.status} code=${blockedCode || "n/a"}`,
    );
  } catch (err) {
    record("individual-gate", "regular-owned API key rejected (plan gate)", false, err.message);
  } finally {
    if (regularKeyId) {
      await admin.from("agent_api_keys").update({ is_active: false }).eq("id", regularKeyId);
    }
  }

  const teamsKey = env.E2E_TEAMS_API_KEY;
  if (!teamsKey) {
    record("teams-gate", "E2E_TEAMS_API_KEY configured", false, "missing");
    return null;
  }

  // Workspace create is product UI-only for all keys (including Teams).
  const createBlocked = await agentJson("/api/v3/pow/workspaces", teamsKey, {
    method: "POST",
    body: JSON.stringify({ initial_prompt: "[E2E-PoW] Teams create probe — must be rejected." }),
  });
  const createCode = planGateCode(createBlocked.body);
  const createMsg = JSON.stringify(createBlocked.body || {});
  record(
    "teams-gate",
    "teams API key cannot create workspace (UI-only)",
    createBlocked.res.status === 403 &&
      (createCode === "forbidden" || /not available via API|UI-only|\/workspace\/new/i.test(createMsg)),
    `HTTP ${createBlocked.res.status} code=${createCode || "n/a"}`,
  );

  // Resolve a workspace for the Teams REST/MCP suite via list (or optional env override).
  const listed = await agentJson("/api/v3/pow/workspaces?limit=10", teamsKey);
  let workspaceId =
    (Array.isArray(listed.body?.workspaces) && listed.body.workspaces[0]?.id) ||
    env.E2E_TEAMS_WORKSPACE_ID ||
    null;
  record(
    "teams-gate",
    "teams API key can list workspaces",
    listed.res.status === 200 && Array.isArray(listed.body?.workspaces),
    workspaceId
      ? `workspace=${workspaceId} total=${listed.body?.pagination?.total ?? listed.body?.workspaces?.length ?? "?"}`
      : `HTTP ${listed.res.status} empty_list=${listed.res.status === 200}`,
  );
  return workspaceId;
}

async function runTeamsPowApi(apiKey, workspaceId) {
  console.log("\n== Teams — Proof-of-Work API (REST) ==");

  const ws = await agentJson(`/api/v3/pow/workspaces/${workspaceId}`, apiKey);
  record(
    "teams-rest",
    "GET /workspaces/{id}",
    ws.res.status === 200 && !!ws.body?.workspace?.id,
    ws.body?.workspace?.title || `HTTP ${ws.res.status}`,
  );

  const blocks = await agentJson(`/api/v3/pow/workspaces/${workspaceId}/blocks`, apiKey);
  const blockId = blocks.body?.blocks?.[0]?.id;
  record(
    "teams-rest",
    "GET /workspaces/{id}/blocks",
    blocks.res.status === 200 && (blocks.body?.blocks?.length ?? 0) > 0,
    `${blocks.body?.blocks?.length ?? 0} blocks`,
  );

  const schema = await agentJson(`/api/v3/pow/workspaces/${workspaceId}/proof-of-work-schema`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      definition: "[E2E-PoW] Capture tool usage while explaining hash map collisions.",
      block_id: blockId,
    }),
  });
  record(
    "teams-rest",
    "POST /proof-of-work-schema",
    schema.res.status === 200 && !!schema.body?.schema,
    schema.res.status === 200 ? schema.body?.schema_name || "schema ok" : `HTTP ${schema.res.status}`,
  );
  record(
    "teams-rest",
    "proof-of-work-schema returns interruption field",
    schema.res.status === 200 && "interruption" in (schema.body || {}),
    schema.body?.interruption === null ? "null" : "object",
  );

  const upload = await agentJson(`/api/v3/pow/workspaces/${workspaceId}/proof-of-work`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      type: "tool",
      mime_type: "application/json",
      data: Buffer.from(
        JSON.stringify({
          tool_name: "e2e-pow-api",
          events: [{ action: "explain_collision", detail: "chaining vs probing" }],
        }),
      ).toString("base64"),
      block_id: blockId,
    }),
  });
  record(
    "teams-rest",
    "POST /proof-of-work",
    upload.res.status === 201 && !!upload.body?.proof_of_work?.id,
    upload.res.status === 201 ? upload.body.proof_of_work.id : `HTTP ${upload.res.status}`,
  );

  if (!liveWrites) {
    record("teams-rest", "POST /lwm-snapshot", false, "E2E_ALLOW_LIVE_WRITES not set");
    return blockId;
  }

  const report = await agentJson(
    `/api/v3/eval/workspaces/${workspaceId}/lwm-snapshot`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({ block_id: blockId }),
    },
  );
  record(
    "teams-rest",
    "POST /api/v3/eval/.../lwm-snapshot (score + marker_scores)",
    report.res.status === 200 && isVerticalScoreReport(report.body),
    report.res.status === 200
      ? `score=${report.body?.report?.score} markers=${report.body?.report?.marker_scores?.length}`
      : `${report.res.status} ${JSON.stringify(report.body)?.slice(0, 160)}`,
  );
  record(
    "teams-rest",
    "lwm-snapshot response includes proof_of_work_summary",
    report.res.status === 200 && !!report.body?.proof_of_work_summary,
    report.body?.proof_of_work_summary
      ? `artifacts=${report.body.proof_of_work_summary.proof_of_work_artifacts}`
      : "missing",
  );

  if (blockId) {
    const link = await agentJson(
      `/api/v3/pow/workspaces/${workspaceId}/blocks/${blockId}/tap-links`,
      apiKey,
      { method: "POST", body: JSON.stringify({ minutes: 15 }) },
    );
    const linkId = link.body?.tap_link?.id;
    record(
      "teams-rest",
      "POST /blocks/{id}/tap-links",
      link.res.status === 201 && !!linkId,
      linkId || `HTTP ${link.res.status}`,
    );

    const list = await agentJson(`/api/v3/pow/workspaces/${workspaceId}/tap-links`, apiKey);
    record(
      "teams-rest",
      "GET /tap-links",
      list.res.status === 200 && Array.isArray(list.body?.tap_links),
      `${list.body?.tap_links?.length ?? 0} links`,
    );
  }

  return blockId;
}

async function runTeamsMcp(apiKey, workspaceId) {
  console.log("\n== Teams — MCP parity ==");

  const tools = await mcpCall(apiKey, "tools/list", {}, 20);
  const names = (tools.body?.result?.tools || []).map((t) => t.name);
  record(
    "teams-mcp",
    "tools/list (catalog non-empty)",
    tools.res.status === 200 && names.length >= 11,
    `${names.length} tools`,
  );
  record(
    "teams-mcp",
    "catalog excludes get_tap_results",
    !names.includes("get_tap_results"),
    names.filter((n) => n.includes("tap")).join(", ") || "tap tools ok",
  );

  const progress = await mcpCall(
    apiKey,
    "tools/call",
    { name: "get_learning_progress", arguments: { workspace_id: workspaceId } },
    21,
  );
  const progressData = mcpToolText(progress.body);
  record(
    "teams-mcp",
    "get_learning_progress",
    progress.res.status === 200 && progressData?.workspace?.id === workspaceId,
    progressData?.workspace?.conversion_goal
      ? `goal=${progressData.workspace.conversion_goal}`
      : progressData?.proof_of_work_summary
        ? `artifacts=${progressData.proof_of_work_summary.proof_of_work_artifacts}`
        : "ok",
  );

  const workspaceTool = await mcpCall(
    apiKey,
    "tools/call",
    { name: "get_workspace", arguments: { workspace_id: workspaceId } },
    22,
  );
  const wsData = mcpToolText(workspaceTool.body);
  record(
    "teams-mcp",
    "get_workspace",
    workspaceTool.res.status === 200 && wsData?.workspace?.id === workspaceId,
    wsData?.workspace?.title || "ok",
  );

  if (!liveWrites) {
    record("teams-mcp", "lwm_snapshot tool", false, "E2E_ALLOW_LIVE_WRITES not set");
    return;
  }

  // New PoW so the re-run gate allows another LWM Snapshot after the REST score suite.
  const mcpUpload = await mcpCall(
    apiKey,
    "tools/call",
    {
      name: "upload_proof_of_work",
      arguments: {
        workspace_id: workspaceId,
        type: "tool",
        mime_type: "application/json",
        data: Buffer.from(
          JSON.stringify({
            tool_name: "e2e-mcp-pow",
            events: [{ action: "mcp_score_preflight", detail: "fresh pow for mcp lwm_snapshot" }],
          }),
        ).toString("base64"),
      },
    },
    23,
  );
  const mcpUploadData = mcpToolText(mcpUpload.body);
  const uploadOk =
    mcpUpload.res.status === 200 &&
    !!(mcpUploadData?.proof_of_work?.id || mcpUploadData?.proof_of_work);
  record(
    "teams-mcp",
    "upload_proof_of_work tool (pre-score)",
    uploadOk,
    mcpUploadData?.proof_of_work?.id ||
      mcpUpload.body?.error?.message ||
      `HTTP ${mcpUpload.res.status}`,
  );

  const perf = await mcpCall(
    apiKey,
    "tools/call",
    { name: "lwm_snapshot", arguments: { workspace_id: workspaceId } },
    24,
  );
  const perfData = mcpToolText(perf.body);
  const scoreReport = perfData?.report || perfData;
  const scoreOk =
    perf.res.status === 200 &&
    (isVerticalScoreReport(perfData) || typeof scoreReport?.score === "number");
  record(
    "teams-mcp",
    "lwm_snapshot tool",
    scoreOk,
    scoreReport?.score != null
      ? `score=${scoreReport.score}`
      : perfData?.error?.message ||
          perf.body?.error?.message ||
          (perfData ? `keys=${Object.keys(perfData).slice(0, 8).join(",")}` : "no score"),
  );
}

async function runIndividualIndirect(admin, regularJar) {
  console.log("\n== Individual — indirect ILE / TAP / Performance tab ==");

  const gen = await fetch(`${baseUrl}/api/workspace/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
    body: JSON.stringify({
      topic: "[E2E-PoW-IND] Individual tier workspace for ILE/TAP indirect proof of work",
      days: 7,
    }),
  });
  const genBody = await gen.json();
  let workspaceId = genBody.workspaceId || genBody.plan?.id || null;
  if (!workspaceId) {
    const { data: existing } = await admin
      .from("workspaces")
      .select("id")
      .eq("user_id", env.E2E_REGULAR_USER_ID)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    workspaceId = existing?.id || null;
  }
  record(
    "individual-indirect",
    "create workspace via web (not Proof-of-Work API)",
    !!workspaceId,
    workspaceId || `${gen.status}`,
  );
  if (!workspaceId) return;

  const { data: blocks } = await admin
    .from("blocks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1);
  const blockId = blocks?.[0]?.id;
  record("individual-indirect", "workspace has block", !!blockId, blocks?.[0]?.title || "none");
  if (!blockId) return;

  const { data: session } = await admin
    .from("sessions")
    .insert({
      user_id: env.E2E_REGULAR_USER_ID,
      problem: blocks[0].title,
      planning_prompt: "Explain your reasoning.",
      status: "active",
      metadata: { workspace_id: workspaceId },
    })
    .select("id")
    .single();

  const ilePow = await fetch(`${baseUrl}/api/workspace/proof-of-work`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
    body: JSON.stringify({
      workspaceId,
      session_id: session?.id,
      type: "tool",
      mime_type: "application/json",
      data: Buffer.from(JSON.stringify({ source: "ile-indirect-e2e", action: "thought_trace" })).toString(
        "base64",
      ),
      tool_name: "ile-session",
      tool_action: "e2e_smoke",
    }),
  });
  const ileBody = await ilePow.json();
  record(
    "individual-indirect",
    "ILE proof-of-work upload (cookie auth)",
    ilePow.status === 201 && !!ileBody.proof_of_work?.id,
    ilePow.status === 201 ? ileBody.proof_of_work.id : `${ilePow.status} ${JSON.stringify(ileBody).slice(0, 100)}`,
  );

  const tapStart = await fetch(`${baseUrl}/api/workspace-tap-score/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
    body: JSON.stringify({ workspaceId, blockId, minutes: 15 }),
  });
  const tapStartBody = await tapStart.json();
  const tapSessionId = tapStartBody.tapSessionId;
  record(
    "individual-indirect",
    "TAP session start (workspace UI route)",
    tapStart.status === 200 && !!tapSessionId,
    tapSessionId || `${tapStart.status}`,
  );

  if (tapSessionId) {
    const tapComplete = await fetch(`${baseUrl}/api/workspace-tap-score/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
      body: JSON.stringify({
        workspaceId,
        tapSessionId,
        durationSeconds: 90,
        requestedDurationSeconds: 900,
        transcript: [
          {
            role: "learner",
            text: "Individual tier learners complete TAP in the workspace UI; evidence uploads to proof of work.",
          },
        ],
      }),
    });
    const tapCompleteBody = await tapComplete.json();
    record(
      "individual-indirect",
      "TAP complete uploads tap-transcript PoW",
      tapComplete.status === 200 && tapCompleteBody?.tapSession?.status === "completed",
      tapComplete.status === 200 ? "completed" : `${tapComplete.status} ${JSON.stringify(tapCompleteBody).slice(0, 120)}`,
    );
  }

  // Unauthenticated list requires Bearer; create is UI-only (403) even without auth.
  const noBearerList = await fetch(`${baseUrl}/api/v3/pow/workspaces`, { method: "GET" });
  record(
    "individual-indirect",
    "Proof-of-Work API requires Bearer key (individual uses web routes)",
    noBearerList.status === 401,
    `HTTP ${noBearerList.status}`,
  );

  if (!liveWrites) {
    record("individual-indirect", "workspace Performance tab report", false, "E2E_ALLOW_LIVE_WRITES not set");
    return;
  }

  const webReport = await fetch(`${baseUrl}/api/workspace/performance-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(regularJar) },
    body: JSON.stringify({ workspaceId, vertical: "verification" }),
  });
  const webReportBody = await webReport.json();
  const webOk =
    webReport.status === 200 &&
    typeof webReportBody?.report?.score === "number" &&
    Array.isArray(webReportBody?.report?.marker_scores);
  record(
    "individual-indirect",
    "Performance tab verification report (cookie auth)",
    webOk,
    webOk
      ? `score=${webReportBody.report.score} markers=${webReportBody.report.marker_scores.length}`
      : `${webReport.status} ${JSON.stringify(webReportBody).slice(0, 160)}`,
  );
}

async function main() {
  console.log(`PoW API product E2E | ${baseUrl} | live writes: ${liveWrites ? "ON" : "OFF"}\n`);

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let regularJar;
  try {
    regularJar = await makeSessionClient(env.E2E_REGULAR_EMAIL, env.E2E_REGULAR_PASSWORD);
    record("auth", "regular cookie session", true, `${regularJar.length} cookies`);
  } catch (err) {
    record("auth", "regular cookie session", false, err.message);
    process.exit(1);
  }

  const workspaceId = await runTierGates(admin, regularJar);
  const teamsKey = env.E2E_TEAMS_API_KEY;

  if (workspaceId && teamsKey) {
    await runTeamsPowApi(teamsKey, workspaceId);
    await runTeamsMcp(teamsKey, workspaceId);
  }

  await runIndividualIndirect(admin, regularJar);

  const failed = results.filter((r) => !r.ok);
  const report = {
    ran_at: new Date().toISOString(),
    base_url: baseUrl,
    live_writes: liveWrites,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    all: results,
  };
  writeFileSync("scripts/pow-api-e2e-report.json", JSON.stringify(report, null, 2) + "\n");

  console.log(`\n=== PoW API E2E: ${report.passed}/${report.total} passed, ${report.failed} failed ===`);
  console.log("Report: scripts/pow-api-e2e-report.json");
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});