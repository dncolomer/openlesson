import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { AyclLandingClient } from "@/components/AyclLandingClient";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AYCL_LANDING_WORKSPACE_SELECT,
  ayclLandingPath,
  assembleAyclLandingSummary,
} from "@/lib/aycl-landing";
import { aestheticImageForId } from "@/lib/aesthetics";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const BACKGROUND_IMAGE = aestheticImageForId("all-you-can-learn-landing", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
]);

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

async function loadLanding(workspaceId: string) {
  const id = String(workspaceId || "").trim();
  if (!id) return null;
  const supabase = createAdminClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select(AYCL_LANDING_WORKSPACE_SELECT)
    .eq("id", id)
    .eq("is_all_you_can_learn", true)
    .maybeSingle();
  if (!workspace) return null;

  const { data: blocks } = await supabase
    .from("blocks")
    .select(
      "id, title, description, status, is_start, next_block_ids, position_x, position_y, span_w, span_h, shape_cells",
    )
    .eq("workspace_id", id)
    .limit(200);

  return assembleAyclLandingSummary({
    workspace,
    blocks: blocks || [],
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { workspaceId } = await params;
  const landing = await loadLanding(workspaceId);
  if (!landing) {
    return {
      title: "All-You-Can-Learn",
      description: "Curated lifetime learning environments.",
    };
  }
  const path = ayclLandingPath(landing.workspaceId);
  const description =
    landing.summary.slice(0, 160) ||
    `Lifetime access to ${landing.title} on Uncertain Systems.`;
  // Page SEO stays listing-specific; social share is the unsys standard.
  const social = standardShareSocialMetadata({
    url: `https://uncertain.systems${path}`,
  });
  return {
    title: `${landing.title} · All-You-Can-Learn`,
    description,
    alternates: {
      canonical: `https://uncertain.systems${path}`,
    },
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function AyclWorkspaceLandingPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const landing = await loadLanding(workspaceId);
  if (!landing) notFound();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/82" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_31%)]" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <AyclLandingClient landing={landing} />
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
