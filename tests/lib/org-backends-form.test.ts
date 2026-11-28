import { describe, expect, it } from "vitest";
import {
  INITIAL_ORG_BACKENDS_FORM_STATE,
  orgBackendsFormReducer,
} from "@/components/organization/use-org-backends-form";
import type { OrgBackendPublic } from "@/lib/organization/org-backends";

describe("orgBackendsFormReducer", () => {
  it("hydrates LLM, blob, and OpenRouter fields while clearing secret inputs", () => {
    const dirty = {
      ...INITIAL_ORG_BACKENDS_FORM_STATE,
      llmApiKey: "secret-old",
      blobApiKey: "blob-old",
      openrouterApiKey: "or-old",
      openrouterClearKey: true,
    };

    const payload: OrgBackendPublic = {
      llm: {
        mode: "custom",
        provider: "openai-compatible",
        baseUrl: "https://llm.internal/v1",
        model: "llama-3",
        configured: true,
        lastFour: "1234",
      },
      blob: {
        mode: "custom",
        provider: "xai",
        baseUrl: "https://api.x.ai",
        configured: true,
        lastFour: "5678",
      },
      openrouter: {
        configured: true,
        lastFour: "9999",
      },
      llmIsXai: false,
      sessionCreditCost: 0,
    };

    const next = orgBackendsFormReducer(dirty, { type: "hydrate", backends: payload });
    expect(next.backends).toEqual(payload);
    expect(next.llmMode).toBe("custom");
    expect(next.llmProvider).toBe("openai-compatible");
    expect(next.llmBaseUrl).toBe("https://llm.internal/v1");
    expect(next.llmModel).toBe("llama-3");
    expect(next.llmApiKey).toBe("");
    expect(next.blobMode).toBe("custom");
    expect(next.blobProvider).toBe("xai");
    expect(next.blobApiKey).toBe("");
    expect(next.openrouterApiKey).toBe("");
    expect(next.openrouterClearKey).toBe(false);
  });

  it("updates individual fields and saving flag", () => {
    let state = orgBackendsFormReducer(INITIAL_ORG_BACKENDS_FORM_STATE, {
      type: "setField",
      field: "llmModel",
      value: "grok-4.5",
    });
    expect(state.llmModel).toBe("grok-4.5");

    state = orgBackendsFormReducer(state, { type: "setSaving", saving: true });
    expect(state.savingBackends).toBe(true);
  });
});
