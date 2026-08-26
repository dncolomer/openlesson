/**
 * Build a knowledge region from TAPBench guest snapshots.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/pow-api/types";
import { createCustomVerificationModelFromSubjects } from "@/lib/pow-api/custom-verification-model-store";
import { listTapbenchBenchmarkTasks, resolveTapbenchOwnerUserId } from "./catalog";
import {
  supabaseTapbenchGuestStore,
  type TapbenchGuestStore,
  type TapbenchKeyGuest,
} from "./guests";
import { cosineThresholdToL2Radius, scoreTapbenchRegionIn64D } from "./score";
import { loadTapbenchOwnerLatestEmbedding } from "./store-supabase";

export async function createTapbenchRegionFromGuests(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  guestUserIds?: string[] | null;
  name?: string | null;
  guestStore?: TapbenchGuestStore;
}) {
  const store = options.guestStore ?? supabaseTapbenchGuestStore(options.supabase);
  const minted = await store.listByKey(options.auth.key_id);
  const wanted = (options.guestUserIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const selected: TapbenchKeyGuest[] = wanted.length
    ? minted.filter((g) => wanted.includes(g.guest_user_id))
    : minted;
  if (!selected.length) {
    throw Object.assign(new Error("Mint guests and snapshot them before building a region"), {
      status: 400,
      code: "validation_error",
    });
  }

  const tasks = await listTapbenchBenchmarkTasks(options.supabase);
  const title = tasks.find((t) => t.id === options.workspaceId)?.title || "TAPBench";
  const name = options.name?.trim() || `${title} region`;

  const { model, spec } = await createCustomVerificationModelFromSubjects(options.supabase, {
    workspaceId: options.workspaceId,
    name,
    description: "TAPBench region from guest-run snapshots",
    subjects: selected.map((g) => ({
      guest_user_id: g.guest_user_id,
      label: g.label,
    })),
    createdBy: options.auth.user_id,
  });

  return {
    region_id: model.id,
    name: model.name,
    subject_count: spec.subject_count,
    cosine_threshold: spec.cosine_threshold,
    mean_radius: spec.mean_radius,
    cohort_cohesion: spec.cohort_cohesion,
    guest_user_ids: selected.map((g) => g.guest_user_id),
  };
}

export type TapbenchPublicRegion = {
  id: string;
  workspace_id: string;
  name: string;
  subject_count: number;
  cosine_threshold: number;
  mean_radius: number;
  cohort_cohesion: number;
  guest_user_ids: string[];
  created_at: string;
  /** Whether tapbench@uncertain.systems latest snapshot is inside this region. */
  in_region: boolean | null;
  /** 64D L2 from that owner snapshot to the region centroid. */
  distance_to_center: number | null;
  /** 64D L2 from that owner snapshot to the cosine-threshold sphere. */
  distance_to_closest_border: number | null;
  owner_snapshot_as_of_ms: number | null;
};

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** Score tapbench@ latest snapshot against a participant region in 64D. */
export function ownerScoreForRegion(
  region: {
    centroid: number[];
    cosine_threshold: number;
    embedding_model_id?: string;
    dim?: number;
  },
  ownerVector: number[] | null | undefined,
): Pick<
  TapbenchPublicRegion,
  "in_region" | "distance_to_center" | "distance_to_closest_border"
> {
  if (!ownerVector?.length) {
    return {
      in_region: null,
      distance_to_center: null,
      distance_to_closest_border: null,
    };
  }
  try {
    const score = scoreTapbenchRegionIn64D({
      region,
      targetVector: ownerVector,
    });
    const borderRadius = cosineThresholdToL2Radius(region.cosine_threshold);
    const distance_to_closest_border = score.in_region
      ? round6(Math.max(0, borderRadius - score.distance_to_center))
      : score.distance_to_closest_border;
    return {
      in_region: score.in_region,
      distance_to_center: score.distance_to_center,
      distance_to_closest_border,
    };
  } catch {
    return {
      in_region: null,
      distance_to_center: null,
      distance_to_closest_border: null,
    };
  }
}

export function publicTapbenchRegionView(row: {
  id: string;
  workspace_id: string;
  name: string;
  subject_count: number;
  cosine_threshold: number;
  mean_radius: number;
  cohort_cohesion: number;
  created_at: string;
  subjects?: Array<{ guest_user_id?: string | null }>;
  in_region?: boolean | null;
  distance_to_center?: number | null;
  distance_to_closest_border?: number | null;
  owner_snapshot_as_of_ms?: number | null;
}): TapbenchPublicRegion {
  const guest_user_ids = (row.subjects ?? [])
    .map((s) => (typeof s.guest_user_id === "string" ? s.guest_user_id : ""))
    .filter(Boolean);
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    subject_count: row.subject_count,
    cosine_threshold: row.cosine_threshold,
    mean_radius: row.mean_radius,
    cohort_cohesion: row.cohort_cohesion,
    guest_user_ids,
    created_at: row.created_at,
    in_region: row.in_region ?? null,
    distance_to_center: row.distance_to_center ?? null,
    distance_to_closest_border: row.distance_to_closest_border ?? null,
    owner_snapshot_as_of_ms: row.owner_snapshot_as_of_ms ?? null,
  };
}

export async function listTapbenchPublicRegions(
  supabase: SupabaseClient | null,
  workspaceIds: string[],
): Promise<TapbenchPublicRegion[]> {
  if (!supabase || !workspaceIds.length) return [];
  const { data, error } = await supabase
    .from("custom_verification_models")
    .select(
      "id, workspace_id, name, subject_count, cosine_threshold, mean_radius, cohort_cohesion, subjects, created_at, centroid, embedding_model_id, dim",
    )
    .in("workspace_id", workspaceIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.warn("[tapbench] list public regions failed:", error.message);
    return [];
  }
  const rows = data ?? [];
  if (!rows.length) return [];

  const ownerUserId = await resolveTapbenchOwnerUserId(supabase);
  const uniqueWorkspaceIds = [
    ...new Set(rows.map((row) => String((row as { workspace_id?: string }).workspace_id || ""))),
  ].filter(Boolean);
  const ownerByWorkspace = new Map<string, Awaited<ReturnType<typeof loadTapbenchOwnerLatestEmbedding>>>();
  if (ownerUserId) {
    await Promise.all(
      uniqueWorkspaceIds.map(async (workspaceId) => {
        ownerByWorkspace.set(
          workspaceId,
          await loadTapbenchOwnerLatestEmbedding(supabase, workspaceId, ownerUserId),
        );
      }),
    );
  }

  return rows.map((raw) => {
    const row = raw as {
      id: string;
      workspace_id: string;
      name: string;
      subject_count: number;
      cosine_threshold: number;
      mean_radius: number;
      cohort_cohesion: number;
      created_at: string;
      subjects?: Array<{ guest_user_id?: string | null }>;
      centroid?: number[];
      embedding_model_id?: string;
      dim?: number;
    };
    const owner = ownerByWorkspace.get(row.workspace_id) ?? null;
    const scored = ownerScoreForRegion(
      {
        centroid: Array.isArray(row.centroid) ? row.centroid : [],
        cosine_threshold: row.cosine_threshold,
        embedding_model_id: row.embedding_model_id,
        dim: row.dim,
      },
      owner?.vector,
    );
    return publicTapbenchRegionView({
      ...row,
      ...scored,
      owner_snapshot_as_of_ms: owner?.as_of_ms ?? null,
    });
  });
}
