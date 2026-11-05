import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrainPrimingWaitlistForm } from "@/components/marketing/BrainPrimingWaitlistForm";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import {
  BRAIN_PRIMING_COPY,
  BRAIN_PRIMING_PATH,
} from "@/lib/marketing/brain-priming";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${BRAIN_PRIMING_PATH}`,
});

export const metadata: Metadata = {
  title: "Brain Priming Protocol",
  description: BRAIN_PRIMING_COPY.h1,
  alternates: { canonical: `https://uncertain.systems${BRAIN_PRIMING_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function BrainPrimingPage() {
  const copy = BRAIN_PRIMING_COPY;
  return (
    <MarketingPageShell>
      <div data-brain-priming-page>
        <section
          className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12"
          data-brain-priming-hero
        >
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="console-chip inline-block rounded-none px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
              {copy.pill}
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {copy.title}
          </p>
          <h1 className="mt-4 max-w-5xl text-4xl font-medium leading-[1.08] tracking-[-2px] text-white sm:text-5xl lg:text-[56px]">
            {copy.h1}
          </h1>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>{copy.p1}</p>
            <p className="text-zinc-500 sm:text-base">{copy.p2}</p>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={copy.ctaStartHref}
              className="inline-flex min-h-12 items-center justify-center rounded-none bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
              data-brain-priming-start
            >
              {copy.ctaStart}
              <ArrowRight className="ml-2" size={16} />
            </Link>
            <a
              href={copy.ctaSecondaryHref}
              className="console-button inline-flex min-h-12 items-center justify-center rounded-none px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/80 hover:text-white"
            >
              {copy.ctaSecondary}
            </a>
          </div>
        </section>

        <section
          className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12"
          data-brain-priming-domains
        >
          <SectionHeading eyebrow={copy.domains.eyebrow} title={copy.domains.title} />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {copy.domains.lead}
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.domains.items.map((item) => (
              <li key={item.id} className="console-copy p-5 sm:p-6">
                <h3 className="text-xl font-medium tracking-[-0.6px] text-white">{item.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="how"
          className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12"
          data-brain-priming-flows
        >
          <SectionHeading eyebrow={copy.loop.eyebrow} title={copy.loop.title} />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {copy.thesis}
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.loop.items.map((item) => (
              <li key={item.eyebrow} className="console-copy p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {item.eyebrow}
                </p>
                <h3 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">
                  {item.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12">
          <SectionHeading eyebrow={copy.spine.eyebrow} title={copy.spine.title} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {copy.spine.items.map((item) => (
              <li key={item.eyebrow} className="console-copy p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {item.eyebrow}
                </p>
                <h3 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">
                  {item.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12"
          data-brain-priming-plans
        >
          <SectionHeading eyebrow={copy.plans.eyebrow} title={copy.plans.title} />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {copy.plans.lead}
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {copy.plans.items.map((item) => (
              <li key={item.id} className="console-copy p-6 sm:p-8">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {item.id === "3" ? "12 WEEKS" : "24 WEEKS"}
                </p>
                <h3 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white">
                  {item.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12">
          <SectionHeading eyebrow={copy.layers.eyebrow} title={copy.layers.title} />
          <div className="mt-8 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {copy.layers.items.map((item) => (
              <article
                key={item.name}
                className="console-copy flex min-h-0 min-w-0 flex-col overflow-hidden"
              >
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-3 text-[1.5rem] font-medium leading-[1.08] tracking-[-0.8px] text-white">
                    {item.name}
                  </h2>
                  <p className="mt-5 flex-1 text-[15px] leading-relaxed text-zinc-400">
                    {item.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="formula"
          className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12"
          data-brain-priming-formula
        >
          <SectionHeading eyebrow="SUPPLEMENT" title={copy.ingredientsTitle} />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {copy.ingredientsLead}
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {copy.ingredients.map((item) => (
              <li key={item.name} className="console-copy p-5">
                <h3 className="text-lg font-medium text-white">{item.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.role}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="relative z-10 mx-auto max-w-7xl px-6 pb-10 pt-6 sm:pb-12"
          data-brain-priming-blood
        >
          <SectionHeading eyebrow="YOU BRING" title={copy.bloodTitle} />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {copy.bloodLead}
          </p>
        </section>

        <section
          id="join"
          className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-6 sm:pb-20"
        >
          <div className="console-copy w-full px-6 py-10 sm:px-10 sm:py-12" data-brain-priming-cta>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {copy.waitlist.pill}
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
              {copy.waitlist.h1}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
              {copy.waitlist.lead}
            </p>
            <div className="mt-8 max-w-xl" data-brain-priming-join>
              <BrainPrimingWaitlistForm />
            </div>
            <p
              className="mt-8 max-w-3xl text-xs leading-relaxed text-zinc-600"
              data-brain-priming-disclaimer
            >
              {copy.disclaimer}
            </p>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
