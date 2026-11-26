/**
 * Org-admin BYOK: Organization tab surface, sealed customer secrets,
 * request-time resolver vs process env, redacted reads, xAI session debit.
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getChatConfig } from "@/lib/ai/chat";
import { blobStoreKind } from "@/lib/ai/blob-store";
import { runWithXaiContext } from "@/lib/xai-context";
import { sealString } from "@/lib/crypto/seal";
import {
  FLOW_SESSION_CREDIT_COST,
  debitFlowSessionCredits,
  flowSessionCreditCost,
  createMemoryCreditStore,
  STARTER_CREDIT_GRANT,
} from "@/lib/credits";
import {
  applyOrgBackendMutation,
  authorizeOrgBackendEdit,
  DEFAULT_XAI_CHAT_BASE_URL,
  DEFAULT_XAI_FILES_BASE_URL,
  omitOrgSecretColumns,
  parseOrgBackendMutation,
  presentOrgBackends,
  presentOrganizationRow,
  resolveOrgRuntime,
  platformBlobConfigFromEnv,
  platformChatConfigFromEnv,
} from "@/lib/organization/org-backends";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const SEAL_SECRET = "org-byok-test-seal-secret";

describe("Organization tab BYOK surface", () => {
  it("exposes LLM and document-storage save/load for org admins only", () => {
    const dashboard = read("components/OrganizationDashboardTab.tsx");
    expect(dashboard).toContain('data-org-backends');
    expect(dashboard).toContain('data-org-llm-backend');
    expect(dashboard).toContain('data-org-blob-backend');
    expect(dashboard).toContain('data-org-openrouter-backend');
    expect(dashboard).toContain('data-org-openrouter-api-key');
    expect(dashboard).toContain('data-org-llm-mode="platform"');
    expect(dashboard).toContain('data-org-backends-save');
    expect(dashboard).toContain('fetch("/api/organization/backends"');
    expect(dashboard).toContain('method: "PUT"');
    expect(dashboard).toContain("handleSaveBackends");
    expect(dashboard).toContain("openrouter:");
    expect(dashboard).toContain("isOrgAdmin");
    expect(dashboard).toContain('t("organization.llmBackendPlatform")');
    expect(dashboard).toContain('t("organization.blobBackendPlatform")');

    const route = read("app/api/organization/backends/route.ts");
    expect(route).toContain("authorizeOrgBackendEdit");
    expect(route).toContain("parseOrgBackendMutation");
    expect(route).toContain("applyOrgBackendMutation");
    expect(route).toContain("sealString");
    expect(route).toContain("presentOrgBackends");
    expect(route).toContain("openrouter_api_key_ciphertext");

    const orgGet = read("app/api/organization/route.ts");
    expect(orgGet).toContain("presentOrganizationRow");

    const page = read("app/dashboard/page.tsx");
    expect(page).toContain('activeTab === "organization"');
    expect(page).toContain("OrganizationDashboardTab");

    const legacy = read("app/organization/page.tsx");
    expect(legacy).toContain("/dashboard?tab=organization");

    const migration = read("supabase/migrations/20261120120000_organization_backends.sql");
    expect(migration).toContain("llm_api_key_ciphertext");
    expect(migration).toContain("blob_api_key_ciphertext");
    expect(migration).toContain("llm_backend");
    expect(migration).toContain("blob_backend");

    const openrouterMigration = read(
      "supabase/migrations/20261125120000_organization_openrouter.sql",
    );
    expect(openrouterMigration).toContain("openrouter_api_key_ciphertext");
    expect(openrouterMigration).toContain("openrouter_api_key_last_four");

    const envExample = read(".env.local.example");
    expect(envExample).not.toMatch(/OPENROUTER_API_KEY=/);
    expect(envExample).toContain("OPENROUTER_JOB_MAX_USD");

    const en = JSON.parse(read("messages/en.json")) as {
      organization: Record<string, string>;
    };
    for (const key of [
      "backends",
      "backendsTitle",
      "llmBackendPlatform",
      "blobBackendPlatform",
      "saveBackends",
      "xaiCreditNote",
      "openrouterBackend",
      "openrouterApiKey",
      "openrouterClearKey",
    ]) {
      expect(en.organization[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("refuses non-admins and accepts org admins", () => {
    const member = authorizeOrgBackendEdit({
      organization_id: "org-1",
      is_org_admin: false,
    });
    expect(member.ok).toBe(false);
    if (!member.ok) expect(member.status).toBe(403);

    const noOrg = authorizeOrgBackendEdit({
      organization_id: null,
      is_org_admin: true,
    });
    expect(noOrg.ok).toBe(false);

    const admin = authorizeOrgBackendEdit({
      organization_id: "org-1",
      is_org_admin: true,
    });
    expect(admin).toEqual({ ok: true, organizationId: "org-1" });
  });
});

describe("org backend mutation and presenter", () => {
  it("seals customer keys and never presents ciphertext or plaintext", () => {
    const parsed = parseOrgBackendMutation({
      llm: {
        mode: "custom",
        provider: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-live-customer-llm-key",
        model: "gpt-4.1",
      },
      blob: {
        mode: "custom",
        provider: "xai",
        apiKey: "xai-customer-files-key",
      },
      openrouter: {
        apiKey: "sk-or-live-org-key",
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const applied = applyOrgBackendMutation(null, parsed.value, (plain) =>
      sealString(plain, SEAL_SECRET),
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.next.llm_backend).toBe("custom");
    expect(applied.next.llm_api_key_ciphertext).toBeTruthy();
    expect(applied.next.llm_api_key_ciphertext).not.toContain("sk-live-customer-llm-key");
    expect(applied.next.llm_api_key_last_four).toBe("sk-live-customer-llm-key".slice(-4));
    expect(applied.next.blob_api_key_last_four).toBe("xai-customer-files-key".slice(-4));
    expect(applied.next.openrouter_api_key_ciphertext).toBeTruthy();
    expect(applied.next.openrouter_api_key_ciphertext).not.toContain("sk-or-live-org-key");
    expect(applied.next.openrouter_api_key_last_four).toBe("sk-or-live-org-key".slice(-4));

    const presented = presentOrgBackends(applied.next);
    const json = JSON.stringify(presented);
    expect(json).not.toContain("sk-live-customer-llm-key");
    expect(json).not.toContain("xai-customer-files-key");
    expect(json).not.toContain("sk-or-live-org-key");
    expect(json).not.toContain(applied.next.llm_api_key_ciphertext);
    expect(json).not.toContain(applied.next.blob_api_key_ciphertext);
    expect(json).not.toContain(applied.next.openrouter_api_key_ciphertext);
    expect(presented.llm.configured).toBe(true);
    expect(presented.llm.lastFour).toBe("sk-live-customer-llm-key".slice(-4));
    expect(presented.blob.configured).toBe(true);
    expect(presented.openrouter.configured).toBe(true);
    expect(presented.openrouter.lastFour).toBe("sk-or-live-org-key".slice(-4));

    const row = presentOrganizationRow({
      id: "org-1",
      name: "Acme",
      xai_api_key_ciphertext: "platform-provisioned-ciphertext",
      llm_api_key_ciphertext: applied.next.llm_api_key_ciphertext,
      blob_api_key_ciphertext: applied.next.blob_api_key_ciphertext,
      openrouter_api_key_ciphertext: applied.next.openrouter_api_key_ciphertext,
      llm_api_key_last_four: applied.next.llm_api_key_last_four,
      llm_backend: "custom",
    });
    expect(row).not.toHaveProperty("xai_api_key_ciphertext");
    expect(row).not.toHaveProperty("llm_api_key_ciphertext");
    expect(row).not.toHaveProperty("blob_api_key_ciphertext");
    expect(row).not.toHaveProperty("openrouter_api_key_ciphertext");
    expect(JSON.stringify(row)).not.toContain("platform-provisioned-ciphertext");
    expect(JSON.stringify(omitOrgSecretColumns({ xai_api_key_ciphertext: "secret" }))).not.toContain(
      "secret",
    );
  });

  it("rejects client attempts to write ciphertext", () => {
    const rejected = parseOrgBackendMutation({
      llm_api_key_ciphertext: "sneak",
      llm: { mode: "custom", provider: "xai", apiKey: "xai-1" },
    });
    expect(rejected.ok).toBe(false);

    const openrouterRejected = parseOrgBackendMutation({
      openrouter: { apiKey: "sk-or-1", openrouter_api_key_ciphertext: "sneak" },
    });
    expect(openrouterRejected.ok).toBe(false);
  });

  it("seals and clears an OpenRouter key without touching LLM backends", () => {
    const parsed = parseOrgBackendMutation({
      openrouter: { apiKey: "sk-or-only" },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const applied = applyOrgBackendMutation(null, parsed.value, (plain) =>
      sealString(plain, SEAL_SECRET),
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.next.llm_backend).toBe("platform");
    expect(applied.next.openrouter_api_key_last_four).toBe("only");

    const cleared = applyOrgBackendMutation(
      applied.next,
      { openrouter: { apiKey: null, clearKey: true } },
      (plain) => sealString(plain, SEAL_SECRET),
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.next.openrouter_api_key_ciphertext).toBeNull();
    expect(cleared.next.openrouter_api_key_last_four).toBeNull();
  });

  it("defaults an empty org to platform xAI", () => {
    const presented = presentOrgBackends(null);
    expect(presented.llm.mode).toBe("platform");
    expect(presented.blob.mode).toBe("platform");
    expect(presented.openrouter.configured).toBe(false);
    expect(presented.llmIsXai).toBe(true);
    expect(presented.sessionCreditCost).toBe(flowSessionCreditCost(undefined, { llmIsXai: true }));
  });
});

describe("org backend resolver vs process env", () => {
  const envKeys = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "XAI_API_KEY", "BLOB_STORE"] as const;
  const snapshot = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("uses the org record even when process env names a different provider", () => {
    process.env.AI_BASE_URL = "http://localhost:11434/v1";
    process.env.AI_API_KEY = "env-ollama-key";
    process.env.AI_MODEL = "llama3";
    process.env.BLOB_STORE = "fs";
    const platformChat = platformChatConfigFromEnv(process.env);
    const platformBlob = platformBlobConfigFromEnv(process.env);
    expect(platformChat.apiKey).toBe("env-ollama-key");
    expect(platformChat.baseURL).toContain("11434");

    const runtime = resolveOrgRuntime(
      {
        llm_backend: "custom",
        llm_provider: "xai",
        llm_base_url: DEFAULT_XAI_CHAT_BASE_URL,
        llm_model: "grok-4.5",
        blob_backend: "custom",
        blob_provider: "openai-compatible",
        blob_base_url: "https://files.example/v1",
      },
      platformChat,
      platformBlob,
      { llmApiKey: "org-xai-key", blobApiKey: "org-files-key" },
    );
    expect(runtime.source).toBe("org");
    expect(runtime.chat.baseURL).toBe(DEFAULT_XAI_CHAT_BASE_URL);
    expect(runtime.chat.apiKey).toBe("org-xai-key");
    expect(runtime.chat.apiKey).not.toBe(platformChat.apiKey);
    expect(runtime.blob.apiKey).toBe("org-files-key");
    expect(runtime.blob.baseURL).toBe("https://files.example/v1");
    expect(runtime.llmIsXai).toBe(true);
    expect(runtime.sessionCreditCost).toBe(flowSessionCreditCost(undefined, { llmIsXai: true }));
  });

  it("empty/default org record resolves to platform xAI credits", () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    process.env.XAI_API_KEY = "platform-xai-key";
    delete process.env.BLOB_STORE;
    const platformChat = platformChatConfigFromEnv(process.env);
    const platformBlob = platformBlobConfigFromEnv(process.env);
    const runtime = resolveOrgRuntime(null, platformChat, platformBlob, {});
    expect(runtime.source).toBe("platform");
    expect(runtime.chat.baseURL).toBe(DEFAULT_XAI_CHAT_BASE_URL);
    expect(runtime.chat.apiKey).toBe("platform-xai-key");
    expect(runtime.blob.kind).toBe("xai");
    expect(runtime.blob.baseURL).toBe(DEFAULT_XAI_FILES_BASE_URL);
    expect(runtime.llmIsXai).toBe(true);
    expect(runtime.sessionCreditCost).toBe(flowSessionCreditCost(undefined, { llmIsXai: true }));
    expect(runtime.sessionCreditCost).toBe(Math.max(1, Math.floor(FLOW_SESSION_CREDIT_COST / 2)));
  });

  it("non-xAI custom LLM uses the full session credit cost", async () => {
    const runtime = resolveOrgRuntime(
      {
        llm_backend: "custom",
        llm_provider: "openai-compatible",
        llm_base_url: "https://api.openai.com/v1",
      },
      platformChatConfigFromEnv({
        AI_BASE_URL: "https://api.x.ai/v1",
        XAI_API_KEY: "platform",
      } as unknown as NodeJS.ProcessEnv),
      platformBlobConfigFromEnv({} as unknown as NodeJS.ProcessEnv),
      { llmApiKey: "sk-org" },
    );
    expect(runtime.llmIsXai).toBe(false);
    expect(runtime.sessionCreditCost).toBe(flowSessionCreditCost(undefined, { llmIsXai: false }));
    expect(runtime.sessionCreditCost).toBe(FLOW_SESSION_CREDIT_COST);

    const store = createMemoryCreditStore({ runner: STARTER_CREDIT_GRANT });
    const debit = await debitFlowSessionCredits(store, {
      runnerUserId: "runner",
      ownerUserId: "runner",
      flowKind: "verify",
      llmIsXai: runtime.llmIsXai,
    });
    expect(debit.ok).toBe(true);
    expect((await store.load("runner")).balance).toBe(
      STARTER_CREDIT_GRANT - runtime.sessionCreditCost,
    );
  });

  it("request-time getChatConfig and blobStoreKind follow the org runtime, not env", () => {
    process.env.AI_BASE_URL = "http://localhost:11434/v1";
    process.env.AI_API_KEY = "env-ollama-key";
    process.env.BLOB_STORE = "memory";
    runWithXaiContext(
      {
        organizationId: "org-1",
        apiKey: "org-xai-key",
        chatConfig: {
          baseURL: DEFAULT_XAI_CHAT_BASE_URL,
          apiKey: "org-xai-key",
          model: "grok-4.5",
          canvasAskModel: "grok-4.7",
          canvasCommandModel: "grok-4.20-0309-non-reasoning",
        },
        blobKind: "xai",
        blobBaseURL: DEFAULT_XAI_FILES_BASE_URL,
        blobApiKey: "org-files-key",
      },
      () => {
        expect(getChatConfig().baseURL).toBe(DEFAULT_XAI_CHAT_BASE_URL);
        expect(getChatConfig().apiKey).toBe("org-xai-key");
        expect(blobStoreKind()).toBe("xai");
      },
    );
  });
});
