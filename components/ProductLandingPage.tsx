import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import {
  DEMO_BOOKING_URL,
  type SeoProductPageConfig,
} from "@/lib/seo/product-page";

const BASE_URL = "https://openlesson.academy";

type ProductLandingPageProps = {
  page: SeoProductPageConfig;
};

export function ProductLandingPage({ page }: ProductLandingPageProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.metaTitle,
    description: page.metaDescription,
    url: `${BASE_URL}${page.path}`,
    isPartOf: { "@type": "WebSite", name: "openLesson", url: BASE_URL },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Use cases", item: `${BASE_URL}/use-cases` },
      { "@type": "ListItem", position: 3, name: page.eyebrow, item: `${BASE_URL}${page.path}` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {page.heroVideoSrc ? (
        <div className="relative">
          <LandingNav overlay />
          <div
            className="relative h-[min(52vh,420px)] w-full overflow-hidden bg-[#0a0a0a]"
            aria-label={page.heroImageAlt}
          >
            <video
              className="absolute inset-0 block h-full w-full object-cover"
              style={page.heroVideoPosition ? { objectPosition: page.heroVideoPosition } : undefined}
              src={page.heroVideoSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]" />
          </div>
        </div>
      ) : (
        <>
          <LandingNav />
          <div
            className="relative h-[min(52vh,420px)] w-full overflow-hidden border-b border-zinc-800 bg-zinc-950"
            aria-label={page.heroImageAlt}
          >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#18181b_0%,#09090b_45%,#0c1a1f_100%)]" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.03) 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.03) 48px)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 z-10 mx-auto w-full max-w-5xl px-6 pb-8">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Image placeholder</p>
              <p className="mt-2 max-w-xl text-sm text-zinc-400">{page.heroImageAlt}</p>
            </div>
          </div>
        </>
      )}

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li>
              <Link href="/use-cases" className="transition hover:text-white">
                Use cases
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li className="text-zinc-400">{page.eyebrow}</li>
          </ol>
        </nav>

        <header className="mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{page.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl lg:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400">{page.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedCtaLink
              href={DEMO_BOOKING_URL}
              label="Book a demo"
              location="product_hero_demo"
              page={page.path}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={16} />
              Book a demo
            </TrackedCtaLink>
            {page.secondaryCta && (
              <TrackedCtaLink
                href={page.secondaryCta.href}
                label={page.secondaryCta.label}
                location="product_hero_secondary"
                page={page.path}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-700 px-5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {page.secondaryCta.label}
                <ArrowRight size={14} />
              </TrackedCtaLink>
            )}
          </div>
        </header>

        <section className="mb-14">
          <h2 className="text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">Use cases</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Where teams deploy {page.eyebrow} inside the openLesson knowledge workspace.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {page.useCases.map((useCase) => (
              <article
                key={useCase.title}
                className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700"
              >
                <h3 className="text-base font-medium text-white">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{useCase.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-14 rounded-md border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <h2 className="text-xl font-medium text-white sm:text-2xl">Why teams choose it</h2>
          <ul className="mt-6 space-y-3">
            {page.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-zinc-400">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400/80" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="mb-14 rounded-md border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <h2 className="text-xl font-medium text-white sm:text-2xl">Frequently asked questions</h2>
          <dl className="mt-6 space-y-6">
            {page.faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-sm font-medium text-zinc-200">{faq.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-500">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-md border border-zinc-800 bg-zinc-950/80 p-8 text-center sm:p-10">
          <h2 className="text-xl font-medium text-white sm:text-2xl">{page.closingTitle}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-500">{page.closingBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <TrackedCtaLink
              href={DEMO_BOOKING_URL}
              label="Book a demo"
              location="product_closing_demo"
              page={page.path}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={16} />
              Book a demo
            </TrackedCtaLink>
            <TrackedCtaLink
              href="/use-cases"
              label="View use cases"
              location="product_closing_use_cases"
              page={page.path}
              className="inline-flex h-11 items-center justify-center rounded-sm border border-zinc-700 px-5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}