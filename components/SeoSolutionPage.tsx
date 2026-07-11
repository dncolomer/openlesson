import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { ProductStack } from "@/components/ProductStack";
import {
  BASE_URL,
  DEFAULT_BACKGROUND,
  type SeoPlatformPageConfig,
} from "@/lib/seo/platform-page";

export type BreadcrumbItem = {
  href: string;
  label: string;
};

type SeoSolutionPageProps = {
  page: SeoPlatformPageConfig;
  breadcrumbs?: BreadcrumbItem[];
};

export function SeoSolutionPage({ page, breadcrumbs }: SeoSolutionPageProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.metaTitle,
    description: page.metaDescription,
    url: `${BASE_URL}${page.path}`,
    isPartOf: {
      "@type": "WebSite",
      name: "openLesson",
      url: BASE_URL,
    },
  };

  const breadcrumbSchema = breadcrumbs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.label,
          item: `${BASE_URL}${crumb.href}`,
        })),
      }
    : null;

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.9), rgba(10,10,10,0.94)), url(${DEFAULT_BACKGROUND})`,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}

      <LandingNav />

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-neutral-500">
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-2">
                  {index > 0 && <span className="text-neutral-700">/</span>}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-neutral-400">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="transition hover:text-white">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <header className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl lg:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-400">{page.intro}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="border border-cyan-400/20 bg-cyan-950/20 p-5">
              <p className="text-base leading-relaxed text-neutral-300">
                <span className="font-medium text-cyan-200">Verify</span> learning with software
                tools.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                <span className="text-neutral-300">Proof-of-Work API</span> scores artifacts and tool
                traces. <span className="text-neutral-300">Think Aloud Protocol</span> captures live
                human cognition under probe. Both run inside the knowledge workspace.
              </p>
            </div>
            <div className="border border-violet-400/20 bg-violet-950/20 p-5">
              <p className="text-base leading-relaxed text-neutral-300">
                <span className="font-medium text-violet-200">Augment</span> learning where gaps
                appear.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                <span className="text-neutral-300">ILE</span> routes humans into targeted practice.{" "}
                <span className="text-neutral-300">ALE</span> helps skill developers iterate agent
                skills. Verification findings drive what gets practiced next.
              </p>
            </div>
          </div>
          <div className="mt-10 rounded-md border border-neutral-800 bg-neutral-950/70 p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              Four tools. One knowledge workspace.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Proof-of-Work API and Think Aloud Protocol verify learning. ILE and ALE augment it. All four
              share the same workspace context, scoring model, and gap analysis.
            </p>
            <div className="mt-5">
              <ProductStack variant="compact" showFoundation={false} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedCtaLink
              href={page.primaryCta.href}
              label={page.primaryCta.label}
              location="platform_hero"
              page={page.path}
              className="inline-flex h-11 items-center justify-center rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-neutral-200"
            />
            {page.secondaryCta && (
              <TrackedCtaLink
                href={page.secondaryCta.href}
                label={page.secondaryCta.label}
                location="platform_hero_secondary"
                page={page.path}
                className="inline-flex h-11 items-center justify-center rounded-sm border border-neutral-700 px-5 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
              />
            )}
          </div>
        </header>

        <article className="space-y-10 text-base leading-relaxed text-neutral-400">
          {page.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-medium text-white sm:text-2xl">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="mt-4">
                  {paragraph.includes("Proof-of-Work API") ? (
                    <>
                      {paragraph.split("Proof-of-Work API")[0]}
                      <Link
                        href="/docs/proof-of-work-api"
                        className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
                      >
                        Proof-of-Work API
                      </Link>
                      {paragraph.split("Proof-of-Work API")[1]}
                    </>
                  ) : (
                    paragraph
                  )}
                </p>
              ))}
            </section>
          ))}

          <section id="faq" className="rounded-md border border-neutral-800 bg-neutral-950/70 p-6 sm:p-8">
            <h2 className="text-xl font-medium text-white sm:text-2xl">Frequently asked questions</h2>
            <dl className="mt-6 space-y-6">
              {page.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-sm font-medium text-neutral-200">{faq.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-neutral-500">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-md border border-neutral-800 bg-neutral-950/80 p-6 text-center sm:p-8">
            <h2 className="text-xl font-medium text-white">{page.closingTitle}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-500">{page.closingBody}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <TrackedCtaLink
                href={page.primaryCta.href}
                label="Get started"
                location="platform_closing"
                page={page.path}
                className="inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
              />
              <TrackedCtaLink
                href="/pricing"
                label="View pricing"
                location="platform_closing"
                page={page.path}
                className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              />
            </div>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}