"use client";

import type { ReactNode } from "react";
import type { Block, Workspace } from "@/lib/domain/types";
import { parseBlockCreatorEffects } from "@/lib/block-creator-effects";
import { parseWorkspacePracticeOptions } from "@/lib/block-practice-options";
import { parseBlockLocalContext } from "@/lib/prompt-workspace-context";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";

export type { Block, Workspace };

export const MODEL_STORAGE_KEY = "planner-model";

export type MobileColumn = "plan" | "sessions" | "workspace";

export type InjectMapNote = {
  token: number;
  body: string;
  x: number;
  y: number;
  source?: "creator" | "learner";
};

export type ClusterMapJob = {
  active: boolean;
  progress: number;
  label: string;
} | null;

export type WorkspaceBlockApiNode = Block & {
  local_context?: unknown;
  practice_options?: unknown;
  creator_effects?: unknown;
};

export interface WorkspaceViewProps {
  initialPlan?: Workspace;
  initialNodes?: Block[];
  /**
   * AYCL / purchased lifetime access: token is sent on authoring APIs.
   * Full tier → owner-equivalent tools; learner tier → practice only.
   */
  ayclToken?: string;
  /** Owner user id for AYCL (Knowledge/PoW subject scoping). */
  ayclOwnerUserId?: string;
  /** Purchase tier seed (avoids authoring flash before refresh). */
  ayclAccessTier?: string | null;
  /**
   * Explicit workspace id when not on /workspace/[id] (e.g. /learn/[token]).
   */
  workspaceIdOverride?: string;
  /** Hide main Navbar (AYCL page provides its own chrome). */
  hideNavbar?: boolean;
  /** Optional top banner under nav (e.g. Lifetime access). */
  accessBanner?: ReactNode;
}

export function planShareSlug(plan: Workspace) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
      "plan",
  );
}

export function parseSectionParam(value: string | null): WorkspaceSectionKey | null {
  if (
    value === "workspace" ||
    value === "context" ||
    value === "simulation" ||
    value === "dags" ||
    value === "map_types" ||
    value === "goals" ||
    value === "knowledge" ||
    value === "settings"
  ) {
    return value;
  }
  return null;
}

export function mapWorkspaceNodes(
  raw: WorkspaceBlockApiNode[],
  opts?: { ayclClone?: boolean },
): Block[] {
  return raw.map((n) => ({
    ...n,
    local_context: parseBlockLocalContext(n.local_context),
    practice_options: parseWorkspacePracticeOptions(n.practice_options, {
      ayclClone: opts?.ayclClone,
    }),
    creator_effects: parseBlockCreatorEffects(n.creator_effects, {
      selfBlockId: n.id,
    }),
  }));
}

export function plannerModelFromStorage(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "") || "";
}
