"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { SectionHeading } from "@/components/marketing/MarketingChrome";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import {
  PLATFORM_CTA,
  PLATFORM_DELIVERY,
  PLATFORM_HERO,
  PLATFORM_LAYER_LIST,
  PLATFORM_LAYERS,
  PLATFORM_PROOF,
  PLATFORM_SPINE,
} from "@/lib/marketing/platform";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

export default function B2BLandingPage() {
  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      {bgImage && <div className="fixed inset-0 z-0 bg-cover bg-fixed bg-center" style={{ backgroundImage: `url(${bgImage})` }} />}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12" data-home-hero>
        <div className="w-full">
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
            {PLATFORM_HERO.pill}
          </div>
          <h1 className="max-w-5xl text-4xl font-medium leading-[1.08] tracking-[-2px] text-white sm:text-5xl lg:text-[56px]">
            {PLATFORM_HERO.h1}
          </h1>
          <div className="mt-7 max-w-3xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>{PLATFORM_HERO.p1}</p>
            <p className="text-zinc-500 sm:text-base">{PLATFORM_HERO.p2}</p>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedCtaLink
              href={PLATFORM_CTA.href}
              label={PLATFORM_CTA.label}
              location="landing_hero"
              page="/"
              className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              {PLATFORM_CTA.label}
              <ArrowRight className="ml-2" size={16} />
            </TrackedCtaLink>
            <a
              href={PLATFORM_CTA.href}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              {PLATFORM_CTA.email}
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12" data-home-spine>
        <SectionHeading eyebrow={PLATFORM_SPINE.eyebrow} title={PLATFORM_SPINE.title} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_SPINE.items.map((item) => (
            <li key={item.name} className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
              <h3 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">{item.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12" data-home-delivery>
        <SectionHeading eyebrow={PLATFORM_DELIVERY.eyebrow} title={PLATFORM_DELIVERY.title} />
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {PLATFORM_DELIVERY.lead}
        </p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {PLATFORM_DELIVERY.items.map((item) => (
            <li key={item.name} className="border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
              <h3 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">{item.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:py-12" data-home-layers>
        <SectionHeading eyebrow={PLATFORM_LAYERS.eyebrow} title={PLATFORM_LAYERS.title} />
        <div className="mt-8 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {PLATFORM_LAYER_LIST.map((product) => (
            <LayerCard key={product.href} product={product} />
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-10 sm:pb-20 sm:pt-12" data-home-proof>
        <SectionHeading eyebrow={PLATFORM_PROOF.eyebrow} title={PLATFORM_PROOF.title} />
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {PLATFORM_PROOF.items.map((item) => (
            <li
              key={item.name}
              className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70"
            >
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  className="object-cover grayscale"
                  sizes="(max-width: 768px) 100vw, 576px"
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{item.eyebrow}</p>
                <h4 className="mt-3 text-xl font-medium tracking-[-0.6px] text-white">{item.name}</h4>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                {item.href && item.hrefLabel ? (
                  <a
                    href={item.href}
                    {...(item.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="mt-5 inline-flex items-center text-sm font-medium text-zinc-200 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-500"
                  >
                    {item.hrefLabel}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <div
          className="mt-12 w-full border border-zinc-800 bg-zinc-950/80 px-6 py-10 text-center sm:px-10 sm:py-12"
          data-home-cta
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {PLATFORM_CTA.eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">
            {PLATFORM_CTA.title}
          </h2>
          <TrackedCtaLink
            href={PLATFORM_CTA.href}
            label={PLATFORM_CTA.email}
            location="landing_proof"
            page="/"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {PLATFORM_CTA.email}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function LayerCard({
  product,
}: {
  product: (typeof PLATFORM_LAYER_LIST)[number];
}) {
  return (
    <article className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/70">
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          className="object-cover grayscale"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
        />
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7 lg:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{product.eyebrow}</p>
        <h2 className="mt-3 text-[1.5rem] font-medium leading-[1.08] tracking-[-0.8px] text-white sm:text-[1.7rem]">
          {product.name}
        </h2>
        <p className="mt-5 flex-1 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{product.body}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCtaLink
            href={product.href}
            label={product.cta}
            location="landing_layers"
            page="/"
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {product.cta}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
        </div>
      </div>
    </article>
  );
}
