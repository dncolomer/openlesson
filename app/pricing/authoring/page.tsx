import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { AUTHORING_PRICING_PATH } from "@/lib/marketing/paths";
import { AUTHORING_PRICING_COPY } from "@/lib/pricing/authoring-copy";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${AUTHORING_PRICING_PATH}`,
});

export const metadata: Metadata = {
  title: "Learning Experience Authoring pricing",
  description: AUTHORING_PRICING_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${AUTHORING_PRICING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function AuthoringPricingPage() {
  const { package: coursePackage } = AUTHORING_PRICING_COPY;

  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="mb-8 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          {AUTHORING_PRICING_COPY.eyebrow}
        </div>
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
          {AUTHORING_PRICING_COPY.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {AUTHORING_PRICING_COPY.lead}
        </p>

        <article
          data-testid="authoring-40h-package"
          className="mt-10 w-full border border-zinc-800 bg-zinc-950/80 p-5 sm:p-8"
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
            {coursePackage.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-medium text-white">{coursePackage.name}</h2>
          <p className="mt-4 text-4xl font-medium tracking-[-1px] text-white">{coursePackage.price}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">{coursePackage.body}</p>
        </article>

        <div
          data-testid="authoring-contact"
          className="mt-10 w-full border border-zinc-700 bg-zinc-950/80 p-5 sm:p-8"
        >
          <h2 className="text-xl font-medium text-white">{AUTHORING_PRICING_COPY.contactTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Contact{" "}
            <a
              href={AUTHORING_PRICING_COPY.contactMailto}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white"
            >
              {AUTHORING_PRICING_COPY.contactEmail}
            </a>{" "}
            for more details and custom packages.
          </p>
          <a
            href={AUTHORING_PRICING_COPY.contactMailto}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {AUTHORING_PRICING_COPY.contactCta}
          </a>
        </div>
      </section>
    </MarketingPageShell>
  );
}
