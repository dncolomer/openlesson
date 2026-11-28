import { useCallback, useReducer } from "react";
import type { OrgBackendPublic } from "@/lib/organization/org-backends";

export type BackendMode = "platform" | "custom";
export type BackendProvider = "xai" | "openai-compatible";

export type OrgBackendsFormState = {
  backends: OrgBackendPublic | null;
  llmMode: BackendMode;
  llmProvider: BackendProvider;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  blobMode: BackendMode;
  blobProvider: BackendProvider;
  blobBaseUrl: string;
  blobApiKey: string;
  openrouterApiKey: string;
  openrouterClearKey: boolean;
  savingBackends: boolean;
};

export const INITIAL_ORG_BACKENDS_FORM_STATE: OrgBackendsFormState = {
  backends: null,
  llmMode: "platform",
  llmProvider: "xai",
  llmBaseUrl: "",
  llmApiKey: "",
  llmModel: "",
  blobMode: "platform",
  blobProvider: "xai",
  blobBaseUrl: "",
  blobApiKey: "",
  openrouterApiKey: "",
  openrouterClearKey: false,
  savingBackends: false,
};

export type OrgBackendsFormAction =
  | { type: "hydrate"; backends: OrgBackendPublic }
  | { type: "setField"; field: Exclude<keyof OrgBackendsFormState, "backends">; value: OrgBackendsFormState[Exclude<keyof OrgBackendsFormState, "backends">] }
  | { type: "setSaving"; saving: boolean };

export function orgBackendsFormReducer(
  state: OrgBackendsFormState,
  action: OrgBackendsFormAction,
): OrgBackendsFormState {
  switch (action.type) {
    case "hydrate": {
      const next = action.backends;
      return {
        ...state,
        backends: next,
        llmMode: next.llm.mode,
        llmProvider:
          next.llm.provider === "openai-compatible" ? "openai-compatible" : "xai",
        llmBaseUrl: next.llm.baseUrl || "",
        llmModel: next.llm.model || "",
        llmApiKey: "",
        blobMode: next.blob.mode,
        blobProvider:
          next.blob.provider === "openai-compatible" ? "openai-compatible" : "xai",
        blobBaseUrl: next.blob.baseUrl || "",
        blobApiKey: "",
        openrouterApiKey: "",
        openrouterClearKey: false,
      };
    }
    case "setField":
      return { ...state, [action.field]: action.value };
    case "setSaving":
      return { ...state, savingBackends: action.saving };
    default:
      return state;
  }
}

export function useOrgBackendsForm() {
  const [state, dispatch] = useReducer(
    orgBackendsFormReducer,
    INITIAL_ORG_BACKENDS_FORM_STATE,
  );

  const applyBackends = useCallback((next: OrgBackendPublic | null | undefined) => {
    if (!next) return;
    dispatch({ type: "hydrate", backends: next });
  }, []);

  const setField = useCallback(
    <K extends Exclude<keyof OrgBackendsFormState, "backends">>(
      field: K,
      value: OrgBackendsFormState[K],
    ) => {
      dispatch({ type: "setField", field, value });
    },
    [],
  );

  const setSavingBackends = useCallback((saving: boolean) => {
    dispatch({ type: "setSaving", saving });
  }, []);

  return {
    state,
    applyBackends,
    setField,
    setSavingBackends,
  };
}
