import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { HarnessScreenshotCarousel } from "@/components/marketing/HarnessScreenshotCarousel";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";
import { LEARNING_HARNESS_PATH } from "@/lib/marketing/paths";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${LEARNING_HARNESS_PATH}`,
});

export const metadata: Metadata = {
  title: "Learning Harness",
  description: HARNESS_PRODUCT_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${LEARNING_HARNESS_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function LearningHarnessPage() {
  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          {HARNESS_PRODUCT_COPY.eyebrow}
        </div>
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          A Learning Harness for humans
        </h1>
        <div className="mt-7 max-w-3xl space-y-4 text-lg leading-relaxed text-zinc-400">
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
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCtaLink
            href={HARNESS_PRODUCT_COPY.workspaceHref}
            label={HARNESS_PRODUCT_COPY.workspaceCta}
            location="harness_hero"
            page={LEARNING_HARNESS_PATH}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {HARNESS_PRODUCT_COPY.workspaceCta}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
          <Link
            href={HARNESS_PRODUCT_COPY.pricingHref}
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {HARNESS_PRODUCT_COPY.pricingCta}
          </Link>
        </div>
      </section>

      <section
        className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-2 sm:pb-10"
        data-harness-screenshots
      >
        <HarnessScreenshotCarousel screenshots={HARNESS_PRODUCT_COPY.screenshots} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <ul className="grid gap-4 md:grid-cols-3" data-harness-points>
          {HARNESS_PRODUCT_COPY.points.map((point) => (
            <li
              key={point.title}
              className="flex min-h-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70"
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={point.image}
                  alt={point.imageAlt}
                  fill
                  className="object-cover grayscale"
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
                  <a
                    href={point.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                  >
                    {point.linkLabel}
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="all-you-can-learn"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-16 sm:pb-20"
        data-harness-aycl
      >
        <SectionHeading
          eyebrow={HARNESS_PRODUCT_COPY.ayclEyebrow}
          title={HARNESS_PRODUCT_COPY.ayclTitle}
        />
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {HARNESS_PRODUCT_COPY.ayclBody}
        </p>
        <Link
          href={HARNESS_PRODUCT_COPY.ayclHref}
          data-testid="harness-aycl-link"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          {HARNESS_PRODUCT_COPY.ayclCta}
          <span className="ml-2 font-normal text-zinc-600">All-You-Can-Learn</span>
          <ArrowRight className="ml-2" size={16} />
        </Link>
      </section>
    </MarketingPageShell>
  );
}
