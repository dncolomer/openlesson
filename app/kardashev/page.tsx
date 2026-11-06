import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { MarketingDirectoryHero } from "@/components/marketing/MarketingDirectoryHero";
import { PROJECTS_DIRECTORY } from "@/lib/marketing/projects";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/kardashev",
});

export const metadata: Metadata = {
  title: "Kardashev Research",
  description: "Kardashev Research is coming soon.",
  alternates: { canonical: "https://uncertain.systems/kardashev" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function KardashevPage() {
  return (
    <MarketingPageShell>
      <MarketingDirectoryHero
        eyebrows={["Projects"]}
        title="Kardashev Research"
        directoryEyebrow="PROJECTS"
        directoryTitle="The lineup."
        directoryLead="Community events, priming, and the other public programs."
        links={PROJECTS_DIRECTORY}
        marker="kardashev"
      >
        <p
          className="console-chip inline-flex px-3 py-1 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-300"
          data-kardashev-coming-soon
        >
          Coming soon
        </p>
        <p>
          A research program in the Projects lineup. This page is a placeholder until the first public
          materials ship.
        </p>
      </MarketingDirectoryHero>
    </MarketingPageShell>
  );
}
