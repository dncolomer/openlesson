import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { MAPPING_PRICING_PATH } from "@/lib/marketing/paths";
import { MAPPING_PRICING_COPY } from "@/lib/pricing/mapping-copy";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${MAPPING_PRICING_PATH}`,
});

export const metadata: Metadata = {
  title: "Knowledge Mapping pricing",
  description: MAPPING_PRICING_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${MAPPING_PRICING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function MappingPricingPage() {
  const { quote } = MAPPING_PRICING_COPY;

  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="console-chip mb-8 inline-block px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          {MAPPING_PRICING_COPY.eyebrow}
        </div>
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
          {MAPPING_PRICING_COPY.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {MAPPING_PRICING_COPY.lead}
        </p>

        <article
          data-testid="mapping-data-point"
          className="console-copy mt-10 w-full p-5 sm:p-8"
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
            {quote.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-medium text-white">{quote.name}</h2>
          <p className="mt-4 text-4xl font-medium tracking-[-1px] text-white">{quote.price}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">{quote.body}</p>
        </article>

        <div
          data-testid="mapping-contact"
          className="console-copy mt-10 w-full p-5 sm:p-8"
        >
          <h2 className="text-xl font-medium text-white">{MAPPING_PRICING_COPY.contactTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Contact{" "}
            <a
              href={MAPPING_PRICING_COPY.contactMailto}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white"
            >
              {MAPPING_PRICING_COPY.contactEmail}
            </a>{" "}
            for more details and custom packages.
          </p>
          <a
            href={MAPPING_PRICING_COPY.contactMailto}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {MAPPING_PRICING_COPY.contactCta}
          </a>
        </div>
      </section>
    </MarketingPageShell>
  );
}
