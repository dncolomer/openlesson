#!/usr/bin/env node
/**
 * Expanded E2E: automates former "manual" checks + Agent API + MCP + TAP flow.
 * No DB deletes.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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

function record(area, name, ok, detail = "", extra = {}) {
  results.push({ area, name, ok, detail, ...extra });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${area} :: ${name}${detail ? ` — ${detail}` : ""}`);
}

function tapOrGhlResult(body) {
  return body?.tap_result || null;
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
  return { client, jar };
}

async function webFetch(path, jar, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (jar.length) headers.Cookie = cookieHeader(jar);
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function agentJson(path, apiKey, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
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

async function archiveE2eWorkspaces(admin, userIds) {
  for (const userId of userIds.filter(Boolean)) {
    const { error } = await admin
      .from("workspaces")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .neq("status", "archived");
    if (error) {
      console.warn(`[e2e] archive workspaces for ${userId}: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`Expanded E2E | ${baseUrl} | live writes ON\n`);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await archiveE2eWorkspaces(admin, [env.E2E_REGULAR_USER_ID, env.E2E_TEAMS_USER_ID]);

  let regularJar;
  let teamsJar;
  try {
    ({ jar: regularJar } = await makeSessionClient(env.E2E_REGULAR_EMAIL, env.E2E_REGULAR_PASSWORD));
    record("auth", "regular cookie session", true, `${regularJar.length} cookies`);
  } catch (e) {
    record("auth", "regular cookie session", false, e.message);
  }

  try {
    ({ jar: teamsJar } = await makeSessionClient(env.E2E_TEAMS_EMAIL, env.E2E_TEAMS_PASSWORD));
    record("auth", "teams cookie session", true, `${teamsJar.length} cookies`);
  } catch (e) {
    record("auth", "teams cookie session", false, e.message);
  }

  // --- Regular: check-usage ---
  if (regularJar) {
    const usage = await webFetch("/api/check-usage", regularJar);
    const ok =
      usage.res.status === 200 &&
      usage.body?.allowed === true &&
      usage.body?.plan === "regular_2026" &&
      usage.body?.limit === 100;
    record(
      "regular-web",
      "GET /api/check-usage (allowed, plan, limit)",
      ok,
      ok
        ? `plan=${usage.body.plan} limit=${usage.body.limit} used=${usage.body.used}`
        : `${usage.res.status} ${JSON.stringify(usage.body)}`
    );

    const org = await webFetch("/api/organization", regularJar);
    record(
      "regular-web",
      "GET /api/organization (no org)",
      org.res.status === 200 && !org.body?.organization,
      org.body?.organization ? `has org ${org.body.organization.id}` : "organization=null"
    );

    const keysDenied = await webFetch("/api/v2/agent/keys", regularJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "[E2E] should fail" }),
    });
    record(
      "regular-web",
      "POST /api/v2/agent/keys blocked (non-teams)",
      keysDenied.res.status === 403,
      `HTTP ${keysDenied.res.status} ${keysDenied.body?.error?.message || keysDenied.body?.message || ""}`
    );

    const dash = await webFetch("/dashboard", regularJar);
    record("regular-web", "GET /dashboard (authenticated)", dash.res.status === 200, `HTTP ${dash.res.status}`);

    let regularWorkspaceId = null;
    const gen = await webFetch("/api/workspace/generate", regularJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "[E2E-REG] Automated workspace — binary search intuition",
        days: 7,
      }),
    });
    regularWorkspaceId = gen.body?.workspaceId || gen.body?.plan?.id || gen.body?.id || null;
    const genOk = gen.res.status === 200 && !!regularWorkspaceId;
    record(
      "regular-web",
      "POST /api/workspace/generate (workspace create)",
      genOk,
      genOk ? regularWorkspaceId : `${gen.res.status} ${JSON.stringify(gen.body)?.slice(0, 300)}`
    );

    if (regularWorkspaceId) {
      const workspacePage = await webFetch(`/workspace/${regularWorkspaceId}`, regularJar);
      record(
        "regular-web",
        "GET /workspace/{id} renders",
        workspacePage.res.status === 200 && workspacePage.text.includes("plan") || workspacePage.text.length > 500,
        `HTTP ${workspacePage.res.status} len=${workspacePage.text.length}`
      );

      const { data: nodes } = await admin
        .from("blocks")
        .select("id, title")
        .eq("workspace_id", regularWorkspaceId);
      record(
        "regular-web",
        "workspace has plan blocks in DB",
        (nodes?.length ?? 0) > 0,
        `${nodes?.length ?? 0} blocks`
      );

      const tapPage = await webFetch(`/workspace/${regularWorkspaceId}/tap`, regularJar);
      record(
        "regular-web",
        "GET /workspace/{id}/tap UI",
        tapPage.res.status === 200,
        `HTTP ${tapPage.res.status}`
      );

      const tapList = await webFetch(`/api/workspace-tap-score?workspaceId=${regularWorkspaceId}`, regularJar);
      record(
        "regular-web",
        "GET /api/workspace-tap-score?workspaceId=…",
        tapList.res.status === 200,
        `HTTP ${tapList.res.status} sessions=${tapList.body?.tapSessions?.length ?? 0}`
      );
    }
  }

  // --- Teams: check-usage + org ---
  if (teamsJar) {
    const usage = await webFetch("/api/check-usage", teamsJar);
    const ok =
      usage.res.status === 200 &&
      usage.body?.allowed === true &&
      usage.body?.plan === "pro_teams";
    record(
      "teams-web",
      "GET /api/check-usage (pro_teams, allowed)",
      ok,
      ok
        ? `plan=${usage.body.plan} limit=${usage.body.limit} used=${usage.body.used}`
        : `${usage.res.status} ${JSON.stringify(usage.body)}`
    );

    const org = await webFetch("/api/organization", teamsJar);
    const orgOk =
      org.res.status === 200 &&
      org.body?.organization?.name?.includes("[E2E]") &&
      org.body?.is_org_admin === true;
    record(
      "teams-web",
      "GET /api/organization (E2E org + admin)",
      orgOk,
      orgOk ? org.body.organization.name : JSON.stringify(org.body)?.slice(0, 200)
    );

    record(
      "teams-web",
      "GET /api/organization guests array present",
      org.res.status === 200 && Array.isArray(org.body?.guests),
      `guests=${org.body?.guests?.length ?? "n/a"}`
    );

    const listKeys = await webFetch("/api/v2/agent/keys", teamsJar);
    record(
      "teams-web",
      "GET /api/v2/agent/keys (session auth)",
      listKeys.res.status === 200 && Array.isArray(listKeys.body?.keys),
      `HTTP ${listKeys.res.status} keys=${listKeys.body?.keys?.length ?? 0}`
    );

    const createKey = await webFetch("/api/v2/agent/keys", teamsJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "[E2E] Dashboard-created key", scopes: ["workspaces:read", "tap:read"] }),
    });
    const keyLimitMessage = String(createKey.body?.error?.message || "");
    const keyCreated =
      createKey.res.status === 201 ||
      (createKey.res.status === 403 &&
        (keyLimitMessage.includes("limit") ||
          keyLimitMessage.includes("at most") ||
          keyLimitMessage.includes("API keys")));
    record(
      "teams-web",
      "POST /api/v2/agent/keys (session auth)",
      keyCreated,
      `${createKey.res.status} ${createKey.body?.key?.key_prefix || createKey.body?.error?.message || ""}`
    );

    const orgPage = await webFetch("/organization", teamsJar);
    record(
      "teams-web",
      "GET /organization page",
      orgPage.res.status === 200,
      `HTTP ${orgPage.res.status}`
    );

    const demoStatus = await webFetch("/api/demo/status", teamsJar);
    record(
      "demo-api",
      "GET /api/demo/status (auth gate, not 404)",
      demoStatus.res.status !== 404 && typeof demoStatus.body === "object",
      `HTTP ${demoStatus.res.status}`
    );

    const demoSchema = await webFetch("/api/demo/proof-of-work-schema", teamsJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    record(
      "demo-api",
      "POST /api/demo/proof-of-work-schema exists (not 404)",
      demoSchema.res.status !== 404,
      `HTTP ${demoSchema.res.status}`
    );

    const legacyDemoEvidence = await webFetch("/api/demo/evidence", teamsJar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    record(
      "demo-api",
      "legacy /api/demo/evidence absent",
      legacyDemoEvidence.res.status === 404 || legacyDemoEvidence.res.status === 403,
      `HTTP ${legacyDemoEvidence.res.status}`
    );
  }

  // --- Agent API + MCP + full TAP ---
  const apiKey = env.E2E_TEAMS_API_KEY;
  if (!apiKey) {
    record("agent-api", "E2E_TEAMS_API_KEY configured", false, "missing");
  } else {
    const create = await agentJson("/api/v2/agent/workspaces", apiKey, {
      method: "POST",
      body: JSON.stringify({
        initial_prompt: "[E2E-FULL] Explain how hash maps achieve O(1) average lookup.",
      }),
    });
    const workspaceId = create.body?.workspace?.id;
    record(
      "agent-api",
      "POST /workspaces",
      create.res.status === 201 && !!workspaceId,
      workspaceId || `${create.res.status}`
    );

    if (workspaceId) {
      const blocks = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/blocks`, apiKey);
      const blockId = blocks.body?.blocks?.[0]?.id;
      record("agent-api", "GET /blocks", blocks.res.status === 200 && !!blockId, `${blocks.body?.blocks?.length ?? 0} blocks`);

      const mcpList = await mcpCall(apiKey, "tools/list", {}, 10);
      const tools = mcpList.body?.result?.tools;
      record(
        "mcp",
        "tools/list",
        mcpList.res.status === 200 && Array.isArray(tools) && tools.length > 0,
        `${tools?.length ?? 0} tools`
      );

      const toolNames = (tools || []).map((t) => t.name);
      record(
        "proof-of-work",
        "MCP tools/list includes renamed proof-of-work tools",
        toolNames.includes("upload_proof_of_work") &&
          toolNames.includes("generate_proof_of_work_schema"),
        toolNames.filter((n) => n.includes("proof") || n.includes("evidence")).join(", ")
      );
      record(
        "proof-of-work",
        "MCP tools/list excludes legacy evidence tool names",
        !toolNames.includes("upload_evidence") &&
          !toolNames.includes("generate_evidence_schema"),
        toolNames.filter((n) => n.includes("evidence")).join(", ") || "none"
      );

      const legacyEvidence = await agentJson(
        `/api/v2/agent/workspaces/${workspaceId}/evidence`,
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            type: "tool",
            mime_type: "application/json",
            data: Buffer.from("{}").toString("base64"),
          }),
        }
      );
      record(
        "proof-of-work",
        "POST legacy /evidence rejected",
        legacyEvidence.res.status === 404 || legacyEvidence.res.status === 405,
        `HTTP ${legacyEvidence.res.status}`
      );

      const schema = await agentJson(
        `/api/v2/agent/workspaces/${workspaceId}/proof-of-work-schema`,
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            definition: "[E2E] Observe tool usage during a short coding exercise.",
          }),
        }
      );
      record(
        "proof-of-work",
        "POST /proof-of-work-schema responds (not 500)",
        schema.res.status !== 500,
        `HTTP ${schema.res.status}`
      );

      const upload = await agentJson(
        `/api/v2/agent/workspaces/${workspaceId}/proof-of-work`,
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            type: "tool",
            mime_type: "application/json",
            data: Buffer.from(
              JSON.stringify({ tool_name: "e2e", events: [{ action: "probe" }] })
            ).toString("base64"),
          }),
        }
      );
      record(
        "proof-of-work",
        "POST /proof-of-work routed (not 404/500)",
        upload.res.status !== 404 && upload.res.status !== 500,
        `HTTP ${upload.res.status}`
      );

      const mcpWs = await mcpCall(
        apiKey,
        "tools/call",
        { name: "list_workspaces", arguments: { limit: 5 } },
        11
      );
      const wsCount = mcpWs.body?.result?.content?.[0]?.text
        ? JSON.parse(mcpWs.body.result.content[0].text)?.workspaces?.length
        : null;
      record(
        "mcp",
        "list_workspaces",
        mcpWs.res.status === 200 && wsCount !== null,
        `workspaces=${wsCount}`
      );

      if (blockId) {
        const link = await agentJson(
          `/api/v2/agent/workspaces/${workspaceId}/blocks/${blockId}/tap-links`,
          apiKey,
          { method: "POST", body: JSON.stringify({ minutes: 15 }) }
        );
        const linkPayload = link.body?.tap_link;
        const linkId = linkPayload?.id;
        const privateUrl = linkPayload?.private_url;
        record("agent-api", "POST TAP link", link.res.status === 201 && !!linkId, linkId || `${link.res.status}`);

        if (privateUrl) {
          const token = privateUrl.split("/").pop();
          const page = await fetch(`${baseUrl}/tap/session/${token}`);
          record("tap-flow", "private session page", page.status === 200, `HTTP ${page.status}`);

          const chat = await fetch(`${baseUrl}/api/workspace-tap-score/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              privateToken: token,
              thought:
                "I think hash maps use a hash function to map keys to buckets, and collisions are handled with chaining or open addressing.",
              messages: [],
            }),
          });
          const chatBody = await chat.json();
          record(
            "tap-flow",
            "POST /api/workspace-tap-score/chat",
            chat.status === 200 && !!chatBody?.message,
            chat.status === 200 ? `reply len=${String(chatBody.message).length}` : `${chat.status} ${JSON.stringify(chatBody)?.slice(0, 120)}`
          );

          const complete = await fetch(`${baseUrl}/api/workspace-tap-score/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              privateToken: token,
              durationSeconds: 120,
              requestedDurationSeconds: 900,
              transcript: [
                {
                  role: "learner",
                  text: "A hash map stores key-value pairs. The hash function maps each key to an index. Collisions happen when two keys hash to the same bucket; we resolve them with chaining linked lists or probing.",
                },
                {
                  role: "assistant",
                  text: "What happens to average lookup time if every key collides into one bucket?",
                },
                {
                  role: "learner",
                  text: "Then lookup degrades to O(n) because you scan a linked list in that bucket instead of O(1).",
                },
              ],
            }),
          });
          const completeBody = await complete.json();
          const completed =
            complete.status === 200 &&
            (completeBody?.tapSession?.status === "completed" ||
              completeBody?.status === "completed" ||
              !!completeBody?.workspaceId);
          record(
            "tap-flow",
            "POST /api/workspace-tap-score/complete",
            completed,
            completed
              ? `workspace=${completeBody?.workspaceId ?? workspaceId}`
              : `${complete.status} ${JSON.stringify(completeBody)?.slice(0, 200)}`
          );

          if (linkId && completed) {
            const listRes = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/tap-links`, apiKey);
            const link = (listRes.body?.tap_links || []).find((row) => row.id === linkId);
            const listOk = listRes.res.status === 200 && link?.status === "completed";
            record(
              "tap-flow",
              "GET /tap-links (completed status)",
              listOk,
              listOk ? `status=${link.status}` : `${listRes.res.status}`
            );
          }
        }
      }

      const guestEmail = `e2e-guest-auto+${Date.now()}@uncertain.systems`;
      const guest = await agentJson("/api/v2/agent/org/guests", apiKey, {
        method: "POST",
        body: JSON.stringify({ email: guestEmail }),
      });
      const guestKey = guest.body?.api_key;
      record(
        "agent-api",
        "POST /org/guests",
        guest.res.status === 201 && !!guest.body?.guest_user?.id && !!guestKey,
        guest.res.status === 201 ? guestEmail : `${guest.res.status}`
      );

      if (guestKey) {
        const guestWs = await agentJson("/api/v2/agent/workspaces", guestKey, {
          method: "POST",
          body: JSON.stringify({
            initial_prompt: "[E2E-GUEST] Explain how guest users can create Verification Workspaces.",
          }),
        });
        const guestWorkspaceId = guestWs.body?.workspace?.id;
        record(
          "agent-api",
          "guest key can create workspace",
          guestWs.res.status === 201 && !!guestWorkspaceId,
          guestWorkspaceId || `HTTP ${guestWs.res.status}`
        );

        if (guestWorkspaceId) {
          const guestBlocks = await agentJson(`/api/v2/agent/workspaces/${guestWorkspaceId}/blocks`, guestKey);
          const guestBlockId = guestBlocks.body?.blocks?.[0]?.id;
          record(
            "agent-api",
            "guest key can list blocks",
            guestBlocks.res.status === 200 && !!guestBlockId,
            `${guestBlocks.body?.blocks?.length ?? 0} blocks`
          );

          if (guestBlockId) {
            const guestLink = await agentJson(
              `/api/v2/agent/workspaces/${guestWorkspaceId}/blocks/${guestBlockId}/tap-links`,
              guestKey,
              { method: "POST", body: JSON.stringify({ minutes: 15 }) }
            );
            const guestLinkPayload = guestLink.body?.tap_link;
            const guestLinkId = guestLinkPayload?.id;
            const guestPrivateUrl = guestLinkPayload?.private_url;
            record(
              "tap-flow",
              "guest key can create TAP link",
              guestLink.res.status === 201 && !!guestLinkId && !!guestPrivateUrl,
              guestLinkId || `HTTP ${guestLink.res.status}`
            );

            if (guestPrivateUrl) {
              const guestToken = guestPrivateUrl.split("/").pop();
              const guestPage = await fetch(`${baseUrl}/tap/session/${guestToken}`);
              const guestPageText = await guestPage.text();
              record(
                "tap-flow",
                "guest TAP private session page",
                guestPage.status === 200 && guestPageText.length > 5000,
                `HTTP ${guestPage.status} len=${guestPageText.length}`
              );

              const guestChat = await fetch(`${baseUrl}/api/workspace-tap-score/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  privateToken: guestToken,
                  thought: "Guests can use private TAP links to demonstrate learning on assigned blocks.",
                  messages: [],
                }),
              });
              const guestChatBody = await guestChat.json();
              record(
                "tap-flow",
                "guest TAP chat via private token",
                guestChat.status === 200 && !!guestChatBody?.message,
                guestChat.status === 200 ? `reply len=${String(guestChatBody.message).length}` : `${guestChat.status}`
              );

              const guestComplete = await fetch(`${baseUrl}/api/workspace-tap-score/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  privateToken: guestToken,
                  durationSeconds: 90,
                  transcript: [
                    {
                      role: "learner",
                      text: "Guest users receive API keys and can open private TAP links without logging in.",
                    },
                  ],
                }),
              });
              const guestCompleteBody = await guestComplete.json();
              const guestCompleted =
                guestComplete.status === 200 &&
                (guestCompleteBody?.tapSession?.status === "completed" || !!guestCompleteBody?.workspaceId);
              record(
                "tap-flow",
                "guest TAP complete via private token",
                guestCompleted,
                guestCompleted
                  ? `workspace=${guestCompleteBody?.workspaceId ?? guestWorkspaceId}`
                  : `${guestComplete.status} ${JSON.stringify(guestCompleteBody)?.slice(0, 120)}`
              );
            }
          }
        }
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    ran_at: new Date().toISOString(),
    base_url: baseUrl,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed,
    all: results,
  };
  writeFileSync("scripts/e2e-expanded-report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(`\n=== ${report.passed}/${report.total} passed, ${report.failed} failed ===`);
  console.log("Report: scripts/e2e-expanded-report.json");
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});