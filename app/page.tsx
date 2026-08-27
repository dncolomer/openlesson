"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { PLATFORM_PRODUCT_LIST } from "@/lib/marketing/platform";

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

      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="w-full">
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
            HUMAN KNOWLEDGE PLATFORM
          </div>
          <h1 className="max-w-5xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[72px]">
            A Human Knowledge Platform.
          </h1>
          <div className="mt-7 max-w-5xl space-y-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            <p>Uncertain Systems is a Human Knowledge Platform.</p>
            <p className="text-zinc-500 sm:text-base">
              A Learning Harness for humans, and Knowledge Verification for companies that need to verify Human Knowledge without traditional tests and exams — with the guarantee that results cannot be cheated or faked.
            </p>
          </div>
          <div className="mt-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {PLATFORM_PRODUCT_LIST.map((product) => (
              <ProductSplitCard key={product.href} product={product} />
            ))}
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function ProductSplitCard({
  product,
}: {
  product: (typeof PLATFORM_PRODUCT_LIST)[number];
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
          {product.title}
        </h2>
        <p className="mt-5 flex-1 text-[15px] leading-relaxed text-zinc-400 sm:text-base">{product.body}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TrackedCtaLink
            href={product.href}
            label={product.cta}
            location="landing_hero"
            page="/"
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            {product.cta}
            <ArrowRight className="ml-2" size={16} />
          </TrackedCtaLink>
          {"pricingHref" in product && product.pricingHref ? (
            <Link
              href={product.pricingHref}
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Pricing
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
