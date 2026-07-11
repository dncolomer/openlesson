export type PromptEntryKind = "registry" | "inline" | "builder" | "consumer" | "context";
export type PromptRegistryStatus = "active" | "legacy";

export interface PromptDomain {
  id: string;
  label: string;
  description: string;
  order: number;
}

export interface PromptInventoryEntry {
  id: string;
  domainId: string;
  file: string;
  symbol: string;
  kind: PromptEntryKind;
  status?: PromptRegistryStatus;
  label?: string;
  description?: string;
  usedBy?: string[];
  delegatesTo?: string;
  text: string;
  charCount: number;
}

export interface PromptInventory {
  version: number;
  generated_at: string;
  call_sites_generated_at: string;
  path_count: number;
  entry_count: number;
  domains: PromptDomain[];
  entries: PromptInventoryEntry[];
}