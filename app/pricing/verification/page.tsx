import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { ENTERPRISE_SETUP_EMAIL, VERIFICATION_PRICING_PATH } from "@/lib/marketing/paths";
import { VERIFICATION_PRICING_COPY } from "@/lib/pricing/verification-copy";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${VERIFICATION_PRICING_PATH}`,
});

export const metadata: Metadata = {
  title: "Knowledge Verification pricing",
  description: VERIFICATION_PRICING_COPY.lead,
  alternates: { canonical: `https://uncertain.systems${VERIFICATION_PRICING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function VerificationPricingPage() {
  const { deepProject, lightWeight } = VERIFICATION_PRICING_COPY;

  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="mb-8 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          {VERIFICATION_PRICING_COPY.eyebrow}
        </div>
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
          Verification pricing
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {VERIFICATION_PRICING_COPY.lead}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article
            data-testid="verification-deep-project"
            className="border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
              {deepProject.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-medium text-white">Deep Project style assessment</h2>
            <p className="mt-4 text-4xl font-medium tracking-[-1px] text-white">$10 per assessment</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">{deepProject.difference}</p>
          </article>

          <article
            data-testid="verification-light-weight"
            className="border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
              {lightWeight.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-medium text-white">Light weight verification</h2>
            <p className="mt-4 text-4xl font-medium tracking-[-1px] text-white">$1 per run</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">{lightWeight.difference}</p>
          </article>
        </div>

        <div
          data-testid="verification-contact"
          className="mt-10 border border-zinc-700 bg-zinc-950/80 p-5 sm:p-6"
        >
          <h2 className="text-xl font-medium text-white">Get set-up</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Public registration is for the Learning Harness only. For Knowledge Verification, contact{" "}
            <a
              href={VERIFICATION_PRICING_COPY.contactMailto}
              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white"
            >
              daniel@uncertain.systems
            </a>{" "}
            to get set-up.
          </p>
          <a
            href={VERIFICATION_PRICING_COPY.contactMailto}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Contact {ENTERPRISE_SETUP_EMAIL} to get set-up
          </a>
        </div>
      </section>
    </MarketingPageShell>
  );
}
