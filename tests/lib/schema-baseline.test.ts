import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PublicTableName } from "@/lib/supabase/database.types";

const ROOT = join(__dirname, "../..");

const EXPECTED_TABLES: readonly PublicTableName[] = [
  "agent_api_keys",
  "credit_ledger",
  "embedding_models",
  "flow_links",
  "knowledge_regions",
  "lti_context_regions",
  "lti_launches",
  "lti_oidc_state",
  "lti_platforms",
  "lti_tool_keys",
  "mcp_oauth_authorization_codes",
  "mcp_oauth_clients",
  "mcp_oauth_tokens",
  "organization_guest_users",
  "organization_invites",
  "organization_members",
  "organizations",
  "pending_checkouts",
  "profiles",
  "proof_of_work",
  "protocol_settings",
  "region_simulation_jobs",
  "session_embeddings",
  "sessions",
  "verify_flows",
];

describe("verification-only database schema baseline & upgrade contract", () => {
  it("keeps supabase/migrations/ to the single clean-start squashed baseline", () => {
    const entries = readdirSync(join(ROOT, "supabase/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    expect(entries).toEqual(["20261128120000_baseline.sql"]);
  });

  it("baseline defines all 25 active tables, 4 active functions, 2 storage buckets, and no dropped legacy tables/columns", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261128120000_baseline.sql"),
      "utf8",
    );

    for (const table of EXPECTED_TABLES) {
      expect(sql, `missing table public.${table}`).toContain(`CREATE TABLE public.${table} (`);
    }

    expect(sql).not.toContain("CREATE TABLE public.blocks");
    expect(sql).not.toContain("CREATE TABLE public.workspaces");
    expect(sql).not.toContain("match_transcript_chunks");
    expect(sql).not.toContain("get_group_workspace_sessions");
    expect(sql).not.toContain("get_org_workspace_analytics");
    expect(sql).not.toContain("get_personal_workspace_analytics");
    expect(sql).not.toContain("chapter_map");
    expect(sql).not.toContain("planning_prompt");

    for (const fn of [
      "public.accept_organization_invite",
      "public.handle_new_user",
      "public.is_admin_user",
      "public.prevent_privileged_profile_escalation",
    ]) {
      expect(sql, `missing function ${fn}`).toContain(fn);
    }

    expect(sql).toContain("'org-logos'");
    expect(sql).toContain("'org-aesthetics'");
    expect(sql).toContain("'verify-flowcfg-v1-d96'");
  });

  it("ships transactional forward drop migration for existing staging/prod environments", () => {
    const upgradePath = join(
      ROOT,
      "supabase/upgrade/20261128120000_drop_legacy_non_verification_schema.sql",
    );
    expect(existsSync(upgradePath)).toBe(true);
    const sql = readFileSync(upgradePath, "utf8");
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain("DROP TABLE IF EXISTS public.blocks CASCADE;");
    expect(sql).toContain("DROP TABLE IF EXISTS public.workspaces CASCADE;");
    expect(sql).toContain("DROP COLUMN IF EXISTS workspace_id");
    expect(sql).toContain("DROP COLUMN IF EXISTS block_id");
    expect(sql).toContain("DROP COLUMN IF EXISTS chapter_map");
    expect(sql).toContain("DROP COLUMN IF EXISTS probes");
    expect(sql).toContain("DROP COLUMN IF EXISTS planning_prompt");
    expect(sql).toContain("DROP EXTENSION IF EXISTS vector;");
  });
});
