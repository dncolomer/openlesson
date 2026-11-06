import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrainPrimingWaitlistForm } from "@/components/marketing/BrainPrimingWaitlistForm";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MARKETING_HERO_SECONDARY_CTA_CLASS,
  MarketingDirectoryHero,
} from "@/components/marketing/MarketingDirectoryHero";
import {
  BRAIN_PRIMING_COPY,
  BRAIN_PRIMING_DIRECTORY,
  BRAIN_PRIMING_PATH,
} from "@/lib/marketing/brain-priming";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
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
        <MarketingDirectoryHero
          data-brain-priming-hero
          eyebrows={[copy.pill]}
          title={copy.h1}
          directoryEyebrow={copy.directoryEyebrow}
          directoryTitle={copy.directoryTitle}
          directoryLead={copy.directoryLead}
          links={BRAIN_PRIMING_DIRECTORY}
          marker="brain-priming"
          actions={
            <>
              <Link
                href={copy.ctaStartHref}
                className={MARKETING_HERO_PRIMARY_CTA_CLASS}
                data-brain-priming-start
              >
                {copy.ctaStart}
                <ArrowRight className="ml-2" size={16} />
              </Link>
              <a href={copy.ctaSecondaryHref} className={MARKETING_HERO_SECONDARY_CTA_CLASS}>
                {copy.ctaSecondary}
              </a>
            </>
          }
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{copy.title}</p>
          <p>{copy.p1}</p>
          <p>{copy.p2}</p>
        </MarketingDirectoryHero>

        <section className={`${MARKETING_SHELL} pt-3`}>
          <div className="console-copy overflow-hidden">
            <div className="grid lg:grid-cols-12">
              <div className="p-5 sm:p-6 lg:col-span-5 lg:p-7" data-brain-priming-domains>
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  01 · {copy.domains.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
                  {copy.domains.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">{copy.domains.lead}</p>
                <ul className="mt-6">
                  {copy.domains.items.map((item, index) => (
                    <li
                      key={item.id}
                      className={`py-4 ${index > 0 ? "border-t border-zinc-800/90" : ""}`}
                    >
                      <h3 className="text-lg font-medium tracking-[-0.4px] text-white">{item.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                id="how"
                className="border-t border-zinc-800/90 p-5 sm:p-6 lg:col-span-7 lg:border-t-0 lg:border-l lg:p-7"
                data-brain-priming-flows
              >
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  02 · {copy.loop.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
                  {copy.loop.title}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">{copy.thesis}</p>
                <ul className="mt-6 grid gap-0 sm:grid-cols-3 sm:divide-x sm:divide-zinc-800/90">
                  {copy.loop.items.map((item, index) => (
                    <li
                      key={item.eyebrow}
                      className={`py-4 sm:px-5 sm:py-0 first:sm:pl-0 last:sm:pr-0 ${
                        index > 0 ? "border-t border-zinc-800/90 sm:border-t-0" : ""
                      }`}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                        {item.eyebrow}
                      </p>
                      <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">{item.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={`${MARKETING_SHELL} pt-3`}>
          <div className="console-copy overflow-hidden">
            <div className="border-b border-zinc-800/90 p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                03 · {copy.spine.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
                {copy.spine.title}
              </h2>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
              {copy.spine.items.map((item, index) => (
                <li
                  key={item.eyebrow}
                  className={`p-5 sm:p-6 ${
                    index > 0 ? "border-t border-zinc-800/90 sm:border-t-0 sm:border-l" : ""
                  } ${index === 2 ? "sm:border-t lg:border-t-0" : ""} ${
                    index >= 2 ? "sm:border-t lg:border-t-0" : ""
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-3 text-lg font-medium tracking-[-0.4px] text-white">{item.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                </li>
              ))}
            </ul>
            <div
              className="grid border-t border-zinc-800/90 md:grid-cols-2"
              data-brain-priming-plans
            >
              <div className="p-5 sm:p-6 lg:p-7">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {copy.plans.eyebrow}
                </p>
                <h3 className="mt-3 text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
                  {copy.plans.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{copy.plans.lead}</p>
              </div>
              <ul className="grid sm:grid-cols-2">
                {copy.plans.items.map((item, index) => (
                  <li
                    key={item.id}
                    className={`p-5 sm:p-6 ${
                      index > 0 ? "border-t border-zinc-800/90 sm:border-t-0 sm:border-l" : "border-t border-zinc-800/90 md:border-t-0 md:border-l"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                      {item.id === "3" ? "12 WEEKS" : "24 WEEKS"}
                    </p>
                    <h3 className="mt-3 text-xl font-medium tracking-[-0.5px] text-white">{item.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={`${MARKETING_SHELL} pt-3`}>
          <div className="console-copy overflow-hidden">
            <div className="border-b border-zinc-800/90 p-5 sm:p-6 lg:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                04 · {copy.layers.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
                {copy.layers.title}
              </h2>
            </div>
            <div className="grid lg:grid-cols-3">
              {copy.layers.items.map((item, index) => (
                <article
                  key={item.name}
                  className={`flex min-h-0 flex-col ${
                    index > 0 ? "border-t border-zinc-800/90 lg:border-t-0 lg:border-l" : ""
                  }`}
                >
                  <div className="relative aspect-[16/10] w-full">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                      {item.eyebrow}
                    </p>
                    <h2 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white sm:text-xl">
                      {item.name}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="formula" className={`${MARKETING_SHELL} pt-3`} data-brain-priming-formula>
          <div className="console-copy overflow-hidden">
            <div className="grid lg:grid-cols-12">
              <div className="p-5 sm:p-6 lg:col-span-4 lg:p-7">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  05 · SUPPLEMENT
                </p>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
                  {copy.ingredientsTitle}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {copy.ingredientsLead}
                </p>
                <div className="mt-8" data-brain-priming-blood>
                  <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">YOU BRING</p>
                  <h3 className="mt-3 text-lg font-medium tracking-[-0.4px] text-white">{copy.bloodTitle}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{copy.bloodLead}</p>
                </div>
              </div>
              <ul className="grid border-t border-zinc-800/90 sm:grid-cols-2 lg:col-span-8 lg:border-t-0 lg:border-l">
                {copy.ingredients.map((item, index) => (
                  <li
                    key={item.name}
                    className={`p-5 sm:p-6 ${index > 0 ? "border-t border-zinc-800/90 sm:border-t-0" : ""} ${
                      index % 2 === 1 ? "sm:border-l sm:border-zinc-800/90" : ""
                    } ${index >= 2 ? "sm:border-t sm:border-zinc-800/90" : ""}`}
                  >
                    <h3 className="text-base font-medium text-white">{item.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.role}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="join" className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`}>
          <div className="console-copy w-full px-6 py-10 sm:px-10 sm:py-12" data-brain-priming-cta>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
              {copy.waitlist.pill}
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
              {copy.waitlist.h1}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400">{copy.waitlist.lead}</p>
            <div className="mt-8" data-brain-priming-join>
              <BrainPrimingWaitlistForm />
            </div>
            <p
              className="mt-8 text-xs leading-relaxed text-zinc-600"
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
