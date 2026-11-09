"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/MarketingChrome";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import {
  MARKETING_HERO_PRIMARY_CTA_CLASS,
  MARKETING_HERO_SECONDARY_CTA_CLASS,
} from "@/components/marketing/MarketingDirectoryHero";
import {
  PublicConsoleWash,
  PublicPageField,
  PUBLIC_FIELD_STILLS,
} from "@/components/ui/console-frame";
import {
  LANDING_HERO_COPY,
  LANDING_HERO_STILL,
  LANDING_HERO_STILL_ALT,
  LANDING_USES,
} from "@/lib/marketing/landing-variants";
import { MARKETING_MEDIA_FILL_CLASS, MARKETING_SHELL } from "@/lib/marketing/shell";
import { PLATFORM_CORE, PLATFORM_OUTCOMES, PLATFORM_PROOF } from "@/lib/marketing/platform";

/** Field color sampled from the hero3 still surround. */
export const LANDING_FIELD_BG_CLASS = "bg-[#0a172d]";

export function LandingWash() {
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    setBgImage(PUBLIC_FIELD_STILLS[Math.floor(Math.random() * PUBLIC_FIELD_STILLS.length)]);
  }, []);

  return (
    <>
      <PublicPageField image={bgImage} />
      <PublicConsoleWash />
    </>
  );
}

function UseLink({
  href,
  label,
  location,
}: {
  href: string;
  label: string;
  location: string;
}) {
  return (
    <TrackedCtaLink
      href={href}
      label={label}
      location={location}
      page="/"
      className="mt-3 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
    >
      {label}
      <ArrowRight className="ml-2" size={14} />
    </TrackedCtaLink>
  );
}

/** Combined hero: stacked still + copy on mobile, overlaid from md up. */
export function LandingHeroEditorial({
  location = "landing_layers",
}: {
  location?: string;
}) {
  const copy = LANDING_HERO_COPY;
  return (
    <section className={`${MARKETING_SHELL} pt-4 pb-0 sm:pt-5`} data-home-hero data-home-hero-editorial>
      <div className="console-copy overflow-hidden" data-home-layers>
        <div
          className={`relative w-full md:aspect-video md:max-h-[calc(100svh-5.5rem)] ${LANDING_FIELD_BG_CLASS}`}
        >
          <div className="relative aspect-video w-full md:absolute md:inset-0 md:aspect-auto">
            <Image
              src={LANDING_HERO_STILL}
              alt={LANDING_HERO_STILL_ALT}
              fill
              unoptimized
              className="object-cover object-center"
              sizes="100vw"
              priority
            />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black via-black/70 via-[38%] to-black/10 md:block" />
          </div>
          <div className="relative z-10 border-t border-zinc-800/90 px-5 py-5 text-left sm:px-8 sm:py-6 md:absolute md:inset-0 md:flex md:h-full md:flex-col md:items-start md:justify-end md:border-t-0 md:px-8 md:pb-8 md:pt-16 xl:px-10 xl:pb-10">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500 md:text-zinc-300">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 max-w-3xl text-[2rem] font-medium leading-[1.05] tracking-[-1.4px] text-white sm:text-5xl lg:text-6xl">
              {copy.h1}
            </h1>
            <div className="mt-3 max-w-3xl space-y-3 text-[15px] leading-relaxed text-zinc-400 sm:mt-4 sm:text-base md:text-zinc-200">
              <p>{copy.p1}</p>
              <p>{copy.p2}</p>
            </div>
          </div>
        </div>
        <ol className="grid border-t border-zinc-800/90 md:grid-cols-3">
          {LANDING_USES.map((product, index) => (
            <li
              key={product.href}
              className={`flex flex-col px-5 py-5 sm:px-6 sm:py-6 ${
                index > 0 ? "border-t border-zinc-800/90 md:border-t-0 md:border-l" : ""
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {String(index + 1).padStart(2, "0")} · {product.eyebrow}
              </p>
              <h2 className="mt-1.5 text-lg font-medium tracking-[-0.5px] text-white sm:text-xl">
                {product.name}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-300 sm:text-[15px]">{product.dek}</p>
              <UseLink href={product.href} label={product.cta} location={location} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingCoreSection() {
  return (
    <section className={`${MARKETING_SHELL} pt-3`} data-home-core>
      <div className="grid items-stretch gap-3 lg:grid-cols-12">
        <div className="h-full lg:col-span-5" data-home-core-visual>
          <div className="console-copy flex h-full min-h-[14rem] flex-col overflow-hidden">
            <div className="relative min-h-[14rem] flex-1">
              <Image
                src={PLATFORM_CORE.imageSrc}
                alt={PLATFORM_CORE.imageAlt}
                fill
                className={`object-contain ${MARKETING_MEDIA_FILL_CLASS}`}
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
            <div className="border-t border-zinc-800/90 px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                {PLATFORM_CORE.visualCaption}
              </p>
            </div>
          </div>
        </div>
        <div className="console-copy flex flex-col justify-center p-5 sm:p-6 lg:col-span-7 lg:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{PLATFORM_CORE.eyebrow}</p>
          <h2 className="mt-2 max-w-xl text-2xl font-medium leading-[1.12] tracking-[-0.8px] text-white sm:text-3xl">
            {PLATFORM_CORE.title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{PLATFORM_CORE.p1}</p>
          <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{PLATFORM_CORE.p2}</p>
          <Link
            href={PLATFORM_CORE.scienceHref}
            className="mt-4 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
          >
            {PLATFORM_CORE.scienceLabel}
            <ArrowRight className="ml-2" size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingProofSection() {
  return (
    <section className={`${MARKETING_SHELL} pb-12 pt-3 sm:pb-14`} data-home-proof>
      <SectionHeading eyebrow={PLATFORM_PROOF.eyebrow} title={PLATFORM_PROOF.title} mark={false} />
      <ul className="mt-5 flex flex-col gap-3 xl:grid xl:grid-cols-2">
        {PLATFORM_PROOF.items.map((item) => (
          <li
            key={item.name}
            className="console-copy flex min-h-[6.5rem] min-w-0 flex-row overflow-hidden"
          >
            <div className="relative w-24 shrink-0 self-stretch bg-black sm:w-32 lg:w-36">
              <div className="absolute inset-3 sm:inset-4">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  className="object-contain invert"
                  sizes="144px"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3 sm:px-5 sm:py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
              <h4 className="mt-1 text-base font-medium tracking-[-0.4px] text-white sm:text-lg">{item.name}</h4>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              {item.href && item.hrefLabel ? (
                <a
                  href={item.href}
                  {...(item.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="mt-1.5 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                >
                  {item.hrefLabel}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LandingOutcomesSection() {
  return (
    <section className={`${MARKETING_SHELL} pt-3`} data-home-outcomes>
      <SectionHeading eyebrow={PLATFORM_OUTCOMES.eyebrow} title={PLATFORM_OUTCOMES.title} mark={false} />
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
        {PLATFORM_OUTCOMES.lead}
      </p>
      <ul className="mt-5 flex flex-col gap-3 xl:grid xl:grid-cols-3">
        {PLATFORM_OUTCOMES.items.map((item) => (
          <li key={item.name} className="console-copy flex min-h-[6.5rem] min-w-0 flex-col justify-center px-4 py-4 sm:px-5 sm:py-5">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
            <h4 className="mt-1 text-base font-medium tracking-[-0.4px] text-white sm:text-lg">{item.name}</h4>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            {item.href && item.hrefLabel ? (
              <Link
                href={item.href}
                className="mt-1.5 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
              >
                {item.hrefLabel}
                <ArrowRight className="ml-2" size={14} />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center" data-home-cta>
        <TrackedCtaLink
          href={PLATFORM_OUTCOMES.ctaHref}
          label={PLATFORM_OUTCOMES.cta}
          location="landing_outcomes"
          page="/"
          className={MARKETING_HERO_PRIMARY_CTA_CLASS}
        >
          {PLATFORM_OUTCOMES.cta}
          <ArrowRight className="ml-2" size={16} />
        </TrackedCtaLink>
        <Link href={PLATFORM_OUTCOMES.moreHref} className={MARKETING_HERO_SECONDARY_CTA_CLASS}>
          {PLATFORM_OUTCOMES.moreCta}
        </Link>
      </div>
    </section>
  );
}
