import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { HarnessScreenshotCarousel } from "@/components/marketing/HarnessScreenshotCarousel";
import { ThesisDirectory } from "@/components/science/ThesisDirectory";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import { LEARNING_HARNESS_PATH } from "@/lib/marketing/paths";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${LEARNING_HARNESS_PATH}`,
});

export const metadata: Metadata = {
  title: "Problem Solving Harness",
  description: HARNESS_PRODUCT_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${LEARNING_HARNESS_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function AcquisitionPage() {
  return (
    <MarketingPageShell>
      <section
        className={`${MARKETING_SHELL} pt-5 pb-3 sm:pt-6`}
        data-acquisition-hero
      >
        <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
                {HARNESS_PRODUCT_COPY.eyebrow}
              </div>
            </div>
            <h1 className="max-w-4xl text-4xl font-medium leading-[1.03] tracking-[-2px] text-white sm:text-5xl lg:text-6xl">
              {HARNESS_PRODUCT_COPY.title}
            </h1>
            <div className="mt-4 max-w-2xl space-y-3 text-base leading-relaxed text-zinc-400 sm:text-lg">
              <p>{HARNESS_PRODUCT_COPY.lead}</p>
              <p>{HARNESS_PRODUCT_COPY.body}</p>
              <p data-harness-epistemic-foraging>
                That policy is{" "}
                <Link
                  href={HARNESS_PRODUCT_COPY.foragingHref}
                  className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  epistemic foraging
                </Link>
                : learning as reducing uncertainty, rather than optimizing for tests and practice repetition.
              </p>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="console-copy p-5 sm:p-6">
              <ThesisDirectory
                links={HARNESS_PRODUCT_COPY.thesisLinks}
                marker="harness"
                columns="grid-cols-1"
              />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <TrackedCtaLink
                  href={HARNESS_PRODUCT_COPY.workspaceHref}
                  label={HARNESS_PRODUCT_COPY.workspaceCta}
                  location="harness_hero"
                  page={LEARNING_HARNESS_PATH}
                  className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  {HARNESS_PRODUCT_COPY.workspaceCta}
                  <ArrowRight className="ml-2" size={16} />
                </TrackedCtaLink>
                <Link
                  href={HARNESS_PRODUCT_COPY.pricingHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-none border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                >
                  {HARNESS_PRODUCT_COPY.pricingCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`${MARKETING_SHELL} pt-3`}
        data-harness-screenshots
      >
        <HarnessScreenshotCarousel screenshots={HARNESS_PRODUCT_COPY.screenshots} />
      </section>

      <section className={`${MARKETING_SHELL} pt-3`}>
        <ul className="grid gap-3 md:grid-cols-3" data-harness-points>
          {HARNESS_PRODUCT_COPY.points.map((point) => (
            <li
              key={point.title}
              className="console-copy flex min-h-0 flex-col overflow-hidden"
            >
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={point.image}
                  alt={point.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 384px"
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {point.eyebrow}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">{point.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{point.body}</p>
                {point.href && point.linkLabel ? (
                  point.href.startsWith("/") ? (
                    <Link
                      href={point.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                    >
                      {point.linkLabel}
                      <ArrowRight size={13} />
                    </Link>
                  ) : (
                    <a
                      href={point.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                    >
                      {point.linkLabel}
                      <ExternalLink size={13} />
                    </a>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="all-you-can-learn"
        className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}
        data-harness-aycl
      >
        <div className="console-copy grid items-center gap-5 p-5 sm:p-6 lg:grid-cols-12 lg:gap-8 lg:p-7">
          <div className="lg:col-span-8">
            <SectionHeading
              eyebrow={HARNESS_PRODUCT_COPY.ayclEyebrow}
              title={HARNESS_PRODUCT_COPY.ayclTitle}
            />
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">
              {HARNESS_PRODUCT_COPY.ayclBody}
            </p>
          </div>
          <div className="lg:col-span-4">
            <Link
              href={HARNESS_PRODUCT_COPY.ayclHref}
              data-testid="harness-aycl-link"
              className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              {HARNESS_PRODUCT_COPY.ayclCta}
              <span className="ml-2 font-normal text-zinc-600">All-You-Can-Learn</span>
              <ArrowRight className="ml-2" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
