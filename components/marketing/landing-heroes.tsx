"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/marketing/MarketingChrome";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
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
import { PLATFORM_CORE, PLATFORM_PROOF } from "@/lib/marketing/platform";

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
      className="mt-6 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
    >
      {label}
      <ArrowRight className="ml-2" size={14} />
    </TrackedCtaLink>
  );
}

/** Combined hero: session-canvas still, live copy overlaid, three uses in the same plate. */
export function LandingHeroEditorial({
  location = "landing_layers",
}: {
  location?: string;
}) {
  const copy = LANDING_HERO_COPY;
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-8 pb-6 sm:pt-10 sm:pb-8" data-home-hero data-home-hero-editorial>
      <div className="console-copy overflow-hidden" data-home-layers>
        <div className="relative min-h-[34rem] sm:min-h-[40rem] lg:min-h-[44rem]">
          <Image
            src={LANDING_HERO_STILL}
            alt={LANDING_HERO_STILL_ALT}
            fill
            className="object-cover object-center brightness-[1.18]"
            sizes="(max-width: 1280px) 100vw, 1280px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-tl from-black/90 via-black/55 via-[42%] to-transparent" />
          <div className="relative z-10 flex min-h-[34rem] flex-col items-end justify-end px-6 pb-8 pt-16 text-right sm:min-h-[40rem] sm:px-10 sm:pb-10 lg:min-h-[44rem] lg:px-12 lg:pb-12">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-300">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-1.6px] text-white sm:text-5xl lg:text-6xl">
              {copy.h1}
            </h1>
            <div className="mt-5 max-w-2xl space-y-3 text-[15px] leading-relaxed text-zinc-200 sm:text-base">
              <p>{copy.p1}</p>
            </div>
          </div>
        </div>

        <ol className="grid border-t border-zinc-800/90 lg:grid-cols-3">
          {LANDING_USES.map((product, index) => (
            <li
              key={product.href}
              className={`px-6 py-7 sm:px-8 sm:py-8 ${index > 0 ? "border-t border-zinc-800/90 lg:border-t-0 lg:border-l" : ""}`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                {String(index + 1).padStart(2, "0")} · {product.eyebrow}
              </p>
              <h2 className="mt-2 text-xl font-medium tracking-[-0.5px] text-white">{product.name}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">{product.dek}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">{product.body}</p>
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
    <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12" data-home-core>
      <div className="grid items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-5" data-home-core-visual>
          <div className="console-copy overflow-hidden">
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={PLATFORM_CORE.imageSrc}
                alt={PLATFORM_CORE.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 480px"
              />
            </div>
            <div className="border-t border-zinc-800/90 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
                {PLATFORM_CORE.visualCaption}
              </p>
            </div>
          </div>
        </div>
        <div className="console-copy flex flex-col p-6 sm:p-8 lg:col-span-7 lg:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{PLATFORM_CORE.eyebrow}</p>
          <h2 className="mt-3 max-w-xl text-2xl font-medium leading-[1.12] tracking-[-0.8px] text-white sm:text-3xl">
            {PLATFORM_CORE.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-[17px]">{PLATFORM_CORE.p1}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">{PLATFORM_CORE.p2}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">{PLATFORM_CORE.p3}</p>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">{PLATFORM_CORE.visualBody}</p>
        </div>
      </div>
    </section>
  );
}

export function LandingProofSection() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-10 sm:pb-20 sm:pt-12" data-home-proof>
      <SectionHeading eyebrow={PLATFORM_PROOF.eyebrow} title={PLATFORM_PROOF.title} mark={false} />
      <ul className="mt-8 flex flex-col gap-3">
        {PLATFORM_PROOF.items.map((item) => (
          <li
            key={item.name}
            className="console-copy flex min-h-[7rem] min-w-0 flex-row overflow-hidden"
          >
            <div className="relative w-28 shrink-0 self-stretch sm:w-36 lg:w-40">
              <Image
                src={item.image}
                alt={item.imageAlt}
                fill
                className="object-cover"
                sizes="160px"
              />
              {"logo" in item && item.logo ? (
                <div className="absolute left-2 top-2 z-10 flex items-center rounded-none border border-white/25 bg-black/70 px-1.5 py-1.5">
                  <Image
                    src={item.logo}
                    alt={item.logoAlt ?? item.eyebrow}
                    width={40}
                    height={37}
                    className="h-5 w-auto invert"
                  />
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-3.5 sm:px-6 sm:py-4">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
              <h4 className="mt-1 text-base font-medium tracking-[-0.4px] text-white sm:text-lg">{item.name}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              {item.href && item.hrefLabel ? (
                <a
                  href={item.href}
                  {...(item.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="mt-2 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
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
