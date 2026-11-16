import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { ScrollToHash } from "@/components/science/ScrollToHash";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import { SCIENCE_FEP_COPY } from "@/lib/science/free-energy-principle-copy";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";
import {
  SCIENCE_HUB_COPY,
  SCIENCE_HUB_DIRECTORY,
  SCIENCE_HUB_PATH,
} from "@/lib/science/hub";
import { standardShareSocialMetadata } from "@/lib/og/standard";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SCIENCE_HUB_PATH}`,
});

export const metadata: Metadata = {
  title: "Science",
  description: SCIENCE_HUB_COPY.description,
  alternates: { canonical: "https://uncertain.systems/science" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

function SciencePlate({
  id,
  marker,
  eyebrow,
  titleId,
  title,
  imageSrc,
  imageAlt,
  imageFirst = true,
  visualHook,
  className = "",
  children,
}: {
  id: string;
  marker: string;
  eyebrow: string;
  titleId: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  imageFirst?: boolean;
  visualHook?: string;
  className?: string;
  children: ReactNode;
}) {
  const media = (
    <div
      className="console-copy flex min-h-0 flex-col overflow-hidden lg:col-span-7"
      data-science-media=""
      {...(visualHook ? { [visualHook]: "" } : {})}
    >
      <div
        className={`relative min-h-[20rem] flex-1 ${MARKETING_MEDIA_FILL_CLASS} sm:min-h-[24rem] lg:min-h-[28rem]`}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className={`object-contain ${MARKETING_MEDIA_FILL_CLASS}`}
          sizes="(max-width: 1024px) 100vw, 60vw"
        />
      </div>
    </div>
  );
  const copy = (
    <div className="flex min-h-0 flex-col lg:col-span-5">
      <div className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</p>
        <h2
          id={titleId}
          className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
        >
          {title}
        </h2>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
          {children}
        </div>
      </div>
    </div>
  );
  return (
    <section
      id={id}
      data-science-plate={marker}
      className={`${MARKETING_SHELL} pt-3 ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
        {imageFirst ? (
          <>
            {media}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {media}
          </>
        )}
      </div>
    </section>
  );
}

export default function SciencePage() {
  return (
    <main
      className="relative min-h-screen border border-white/40 bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700 [&_section[id]]:scroll-mt-24"
      data-science-hub
    >
      <ScrollToHash />
      <PublicPageField image="/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg" />
      <PublicConsoleWash />
      <LandingNav />

      <MarketingDirectoryHero
        id="why"
        data-science-why=""
        eyebrows={[SCIENCE_HUB_COPY.eyebrowScience]}
        title={SCIENCE_HUB_COPY.title}
        directoryEyebrow={SCIENCE_HUB_COPY.directoryEyebrow}
        directoryTitle={SCIENCE_HUB_COPY.directoryTitle}
        directoryLead={SCIENCE_HUB_COPY.directoryLead}
        directoryHeadingId="science-directory-heading"
        links={SCIENCE_HUB_DIRECTORY}
        marker="science-hub"
        actions={
          <TrackedCtaLink
            href={SCIENCE_HUB_COPY.workspaceHref}
            label={SCIENCE_HUB_COPY.workspaceCta}
            location="science_hub_hero"
            page={SCIENCE_HUB_PATH}
            className={MARKETING_HERO_PRIMARY_CTA_CLASS}
          >
            {SCIENCE_HUB_COPY.workspaceCta}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
        }
      >
        {SCIENCE_HUB_COPY.lead.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </MarketingDirectoryHero>

      <SciencePlate
        id="science-free-energy"
        marker="free-energy"
        eyebrow={`01 · ${SCIENCE_FEP_COPY.eyebrow}`}
        titleId="science-fep-heading"
        title={SCIENCE_FEP_COPY.title}
        imageSrc={SCIENCE_HUB_COPY.fepImageSrc}
        imageAlt={SCIENCE_HUB_COPY.fepImageAlt}
        imageFirst={false}
      >
        <div data-science-free-energy="" id="science-epistemic-foraging">
          <p>{SCIENCE_FEP_COPY.influence}</p>
          <p>{SCIENCE_FEP_COPY.exploration}</p>
          <p className="text-zinc-300">{SCIENCE_FEP_COPY.name}</p>
          <p className="text-zinc-500">{SCIENCE_FEP_COPY.caveat}</p>
        </div>
      </SciencePlate>

      <section
        id="science-unsys-model"
        data-science-unsys-model
        className={`${MARKETING_SHELL} pt-3`}
        aria-labelledby="science-unsys-heading"
      >
        <div className="grid items-stretch gap-3 lg:grid-cols-12 lg:gap-5">
          <div className="console-copy flex min-h-0 flex-col overflow-hidden lg:col-span-7">
            <div
              className={`relative min-h-[20rem] flex-1 ${MARKETING_MEDIA_FILL_CLASS} sm:min-h-[24rem] lg:min-h-[28rem]`}
            >
              <Image
                src={SCIENCE_HUB_COPY.unsysImageSrc}
                alt={SCIENCE_HUB_COPY.unsysImageAlt}
                fill
                className={`object-contain ${MARKETING_MEDIA_FILL_CLASS}`}
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col lg:col-span-5">
            <div className="console-copy flex h-full flex-col justify-center p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                02 · {SCIENCE_HUB_COPY.unsysEyebrow}
              </p>
              <h2
                id="science-unsys-heading"
                className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl"
              >
                {SCIENCE_HUB_COPY.unsysTitle}
              </h2>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                {SCIENCE_HUB_COPY.unsysKicker}
              </p>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
                {SCIENCE_HUB_COPY.unsysP1}
              </p>
              <p className="mt-3 text-base leading-relaxed text-zinc-400 sm:text-[15px]">
                {SCIENCE_HUB_COPY.unsysP2}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-200">
                {SCIENCE_HUB_COPY.unsysCallout}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {SCIENCE_HUB_COPY.unsysP3}
              </p>
              <Link
                href={SCIENCE_LEARNING_MODEL_PATH}
                data-science-learning-model-link
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
              >
                {SCIENCE_HUB_COPY.unsysExplore}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SciencePlate
        id="science-embedding"
        marker="embedding"
        eyebrow={`03 · ${SCIENCE_HUB_COPY.embeddingEyebrow}`}
        titleId="science-embedding-heading"
        title={SCIENCE_HUB_COPY.embeddingTitle}
        imageSrc={SCIENCE_HUB_COPY.embeddingImageSrc}
        imageAlt={SCIENCE_HUB_COPY.embeddingImageAlt}
        className="pb-12 sm:pb-14"
      >
        <div data-science-embedding="">
          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
            {SCIENCE_HUB_COPY.embeddingKicker}
          </p>
          <p>{SCIENCE_HUB_COPY.embeddingP1}</p>
          <p>{SCIENCE_HUB_COPY.embeddingP2}</p>
          <p className="text-zinc-200">{SCIENCE_HUB_COPY.embeddingCallout}</p>
        </div>
      </SciencePlate>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
