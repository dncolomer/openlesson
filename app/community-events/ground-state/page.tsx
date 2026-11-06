import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { MarketingDirectoryHero } from "@/components/marketing/MarketingDirectoryHero";
import { AYCL_HACKATHONS } from "@/lib/aycl-landing";
import { COMMUNITY_EVENTS_DIRECTORY } from "@/lib/marketing/projects";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_MEDIA_STAGE_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const EVENT = AYCL_HACKATHONS.find((event) => event.id === "ground-state");

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/community-events/ground-state",
});

export const metadata: Metadata = {
  title: "Thermosynthesis · Community Events",
  description: "To be Announced soon",
  alternates: {
    canonical: "https://uncertain.systems/community-events/ground-state",
  },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function GroundStateEventPage() {
  const image = EVENT?.image ?? "/hackathons/ground-state-hero.jpg";
  return (
    <MarketingPageShell image={image}>
      <div data-ground-state-page>
        <nav aria-label="Breadcrumb" className={`${MARKETING_SHELL} pt-5 text-xs text-zinc-500 sm:pt-6`}>
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li>
              <Link href="/community-events" className="transition hover:text-white">
                Community Events
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li className="text-zinc-400">Thermosynthesis</li>
          </ol>
        </nav>

        <MarketingDirectoryHero
          eyebrows={[EVENT?.kind ?? "3 Day Event"]}
          title={EVENT?.title ?? "Thermosynthesis"}
          directoryEyebrow="EVENTS"
          directoryTitle="In the lineup."
          links={COMMUNITY_EVENTS_DIRECTORY}
          marker="ground-state"
        >
          <p>To be Announced soon</p>
        </MarketingDirectoryHero>

        <section className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}>
          <div className="console-copy overflow-hidden">
            <div className={`relative ${MARKETING_MEDIA_STAGE_CLASS} ${MARKETING_MEDIA_FILL_CLASS}`}>
              <Image
                src={image}
                alt=""
                fill
                unoptimized
                className="object-cover object-center"
                sizes="100vw"
              />
            </div>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
