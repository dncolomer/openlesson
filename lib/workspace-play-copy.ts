/**
 * Permanent play-only copies from Home Add to my Maps / AYCL buy.
 */

import { START_NEW_SESSION_LABEL } from "@/lib/block-previous-sessions";
import { resolveLaunchFromStyleAndModality } from "@/lib/product-intent";
import {
  DASHBOARD_MAPS_ADD_PATH,
  DASHBOARD_MAPS_REMOVE_PATH,
} from "@/lib/dashboard-home-catalog";

export { DASHBOARD_MAPS_ADD_PATH, DASHBOARD_MAPS_REMOVE_PATH };

export const ADD_TO_MY_MAPS_LABEL = "Add to my Maps";
export const REMOVE_FROM_MY_MAPS_LABEL = "Remove from my Maps";

export function isPlayCopyWorkspace(row: {
  is_play_copy?: boolean | null;
} | null | undefined): boolean {
  return Boolean(row?.is_play_copy);
}

export function playCopyMyMapsHref(): string {
  return "/dashboard?tab=my_maps";
}

export function playCopyWorkspaceHref(workspaceId: string): string {
  const id = String(workspaceId || "").trim();
  return id ? `/workspace/${id}` : playCopyMyMapsHref();
}

export function findExistingPlayCopyId(
  copies: readonly {
    id?: unknown;
    original_workspace_id?: unknown;
    is_play_copy?: boolean | null;
  }[],
  sourceWorkspaceId: string,
): string | null {
  const source = String(sourceWorkspaceId || "").trim();
  if (!source) return null;
  for (const copy of copies) {
    if (!isPlayCopyWorkspace(copy)) continue;
    if (String(copy.original_workspace_id || "").trim() !== source) continue;
    const id = String(copy.id || "").trim();
    if (id) return id;
  }
  return null;
}

export type AddToMyMapsDecision =
  | { action: "reuse"; copyId: string }
  | { action: "fork" }
  | { action: "buy" }
  | { action: "reject"; reason: "not_public" | "not_found" };

export function decideAddToMyMaps(input: {
  source: {
    id?: unknown;
    is_public?: boolean | null;
    is_all_you_can_learn?: boolean | null;
  } | null;
  existingCopies?: readonly {
    id?: unknown;
    original_workspace_id?: unknown;
    is_play_copy?: boolean | null;
  }[];
}): AddToMyMapsDecision {
  if (!input.source || !String(input.source.id || "").trim()) {
    return { action: "reject", reason: "not_found" };
  }
  if (!input.source.is_public) {
    return { action: "reject", reason: "not_public" };
  }
  const reuse = findExistingPlayCopyId(
    input.existingCopies || [],
    String(input.source.id),
  );
  if (reuse) return { action: "reuse", copyId: reuse };
  if (input.source.is_all_you_can_learn) return { action: "buy" };
  return { action: "fork" };
}

export type RemoveFromMyMapsDecision =
  | { action: "remove"; copyId: string }
  | { action: "reject"; reason: "not_found" };

export function decideRemoveFromMyMaps(input: {
  sourceWorkspaceId: string;
  existingCopies?: readonly {
    id?: unknown;
    original_workspace_id?: unknown;
    is_play_copy?: boolean | null;
  }[];
}): RemoveFromMyMapsDecision {
  const requested = String(input.sourceWorkspaceId || "").trim();
  if (!requested) return { action: "reject", reason: "not_found" };
  const bySource = findExistingPlayCopyId(input.existingCopies || [], requested);
  if (bySource) return { action: "remove", copyId: bySource };
  for (const copy of input.existingCopies || []) {
    if (!isPlayCopyWorkspace(copy)) continue;
    const id = String(copy.id || "").trim();
    if (id === requested) return { action: "remove", copyId: id };
  }
  return { action: "reject", reason: "not_found" };
}

export function catalogMapIsInMyMaps(
  copies: readonly {
    id?: unknown;
    original_workspace_id?: unknown;
    is_play_copy?: boolean | null;
  }[],
  sourceWorkspaceId: string,
): boolean {
  return Boolean(findExistingPlayCopyId(copies, sourceWorkspaceId));
}

export function playCopyFulfillOwnerUserId(input: {
  dashboardPlayCopy: boolean;
  purchaserUserId: string | null | undefined;
  guestUserId: string;
}): string {
  const purchaser = String(input.purchaserUserId || "").trim();
  if (input.dashboardPlayCopy && purchaser) return purchaser;
  return String(input.guestUserId || "").trim();
}

export function playCopyStartSessionTarget() {
  return resolveLaunchFromStyleAndModality("explore");
}

export function playCopyStartSessionLabel(): string {
  return START_NEW_SESSION_LABEL;
}

export function playCopyBlockSidebar(block: {
  title?: unknown;
  description?: unknown;
} | null | undefined): { title: string; description: string } | null {
  if (!block) return null;
  const title = String(block.title || "").replace(/\s+/g, " ").trim() || "Block";
  const description = String(block.description || "").trim();
  return { title, description };
}

export function dashboardMapBuyCheckoutBody(workspaceId: string): {
  priceType: "all_you_can_learn";
  workspaceId: string;
  ayclAccessTier: "full";
  dashboardPlayCopy: true;
} {
  return {
    priceType: "all_you_can_learn",
    workspaceId: String(workspaceId || "").trim(),
    ayclAccessTier: "full",
    dashboardPlayCopy: true,
  };
}
