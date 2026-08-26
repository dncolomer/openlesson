import { readMcpSurface } from "@/tests/helpers/surface-source";
/**
 * TAPBench timed-session helper (not a public mint API).
 * Keys/tasks mint on /tapbench; TAP/ILE mint stay on workspace APIs.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
  listWorkspaceTapbenchLinks,
  parseTapbenchLinkBody,
} from "@/lib/pow-api/create-tapbench-link";
import {
  AGENT_TOOL_SURFACE,
  agentToolNames,
} from "@/lib/pow-api/agent-tool-surface";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-proof-of-work-server";
import {
  resetAllTapbenchSessionsForTests,
  resolveStoredTapbenchSession,
  getTapbenchLinkByToken,
} from "@/lib/pow-api/tapbench";
import type { AuthContext } from "@/lib/pow-api/types";
import { createdByApiKeyId } from "@/lib/pow-api/auth";

function sessionAuthContext(userId: string): AuthContext {
  return {
    user_id: userId,
    guest_user_id: null,
    organization_id: null,
    is_org_admin: false,
    key_id: "",
    scopes: ["*"],
  };
}

const ROOT = join(__dirname, "../..");

const GOOD_EXERCISE =
  "Exercise: Let G be a connected undirected graph with n=6 vertices. Prove or disprove: if every vertex has degree ≥ 3, then G contains a cycle of length at most 4. Give a concrete adjacency list for your counterexample or a short proof, and box the final claim.";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const WS_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const GUEST_ID = "55555555-5555-4555-8555-555555555555";
const KEY_ID = "66666666-6666-4666-8666-666666666666";

const auth: AuthContext = {
  user_id: USER_ID,
  guest_user_id: null,
  organization_id: ORG_ID,
  is_org_admin: true,
  key_id: KEY_ID,
  scopes: ["tap:write", "tap:read", "*"],
};

type TableHandler = (op: {
  table: string;
  filters: Record<string, string>;
  payload?: unknown;
}) => { data: unknown; error: unknown };

function makeSupabase(handler: TableHandler) {
  const chain = (table: string) => {
    const filters: Record<string, string> = {};
    const api: Record<string, unknown> = {};
    const self = () => api;
    api.select = () => self();
    api.eq = (col: string, val: string) => {
      filters[col] = val;
      return self();
    };
    api.maybeSingle = async () => handler({ table, filters });
    api.single = async () => handler({ table, filters });
    api.insert = (payload: unknown) => {
      const insertChain: Record<string, unknown> = {};
      insertChain.select = () => insertChain;
      insertChain.single = async () => handler({ table, filters, payload });
      return insertChain;
    };
    api.order = () => self();
    // listTapbenchLinksPersisted awaits the builder as a thenable
    api.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(handler({ table, filters })).then(resolve);
    return api;
  };
  return {
    from: (table: string) => chain(table),
  } as never;
}

const baseWorkspace = {
  id: WS_ID,
  user_id: USER_ID,
  organization_id: ORG_ID,
  guest_user_id: null,
  title: "Computer Science",
  workspace_goal: "Map computational skill evidence",
  root_topic: "Computer Science",
};

const promptContext = {
  workspaceTitle: "Computer Science",
  workspaceGoal: "Map computational skill evidence",
  rootTopic: "Computer Science",
  workspaceDescription: "CS public workspace",
  notes: null,
  focusedBlockId: BLOCK_ID,
  focusedBlockTitle: "Algorithms & Complexity",
  focusedBlockDescription: "Design, analysis, and computational complexity.",
  files: [],
  externalResources: [],
  blocks: [
    {
      id: BLOCK_ID,
      title: "Algorithms & Complexity",
      description: "Design, analysis, and computational complexity.",
    },
  ],
  blockLocalContext: null,
  unusableCells: [],
} as never;

describe("parseTapbenchLinkBody", () => {
  it("accepts snake_case and camelCase duration + block + exercise", () => {
    const a = parseTapbenchLinkBody({
      block_id: "b1",
      duration_seconds: 600,
      exercise: GOOD_EXERCISE,
    });
    expect(a.blockId).toBe("b1");
    expect(a.durationSeconds).toBe(600);
    expect(a.exerciseText).toContain("undirected graph");

    const b = parseTapbenchLinkBody({
      blockId: "b2",
      minutes: 20,
      exerciseText: GOOD_EXERCISE,
    });
    expect(b.blockId).toBe("b2");
    expect(b.durationSeconds).toBe(1200);
  });
});

describe("createWorkspaceTapbenchLink (shipped agent mint)", () => {
  beforeEach(() => {
    resetAllTapbenchSessionsForTests();
  });

  function supabaseForMint(opts?: { blockOk?: boolean; guestId?: string }) {
    const blockOk = opts?.blockOk !== false;
    const guestId = opts?.guestId ?? GUEST_ID;
    return makeSupabase(({ table, filters, payload }) => {
      if (table === "workspaces") {
        return { data: baseWorkspace, error: null };
      }
      if (table === "blocks") {
        if (!blockOk) return { data: null, error: { message: "missing" } };
        if (filters.id === BLOCK_ID && filters.workspace_id === WS_ID) {
          return { data: { id: BLOCK_ID }, error: null };
        }
        return { data: null, error: null };
      }
      if (table === "organization_guest_users" && payload) {
        return { data: { id: guestId }, error: null };
      }
      if (table === "workspace_tapbench_links") {
        if (payload && typeof payload === "object") {
          const p = payload as Record<string, unknown>;
          return {
            data: {
              ...p,
              exercise_text: p.exercise_text ?? p.exercise,
            },
            error: null,
          };
        }
        // list
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });
  }

  it("mints with tap:write-shaped auth, non-empty session_token + exercise + guest", async () => {
    const link = await createWorkspaceTapbenchLink({
      supabase: supabaseForMint(),
      auth,
      workspaceId: WS_ID,
      blockId: BLOCK_ID,
      body: {
        duration_seconds: 900,
        exercise: GOOD_EXERCISE,
      },
      baseUrl: "https://example.com",
      promptContext,
      generateExercise: async () => ({
        exercise: GOOD_EXERCISE,
        source: "explicit",
      }),
      nowMs: 1_700_000_000_000,
    });

    expect(link.session_token.trim().length).toBeGreaterThan(8);
    expect(link.public_token).toBe(link.session_token);
    expect(link.exercise).toContain("undirected graph");
    expect(link.exercise.length).toBeGreaterThan(40);
    expect(link.duration_seconds).toBe(900);
    expect(link.remaining_ms).toBe(900_000);
    expect(link.expires_at).toBeTruthy();
    expect(link.url).toContain("/tapbench/");
    expect(link.url).toContain(link.session_token);
    expect(link.workspace_id).toBe(WS_ID);
    expect(link.block_id).toBe(BLOCK_ID);
    expect(link.guest_user_id).toBe(GUEST_ID);
    expect(link.id).toBeTruthy();
    expect(link.exercise_source).toBe("explicit");

    // Resolvable like UI-minted links
    const resolved = resolveStoredTapbenchSession(link.session_token, 1_700_000_000_000);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.exercise).toContain("undirected graph");
      expect(resolved.guest_user_id).toBe(GUEST_ID);
      expect(resolved.block_id).toBe(BLOCK_ID);
    }
    expect(getTapbenchLinkByToken(link.session_token)?.guest_user_id).toBe(GUEST_ID);
  });

  it("mints consistently on repeated calls (independent tokens)", async () => {
    const guestB = "77777777-7777-4777-8777-777777777777";
    const common = {
      auth,
      workspaceId: WS_ID,
      body: { exercise: GOOD_EXERCISE, duration_seconds: 600 },
      baseUrl: "https://example.com",
      promptContext,
      generateExercise: async () =>
        ({ exercise: GOOD_EXERCISE, source: "explicit" as const }),
      nowMs: 1_700_000_000_000,
    };

    const a = await createWorkspaceTapbenchLink({
      ...common,
      supabase: supabaseForMint({ guestId: GUEST_ID }),
    });
    const b = await createWorkspaceTapbenchLink({
      ...common,
      supabase: supabaseForMint({ guestId: guestB }),
    });

    expect(a.session_token).toBeTruthy();
    expect(b.session_token).toBeTruthy();
    expect(a.session_token).not.toBe(b.session_token);
    expect(a.exercise).toBe(b.exercise);
    expect(a.exercise.length).toBeGreaterThan(0);
    expect(b.exercise.length).toBeGreaterThan(0);
    expect(a.guest_user_id).toBe(GUEST_ID);
    expect(b.guest_user_id).toBe(guestB);
    expect(resolveStoredTapbenchSession(a.session_token, 1_700_000_000_000).ok).toBe(true);
    expect(resolveStoredTapbenchSession(b.session_token, 1_700_000_000_000).ok).toBe(true);

    // REST response body shape (same fields the POST route wraps as tapbench_link)
    const restBodies = [a, b].map((link) => ({
      workspace_id: WS_ID,
      tapbench_link: {
        id: link.id,
        workspace_id: link.workspace_id,
        block_id: link.block_id,
        session_token: link.session_token,
        public_token: link.public_token,
        url: link.url,
        exercise: link.exercise,
        duration_seconds: link.duration_seconds,
        expires_at: link.expires_at,
        remaining_ms: link.remaining_ms,
        guest_user_id: link.guest_user_id,
      },
      exercise_source: link.exercise_source,
    }));
    for (const body of restBodies) {
      expect(body.tapbench_link.session_token.trim().length).toBeGreaterThan(8);
      expect(body.tapbench_link.exercise.trim().length).toBeGreaterThan(40);
      expect(body.tapbench_link.url).toContain(body.tapbench_link.session_token);
    }
    // Durable evidence for verification plan step 2 (handler body content ×2)
    // eslint-disable-next-line no-console
    console.log(
      "TAPBENCH_REST_BODY_EVIDENCE=" +
        JSON.stringify({
          run_count: restBodies.length,
          run1: {
            session_token_nonempty: Boolean(restBodies[0].tapbench_link.session_token),
            session_token_len: restBodies[0].tapbench_link.session_token.length,
            exercise_nonempty: Boolean(restBodies[0].tapbench_link.exercise),
            exercise_preview: restBodies[0].tapbench_link.exercise.slice(0, 100),
            url: restBodies[0].tapbench_link.url,
            guest_user_id: restBodies[0].tapbench_link.guest_user_id,
            block_id: restBodies[0].tapbench_link.block_id,
            duration_seconds: restBodies[0].tapbench_link.duration_seconds,
            remaining_ms: restBodies[0].tapbench_link.remaining_ms,
            expires_at: restBodies[0].tapbench_link.expires_at,
          },
          run2: {
            session_token_nonempty: Boolean(restBodies[1].tapbench_link.session_token),
            session_token_len: restBodies[1].tapbench_link.session_token.length,
            exercise_nonempty: Boolean(restBodies[1].tapbench_link.exercise),
            exercise_preview: restBodies[1].tapbench_link.exercise.slice(0, 100),
            tokens_differ:
              restBodies[0].tapbench_link.session_token !==
              restBodies[1].tapbench_link.session_token,
            guest_user_id: restBodies[1].tapbench_link.guest_user_id,
          },
        }),
    );
  });

  it("rejects unknown block with block_not_found", async () => {
    await expect(
      createWorkspaceTapbenchLink({
        supabase: supabaseForMint({ blockOk: false }),
        auth,
        workspaceId: WS_ID,
        blockId: "99999999-9999-4999-8999-999999999999",
        body: { exercise: GOOD_EXERCISE },
        baseUrl: "https://example.com",
        promptContext,
        generateExercise: async () => ({
          exercise: GOOD_EXERCISE,
          source: "explicit",
        }),
      }),
    ).rejects.toMatchObject({
      name: "CreateTapbenchLinkError",
      code: "block_not_found",
      status: 404,
    } satisfies Partial<CreateTapbenchLinkError>);
  });

  it("rejects inaccessible workspace", async () => {
    const supabase = makeSupabase(({ table }) => {
      if (table === "workspaces") {
        return {
          data: {
            ...baseWorkspace,
            user_id: "88888888-8888-4888-8888-888888888888",
            organization_id: "99999999-9999-4999-8999-999999999999",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    await expect(
      createWorkspaceTapbenchLink({
        supabase,
        auth: { ...auth, organization_id: ORG_ID, user_id: USER_ID, is_org_admin: false },
        workspaceId: WS_ID,
        body: { exercise: GOOD_EXERCISE },
        baseUrl: "https://example.com",
        promptContext,
        generateExercise: async () => ({
          exercise: GOOD_EXERCISE,
          source: "explicit",
        }),
      }),
    ).rejects.toMatchObject({ code: "workspace_not_found", status: 404 });
  });

  it("UI-shaped session AuthContext provisions guest with null created_by_api_key_id", async () => {
    // Shipped browser helper — must not pass fake api_key id into guest FK.
    const uiAuth = sessionAuthContext(USER_ID);
    expect(createdByApiKeyId(uiAuth)).toBeNull();
    expect(uiAuth.auth_method).not.toBe("api_key");

    let guestInsert: Record<string, unknown> | null = null;
    const supabase = makeSupabase(({ table, filters, payload }) => {
      if (table === "workspaces") {
        return { data: baseWorkspace, error: null };
      }
      if (table === "blocks") {
        if (filters.id === BLOCK_ID && filters.workspace_id === WS_ID) {
          return { data: { id: BLOCK_ID }, error: null };
        }
        return { data: null, error: null };
      }
      if (table === "organization_guest_users" && payload && typeof payload === "object") {
        guestInsert = payload as Record<string, unknown>;
        return { data: { id: GUEST_ID }, error: null };
      }
      if (table === "workspace_tapbench_links" && payload && typeof payload === "object") {
        const p = payload as Record<string, unknown>;
        return {
          data: { ...p, exercise_text: p.exercise_text ?? p.exercise },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const link = await createWorkspaceTapbenchLink({
      supabase,
      auth: uiAuth,
      workspaceId: WS_ID,
      blockId: BLOCK_ID,
      body: { exercise: GOOD_EXERCISE, duration_seconds: 900 },
      baseUrl: "https://example.com",
      // guardWorkspaceRoute already authorized; UI uses skipAccessCheck.
      skipAccessCheck: true,
      promptContext,
      generateExercise: async () => ({
        exercise: GOOD_EXERCISE,
        source: "explicit",
      }),
      nowMs: 1_700_000_000_000,
    });

    expect(guestInsert).not.toBeNull();
    expect(guestInsert!.created_by_api_key_id).toBeNull();
    expect(guestInsert!.created_by_user_id).toBe(USER_ID);
    expect(link.guest_user_id).toBe(GUEST_ID);
    expect(link.session_token.trim().length).toBeGreaterThan(8);
    expect(link.exercise.length).toBeGreaterThan(40);
  });

  it("listWorkspaceTapbenchLinks returns workspace-scoped rows after mint", async () => {
    const supabase = supabaseForMint();
    const minted = await createWorkspaceTapbenchLink({
      supabase,
      auth,
      workspaceId: WS_ID,
      body: { exercise: GOOD_EXERCISE, duration_seconds: 900 },
      baseUrl: "https://example.com",
      promptContext,
      generateExercise: async () => ({
        exercise: GOOD_EXERCISE,
        source: "explicit",
      }),
      nowMs: 1_700_000_000_000,
    });

    const listed = await listWorkspaceTapbenchLinks({
      supabase,
      auth,
      workspaceId: WS_ID,
      baseUrl: "https://example.com",
      nowMs: 1_700_000_000_000,
    });
    expect(listed.workspace_id).toBe(WS_ID);
    expect(listed.tapbench_links.some((r) => r.id === minted.id)).toBe(true);
    const row = listed.tapbench_links.find((r) => r.id === minted.id)!;
    expect(row.public_token).toBe(minted.session_token);
    expect(row.exercise).toContain("undirected graph");
    expect(row.url).toContain(minted.session_token);
  });
});

describe("agent REST + MCP surface omits TAPBench mint", () => {
  it("does not register create_tapbench_link or list_tapbench_links on AGENT_TOOL_SURFACE", () => {
    const names = new Set(agentToolNames());
    expect(names.has("create_tapbench_link")).toBe(false);
    expect(names.has("list_tapbench_links")).toBe(false);
    expect(AGENT_TOOL_SURFACE.find((t) => t.name === "create_tapbench_link")).toBeUndefined();
    expect(AGENT_TOOL_SURFACE.find((t) => t.name === "list_tapbench_links")).toBeUndefined();
  });

  it("MCP_EVIDENCE_TOOLS names match agent surface without TAPBench mint tools", () => {
    const surface = new Set(agentToolNames());
    const mcp = new Set(MCP_EVIDENCE_TOOLS.map((t) => t.name));
    expect(surface.has("create_tapbench_link")).toBe(false);
    expect(surface.has("list_tapbench_links")).toBe(false);
    expect(mcp.has("create_tapbench_link")).toBe(false);
    expect(mcp.has("list_tapbench_links")).toBe(false);
    expect([...surface].sort()).toEqual([...mcp].sort());
  });

  it("MCP server does not dispatch create_tapbench_link / list_tapbench_links", () => {
    const src = readMcpSurface();
    expect(src).not.toMatch(/name === "create_tapbench_link"/);
    expect(src).not.toMatch(/name === "list_tapbench_links"/);
  });

  it("does not ship agent REST route handlers for TAPBench mint", () => {
    const collection = join(
      ROOT,
      "app/api/v3/pow/workspaces/[id]/tapbench-links/route.ts",
    );
    const blockScoped = join(
      ROOT,
      "app/api/v3/pow/workspaces/[id]/blocks/[blockId]/tapbench-links/route.ts",
    );
    expect(existsSync(collection)).toBe(false);
    expect(existsSync(blockScoped)).toBe(false);
  });

  it("does not ship workspace TAPBench mint route", () => {
    expect(
      existsSync(join(ROOT, "app/api/workspace/tapbench-links/route.ts")),
    ).toBe(false);
  });

  it("Proof-of-Work API docs do not document TAPBench mint", () => {
    const docs = readFileSync(join(ROOT, "docs/PROOF_OF_WORK_API.md"), "utf8");
    expect(docs).not.toMatch(/create_tapbench_link/);
    expect(docs).not.toMatch(/list_tapbench_links/);
    expect(docs).not.toMatch(/\/api\/v3\/pow\/workspaces\/\{workspace_id\}\/tapbench-links/);
    expect(docs).not.toMatch(/\/api\/workspace\/tapbench-links/);
  });
});
