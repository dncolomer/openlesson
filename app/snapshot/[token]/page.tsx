import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SnapshotLandingMissing,
  SnapshotLandingView,
} from "@/components/SnapshotLandingView";
import {
  createSupabaseSnapshotShareBackend,
  lookupSnapshotShare,
  normalizeSnapshotShareToken,
} from "@/lib/pow-api/snapshot-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token: rawToken } = await params;
  const token = normalizeSnapshotShareToken(rawToken);
  if (!token) return { title: "Snapshot not found" };

  try {
    const supabase = createAdminClient();
    const landing = await lookupSnapshotShare(
      createSupabaseSnapshotShareBackend(supabase),
      token,
    );
    if (!landing) return { title: "Snapshot not found" };
    return {
      title: "Learning snapshot",
      description:
        landing.summary.text ||
        "Public learning snapshot — scores, profile, goals, and next steps.",
    };
  } catch {
    return { title: "Learning snapshot" };
  }
}

/**
 * Public Snapshot landing at `/snapshot/{token}` — unauthenticated.
 * Lookup is token-keyed via the admin client; unpublished snapshots stay private.
 */
export default async function SnapshotSharePage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = normalizeSnapshotShareToken(rawToken);
  if (!token) return <SnapshotLandingMissing />;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return <SnapshotLandingMissing />;
  }

  const landing = await lookupSnapshotShare(
    createSupabaseSnapshotShareBackend(supabase),
    token,
  );
  if (!landing) return <SnapshotLandingMissing />;

  return <SnapshotLandingView view={landing} />;
}
