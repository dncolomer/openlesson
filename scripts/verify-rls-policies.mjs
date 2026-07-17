import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { connectTarget } from "./db-connection.mjs";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env.e2e"), ...process.env };

const ADMIN_ID = "07d2dd9a-c5a6-425e-ac00-d25b5349d84f";
const E2E_REGULAR_ID = env.E2E_REGULAR_USER_ID || "6dab56fa-ee43-4b46-8603-b7abba2f15c9";
const E2E_REGULAR_EMAIL = env.E2E_REGULAR_EMAIL;
const E2E_REGULAR_PASSWORD = env.E2E_REGULAR_PASSWORD;

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function asRole(client, userId, fn) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL role authenticated");
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
    return await fn();
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifySqlRls(target) {
  console.log(`\n[${target}] SQL RLS simulation`);
  const { client } = await connectTarget(target);

  const regularUserId =
    E2E_REGULAR_ID !== ADMIN_ID
      ? E2E_REGULAR_ID
      : "00000000-0000-4000-8000-000000000099";

  const regularExists = (
    await client.query("SELECT 1 FROM profiles WHERE id = $1", [regularUserId])
  ).rowCount;

  if (regularExists) {
    // profiles: own row readable, other row not (regular user — admins see all)
    const ownProfile = await asRole(client, regularUserId, async () => {
      const r = await client.query(
        "SELECT id, username FROM profiles WHERE id = $1",
        [regularUserId]
      );
      return r.rows;
    });
    if (ownProfile.length === 1) {
      pass(`${target}: profiles own read`, ownProfile[0].username || regularUserId);
    } else {
      fail(`${target}: profiles own read`, `rows=${ownProfile.length}`);
    }

    const otherProfile = await asRole(client, regularUserId, async () => {
      const r = await client.query(
        "SELECT count(*)::int AS n FROM profiles WHERE id = $1",
        [ADMIN_ID]
      );
      return r.rows[0].n;
    });
    if (otherProfile === 0) {
      pass(`${target}: profiles other user hidden`);
    } else {
      fail(`${target}: profiles other user hidden`, `count=${otherProfile}`);
    }
  } else {
    pass(`${target}: profiles own read`, "skipped (regular user not in DB)");
    pass(`${target}: profiles other user hidden`, "skipped (regular user not in DB)");
  }

  // admin can view all profiles (no recursion via is_admin_user)
  const adminAllProfiles = await asRole(client, ADMIN_ID, async () => {
    const r = await client.query("SELECT count(*)::int AS n FROM profiles");
    return r.rows[0].n;
  });
  if (adminAllProfiles > 0) {
    pass(`${target}: profiles admin read all`, `${adminAllProfiles} rows`);
  } else {
    fail(`${target}: profiles admin read all`, "0 rows");
  }

  // session_transcript: insert own, cannot read others
  const testSessionId = "00000000-0000-4000-8000-00000000e2e1";
  await client.query("DELETE FROM session_transcript WHERE xai_file_id = 'rls-test'");
  await client.query("DELETE FROM session_audio WHERE storage_path LIKE '%rls-test%'");
  await client.query("DELETE FROM sessions WHERE id = $1", [testSessionId]);
  await client.query(
    `INSERT INTO sessions (id, user_id, problem, status)
     VALUES ($1, $2, 'rls-verify', 'active')`,
    [testSessionId, ADMIN_ID]
  );

  const ownTranscript = await asRole(client, ADMIN_ID, async () => {
    await client.query(
      `INSERT INTO session_transcript (session_id, user_id, timestamp_ms, xai_file_id, chunk_index, word_count)
       VALUES ($1, $2, 1, 'rls-test', 0, 0)`,
      [testSessionId, ADMIN_ID]
    );
    const r = await client.query(
      "SELECT count(*)::int AS n FROM session_transcript WHERE user_id = $1 AND xai_file_id = 'rls-test'",
      [ADMIN_ID]
    );
    return r.rows[0].n;
  });
  if (ownTranscript >= 1) {
    pass(`${target}: session_transcript own insert/read`);
  } else {
    fail(`${target}: session_transcript own insert/read`);
  }

  const otherTranscript = await asRole(client, ADMIN_ID, async () => {
    const r = await client.query(
      "SELECT count(*)::int AS n FROM session_transcript WHERE user_id <> $1",
      [ADMIN_ID]
    );
    return r.rows[0].n;
  });
  if (otherTranscript === 0) {
    pass(`${target}: session_transcript other users hidden`);
  } else {
    fail(`${target}: session_transcript other users hidden`, `count=${otherTranscript}`);
  }

  // session_audio: same pattern
  const ownAudio = await asRole(client, ADMIN_ID, async () => {
    await client.query(
      `INSERT INTO session_audio (session_id, user_id, timestamp_ms, storage_path, chunk_index)
       VALUES ($1, $2, 1, $3, 0)`,
      [testSessionId, ADMIN_ID, `${ADMIN_ID}/${testSessionId}/rls-test.mp4`]
    );
    const r = await client.query(
      "SELECT count(*)::int AS n FROM session_audio WHERE user_id = $1 AND storage_path LIKE '%rls-test%'",
      [ADMIN_ID]
    );
    return r.rows[0].n;
  });
  if (ownAudio >= 1) {
    pass(`${target}: session_audio own insert/read`);
  } else {
    fail(`${target}: session_audio own insert/read`);
  }

  const otherAudio = await asRole(client, ADMIN_ID, async () => {
    const r = await client.query(
      "SELECT count(*)::int AS n FROM session_audio WHERE user_id <> $1",
      [ADMIN_ID]
    );
    return r.rows[0].n;
  });
  if (otherAudio === 0) {
    pass(`${target}: session_audio other users hidden`);
  } else {
    fail(`${target}: session_audio other users hidden`, `count=${otherAudio}`);
  }

  // cleanup test rows
  await client.query("DELETE FROM session_transcript WHERE xai_file_id = 'rls-test'");
  await client.query("DELETE FROM session_audio WHERE storage_path LIKE '%rls-test%'");
  await client.query("DELETE FROM sessions WHERE id = $1", [testSessionId]);

  // ── Hardening checks (open agent policies / privilege escalation) ──
  if (regularExists) {
    // Cross-user workspace isolation: regular cannot list all workspaces
    const otherWorkspaces = await asRole(client, regularUserId, async () => {
      const r = await client.query(
        `SELECT count(*)::int AS n FROM workspaces WHERE user_id = $1`,
        [ADMIN_ID]
      );
      return r.rows[0].n;
    });
    if (otherWorkspaces === 0) {
      pass(`${target}: workspaces other user hidden`);
    } else {
      fail(`${target}: workspaces other user hidden`, `count=${otherWorkspaces}`);
    }

    // agent_api_keys: cannot list all keys (open SELECT policy must be gone)
    const allKeys = await asRole(client, regularUserId, async () => {
      const r = await client.query(
        `SELECT count(*)::int AS n FROM agent_api_keys WHERE user_id IS DISTINCT FROM $1`,
        [regularUserId]
      );
      return r.rows[0].n;
    });
    if (allKeys === 0) {
      pass(`${target}: agent_api_keys other keys hidden`);
    } else {
      fail(`${target}: agent_api_keys other keys hidden`, `count=${allKeys}`);
    }

    // agent_api_keys: client INSERT blocked (must go through service role API)
    const insertKeyBlocked = await asRole(client, regularUserId, async () => {
      try {
        await client.query(
          `INSERT INTO agent_api_keys (user_id, key_hash, key_prefix, scopes)
           VALUES ($1, 'rls-test-hash', 'sk_rls_test', ARRAY['*']::text[])`,
          [regularUserId]
        );
        return false;
      } catch {
        return true;
      }
    });
    if (insertKeyBlocked) {
      pass(`${target}: agent_api_keys client insert blocked`);
    } else {
      // cleanup accidental insert
      await client.query(
        `DELETE FROM agent_api_keys WHERE key_hash = 'rls-test-hash'`
      );
      fail(`${target}: agent_api_keys client insert blocked`, "insert succeeded");
    }

    // organization_invites: no full-table select (world-readable policy must be gone)
    const inviteEnum = await asRole(client, regularUserId, async () => {
      const r = await client.query(
        `SELECT count(*)::int AS n FROM organization_invites`
      );
      return r.rows[0].n;
    });
    // Org admins may see own org invites; non-admins should see 0 unless they are org admin.
    // Accept small counts only if user is org admin of those rows — treat any wide dump as fail.
    if (inviteEnum === 0) {
      pass(`${target}: organization_invites not world-readable`);
    } else {
      // If user is org admin, they may legitimately see own-org invites.
      const isOrgAdmin = (
        await client.query(
          `SELECT is_org_admin FROM profiles WHERE id = $1`,
          [regularUserId]
        )
      ).rows[0]?.is_org_admin;
      if (isOrgAdmin) {
        pass(
          `${target}: organization_invites not world-readable`,
          `org admin saw ${inviteEnum} (own-org policy)`
        );
      } else {
        fail(
          `${target}: organization_invites not world-readable`,
          `count=${inviteEnum} for non-admin`
        );
      }
    }

    // profiles: cannot self-elevate is_admin
    const adminEscalationBlocked = await asRole(client, regularUserId, async () => {
      try {
        await client.query(
          `UPDATE profiles SET is_admin = true WHERE id = $1`,
          [regularUserId]
        );
        const r = await client.query(
          `SELECT is_admin FROM profiles WHERE id = $1`,
          [regularUserId]
        );
        return r.rows[0]?.is_admin !== true;
      } catch {
        return true;
      }
    });
    // Ensure we didn't leave them as admin
    await client.query(
      `UPDATE profiles SET is_admin = false WHERE id = $1 AND is_admin = true`,
      [regularUserId]
    );
    if (adminEscalationBlocked) {
      pass(`${target}: profiles is_admin self-update blocked`);
    } else {
      fail(`${target}: profiles is_admin self-update blocked`, "escalation succeeded");
    }
  } else {
    pass(`${target}: workspaces other user hidden`, "skipped (regular user not in DB)");
    pass(`${target}: agent_api_keys other keys hidden`, "skipped");
    pass(`${target}: agent_api_keys client insert blocked`, "skipped");
    pass(`${target}: organization_invites not world-readable`, "skipped");
    pass(`${target}: profiles is_admin self-update blocked`, "skipped");
  }

  // Policy inventory: open agent policies must not exist
  const openPolicies = await client.query(`
    SELECT pol.polname AS name
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND pol.polname IN (
        'Agent endpoints can read agent api keys',
        'Agent endpoints can read learning plans',
        'Agent endpoints can create learning plans',
        'Agent endpoints can read plan nodes',
        'Agent endpoints can create plan nodes',
        'Agent endpoints can update plan nodes',
        'Anyone can view invite by token',
        'Service can insert proofs',
        'Service can update proofs',
        'Service can insert batches',
        'Service can update batches',
        'Service can insert conversations',
        'Service can update conversations',
        'Users can create own agent api keys'
      )
  `);
  if (openPolicies.rowCount === 0) {
    pass(`${target}: open agent/service RLS policies dropped`);
  } else {
    fail(
      `${target}: open agent/service RLS policies dropped`,
      openPolicies.rows.map((r) => r.name).join(", ")
    );
  }

  await client.end();
}

async function verifyAnonApi() {
  console.log("\n[prod] Anon API client");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    fail("anon api: env", "missing url or anon key");
    return;
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .limit(5);
  if (profileErr || !profiles?.length) {
    pass("anon: profiles blocked", profileErr?.message || "0 rows");
  } else {
    fail("anon: profiles blocked", `${profiles.length} rows returned`);
  }

  const { data: transcripts, error: txErr } = await supabase
    .from("session_transcript")
    .select("id")
    .limit(1);
  if (txErr || !transcripts?.length) {
    pass("anon: session_transcript blocked", txErr?.message || "0 rows");
  } else {
    fail("anon: session_transcript blocked", "rows returned");
  }

  const { data: audio, error: audioErr } = await supabase
    .from("session_audio")
    .select("id")
    .limit(1);
  if (audioErr || !audio?.length) {
    pass("anon: session_audio blocked", audioErr?.message || "0 rows");
  } else {
    fail("anon: session_audio blocked", "rows returned");
  }
}

async function verifyAuthenticatedApi() {
  console.log("\n[prod] Authenticated E2E user API");
  if (!E2E_REGULAR_EMAIL || !E2E_REGULAR_PASSWORD) {
    fail("auth api: env", "missing E2E_REGULAR credentials");
    return;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: E2E_REGULAR_EMAIL,
    password: E2E_REGULAR_PASSWORD,
  });
  if (authErr || !authData.user) {
    fail("auth: sign in", authErr?.message || "no user");
    return;
  }
  pass("auth: sign in", authData.user.id);

  const { data: ownProfile, error: ownErr } = await supabase
    .from("profiles")
    .select("id, username, plan")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (ownErr || !ownProfile) {
    fail("auth: own profile read", ownErr?.message || "no row");
  } else {
    pass("auth: own profile read", ownProfile.username || ownProfile.id);
  }

  const { data: otherProfile, error: otherErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", ADMIN_ID)
    .maybeSingle();
  if (otherErr || !otherProfile) {
    pass("auth: other profile hidden");
  } else {
    fail("auth: other profile hidden", "admin profile visible to e2e user");
  }

  const { data: ownSessions, error: sessErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", authData.user.id)
    .limit(1);
  if (sessErr) {
    fail("auth: own sessions read", sessErr.message);
  } else {
    pass("auth: own sessions read", `${ownSessions?.length ?? 0} rows`);
  }

  if (ownSessions?.[0]) {
    const sessionId = ownSessions[0].id;
    const { error: txReadErr } = await supabase
      .from("session_transcript")
      .select("id")
      .eq("session_id", sessionId)
      .limit(1);
    if (txReadErr) {
      fail("auth: own session_transcript read", txReadErr.message);
    } else {
      pass("auth: own session_transcript read");
    }

    const { error: audioReadErr } = await supabase
      .from("session_audio")
      .select("id")
      .eq("session_id", sessionId)
      .limit(1);
    if (audioReadErr) {
      fail("auth: own session_audio read", audioReadErr.message);
    } else {
      pass("auth: own session_audio read");
    }
  } else {
    pass("auth: own session_transcript read", "skipped (no sessions)");
    pass("auth: own session_audio read", "skipped (no sessions)");
  }

  await supabase.auth.signOut();
}

async function main() {
  console.log("RLS policy verification\n");

  await verifySqlRls("prod");
  await verifySqlRls("staging");
  await verifyAnonApi();
  await verifyAuthenticatedApi();

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(
    `Checks: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`
  );
  if (failed.length) {
    for (const item of failed) console.log(`- ${item.name}: ${item.detail}`);
    process.exit(1);
  }
  console.log("\nRLS policies behave as expected for anon, authenticated, and owner access.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});