/**
 * Anonymous guest placement helpers for Map of Knowledge mint-link flows.
 * Stored link_kind / MapDotKind ids stay "tap" | "ile".
 */

import { pickStemMiniAvatar } from "@/lib/map-of-knowledge/stem-avatars";
import { mapDotIsGolden, type MapDotKind } from "./payload";

/** Random anonymous guest display identity for Map placement UI (name + STEM mini avatar). */
export function generateAnonymousGuestIdentity(seed?: number): {
  display_name: string;
  guest_token: string;
  avatar_id: string;
  avatar_path: string;
  avatar_label: string;
} {
  const adjectives = [
    "Silent",
    "Curious",
    "Orbital",
    "Lucid",
    "Vivid",
    "Sparse",
    "Radiant",
    "Hidden",
    "Swift",
    "Deep",
  ];
  const nouns = [
    "Neuron",
    "Orbit",
    "Atlas",
    "Vector",
    "Signal",
    "Lattice",
    "Comet",
    "Prism",
    "Echo",
    "Quasar",
  ];
  const n =
    typeof seed === "number" && Number.isFinite(seed)
      ? Math.abs(Math.floor(seed))
      : Math.floor(Math.random() * 1e9);
  const adj = adjectives[n % adjectives.length];
  const noun = nouns[Math.floor(n / adjectives.length) % nouns.length];
  const suffix = (n % 9000) + 1000;
  // Offset seed so avatar variety is not locked 1:1 to the adjective index alone.
  const avatar = pickStemMiniAvatar(Math.floor(n / 17) + n * 3);
  const guest_token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `guest-${n.toString(16)}-${Date.now().toString(16)}`;
  return {
    display_name: `${adj} ${noun} ${suffix}`,
    guest_token,
    avatar_id: avatar.id,
    avatar_path: avatar.path,
    avatar_label: avatar.label,
  };
}

export type GuestLinkKind = "tap" | "ile";

export interface GuestPlacementRequest {
  workspace_id: string;
  block_id: string;
  link_kind: GuestLinkKind;
  guest_display_name?: string;
}

export interface GuestPlacementResult {
  ok: true;
  link_kind: GuestLinkKind;
  private_url: string;
  workspace_id: string;
  block_id: string;
  guest_display_name: string;
  map_dot_kind: MapDotKind;
  map_dot_golden: boolean;
}

export interface GuestPlacementError {
  ok: false;
  error: string;
  code: string;
}

/**
 * Validate guest placement inputs against the public map catalog.
 * Pure — does not mint links; API uses this then calls TAP/TAP Learning create.
 */
export function validateGuestPlacement(
  request: GuestPlacementRequest,
  catalog: {
    workspaces: Array<{ id: string; is_public?: boolean }>;
    blocks: Array<{ id: string; workspace_id: string }>;
  },
): { ok: true } | GuestPlacementError {
  const workspaceId = (request.workspace_id || "").trim();
  const blockId = (request.block_id || "").trim();
  const kind = request.link_kind;

  if (!workspaceId || !blockId) {
    return { ok: false, error: "workspace_id and block_id are required", code: "validation_error" };
  }
  if (kind !== "tap" && kind !== "ile") {
    return { ok: false, error: "link_kind must be tap or ile", code: "validation_error" };
  }

  const ws = catalog.workspaces.find((w) => w.id === workspaceId);
  if (!ws || ws.is_public === false) {
    return { ok: false, error: "Workspace is not public", code: "not_public" };
  }

  const block = catalog.blocks.find((b) => b.id === blockId && b.workspace_id === workspaceId);
  if (!block) {
    return { ok: false, error: "Block not found in public workspace", code: "block_not_found" };
  }

  return { ok: true };
}

/** Build the success payload for a minted guest link (dot kind semantics). */
export function buildGuestPlacementResult(input: {
  link_kind: GuestLinkKind;
  private_url: string;
  workspace_id: string;
  block_id: string;
  guest_display_name: string;
}): GuestPlacementResult {
  const map_dot_kind: MapDotKind = input.link_kind === "ile" ? "ile" : "tap";
  return {
    ok: true,
    link_kind: input.link_kind,
    private_url: input.private_url,
    workspace_id: input.workspace_id,
    block_id: input.block_id,
    guest_display_name: input.guest_display_name,
    map_dot_kind,
    map_dot_golden: mapDotIsGolden(map_dot_kind),
  };
}
