import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { aestheticImageForId } from "@/lib/aesthetics";
import {
  DEMO_BOOKING_URL,
  type SeoUseCasePageConfig,
} from "@/lib/seo/use-case-page";

const BASE_URL = "https://openlesson.academy";

const USE_CASE_AESTHETICS = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
];

type UseCaseLandingPageProps = {
  page: SeoUseCasePageConfig;
};

export function UseCaseLandingPage({ page }: UseCaseLandingPageProps) {
  const backgroundImage = aestheticImageForId(page.slug, USE_CASE_AESTHETICS);

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
      { "@type": "ListItem", position: 2, name: "Use cases", item: `${BASE_URL}/use-cases/learning-verification` },
      { "@type": "ListItem", position: 3, name: page.eyebrow, item: `${BASE_URL}${page.path}` },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-zinc-700">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12 sm:py-16">
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
          <h1 className="mt-4 text-3xl font-medium leading-[1.08] tracking-[-1.2px] text-white sm:text-4xl lg:text-5xl">
            {page.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400">{page.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedCtaLink
              href={DEMO_BOOKING_URL}
              label="Book a demo"
              location="use_case_hero_demo"
              page={page.path}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={16} />
              Book a demo
            </TrackedCtaLink>
            <TrackedCtaLink
              href="/workspace/new"
              label="Create your Workspace"
              location="use_case_hero_workspace"
              page={page.path}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-zinc-700 px-5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              Create your Workspace
              <ArrowRight size={14} />
            </TrackedCtaLink>
          </div>
        </header>

        <section className="mb-14">
          <h2 className="text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">Use cases</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Where teams deploy {page.eyebrow.toLowerCase()} inside the openLesson platform.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {page.useCases.map((useCase) => (
              <article
                key={useCase.title}
                className="border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm transition hover:border-zinc-700"
              >
                <h3 className="text-base font-medium text-white">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{useCase.description}</p>
              </article>
            ))}
          </div>
        </section>

        {page.integrationTiers && page.integrationTiers.length > 0 && (
          <section className="mb-14">
            <h2 className="text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
              Three levels of validation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Pick integration depth by role, volume, and how native validation must feel inside your HR or
              recruitment product.
            </p>
            <div className="mt-8 space-y-4">
              {page.integrationTiers.map((tier) => (
                <article
                  key={tier.level}
                  className="border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm sm:p-6"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">
                      Level {tier.level}
                    </span>
                    <h3 className="text-base font-medium text-white sm:text-lg">{tier.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">{tier.description}</p>
                  <Link
                    href={tier.productHref}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-300 underline decoration-zinc-600 underline-offset-4 transition hover:text-white hover:decoration-zinc-400"
                  >
                    {tier.product}
                    <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mb-14 rounded-md border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-sm sm:p-8">
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

        <section id="faq" className="mb-14 rounded-md border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-sm sm:p-8">
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

        <section className="rounded-md border border-zinc-800 bg-zinc-950/80 p-8 text-center backdrop-blur-sm sm:p-10">
          <h2 className="text-xl font-medium text-white sm:text-2xl">{page.closingTitle}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-500">{page.closingBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <TrackedCtaLink
              href={DEMO_BOOKING_URL}
              label="Book a demo"
              location="use_case_closing_demo"
              page={page.path}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={16} />
              Book a demo
            </TrackedCtaLink>
            <TrackedCtaLink
              href="/#products"
              label="View products"
              location="use_case_closing_products"
              page={page.path}
              className="inline-flex h-11 items-center justify-center rounded-sm border border-zinc-700 px-5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            />
          </div>
        </section>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}