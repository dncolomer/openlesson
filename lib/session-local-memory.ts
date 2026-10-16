/**
 * Drop in-memory field and policy snapshots when a flow leaves.
 * Persist first, then call this so autosave can still merge the remembered policy.
 */

import { clearSessionBranchFieldCache } from "@/lib/session-branch-field-load";
import {
  clearRememberedSessionPolicies,
  forgetSessionPolicy,
} from "@/lib/session-policy-store";

export function releaseSessionLocalMemory(sessionId?: string | null): void {
  clearSessionBranchFieldCache();
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (id) forgetSessionPolicy(id);
  else clearRememberedSessionPolicies();
}
