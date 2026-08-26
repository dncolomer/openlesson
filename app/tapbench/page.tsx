import type { Metadata } from "next";
import { TapbenchLanding } from "@/components/TapbenchLanding";
import { loadTapbenchLandingData } from "@/lib/tapbench/landing-data";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/tapbench",
});

export const metadata: Metadata = {
  title: "TAPBench",
  description: "TAPBench.",
  alternates: { canonical: "https://uncertain.systems/tapbench" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export const dynamic = "force-dynamic";

/**
 * Public TAPBench Benchmark LP. Session resolve lives at /tapbench/[token].
 */
export default async function TapbenchProjectLandingPage() {
  const { tasks, regions } = await loadTapbenchLandingData();
  return <TapbenchLanding initialTasks={tasks} initialRegions={regions} />;
}
