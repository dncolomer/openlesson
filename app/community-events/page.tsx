import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { MarketingDirectoryHero } from "@/components/marketing/MarketingDirectoryHero";
import { AYCL_HACKATHONS } from "@/lib/aycl-landing";
import { aestheticImageForId } from "@/lib/aesthetics";
import {
  COMMUNITY_EVENTS_COPY,
  COMMUNITY_EVENTS_DIRECTORY,
} from "@/lib/marketing/projects";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_MEDIA_STAGE_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/community-events",
});

export const metadata: Metadata = {
  title: "Community Events · Projects & Community",
  description:
    "In-person and online community events where curious people learn frontier knowledge by doing — lectures, mentors, teams, and demos.",
  alternates: {
    canonical: "https://uncertain.systems/community-events",
  },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = aestheticImageForId("hackathons", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
]);

export default function HackathonsPage() {
  return (
    <MarketingPageShell image={BACKGROUND_IMAGE}>
      <div data-hackathons-page>
        <MarketingDirectoryHero
          eyebrows={[COMMUNITY_EVENTS_COPY.eyebrow]}
          title={COMMUNITY_EVENTS_COPY.title}
          directoryEyebrow={COMMUNITY_EVENTS_COPY.directoryEyebrow}
          directoryTitle={COMMUNITY_EVENTS_COPY.directoryTitle}
          directoryLead={COMMUNITY_EVENTS_COPY.directoryLead}
          links={COMMUNITY_EVENTS_DIRECTORY}
          marker="community-events"
        >
          <p>{COMMUNITY_EVENTS_COPY.lead}</p>
        </MarketingDirectoryHero>

        <section className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`} data-hackathons-grid>
          <div className="console-copy overflow-hidden">
            {AYCL_HACKATHONS.map((hackathon, index) => (
              <Link
                key={hackathon.id}
                href={hackathon.href}
                className={`group grid lg:grid-cols-12 ${
                  index > 0 ? "border-t border-zinc-800/90" : ""
                }`}
                data-hackathon-card={hackathon.id}
              >
                <div
                  className={`relative ${MARKETING_MEDIA_STAGE_CLASS} ${MARKETING_MEDIA_FILL_CLASS} lg:col-span-7`}
                >
                  <Image
                    src={hackathon.image}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                  />
                  <span className="console-chip absolute left-4 top-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-300">
                    {hackathon.status}
                  </span>
                </div>
                <div className="flex flex-col justify-center border-t border-zinc-800/90 p-5 sm:p-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="console-chip px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90">
                      {hackathon.kind}
                    </span>
                    {hackathon.host ? (
                      <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                        {hackathon.host}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 text-xl font-medium leading-tight tracking-[-0.5px] text-white group-hover:text-zinc-100 sm:text-2xl">
                    {hackathon.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{hackathon.description}</p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div className="space-y-1 text-xs text-zinc-500">
                      {hackathon.date ? <p>{hackathon.date}</p> : null}
                      {hackathon.location ? <p>{hackathon.location}</p> : null}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                      View event
                      <ArrowRight
                        size={14}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
