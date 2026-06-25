import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import {
  BASE_URL,
  DEFAULT_BACKGROUND,
  type SeoSolutionPageConfig,
} from "@/lib/seo/solution-pages";

type SeoSolutionPageProps = {
  page: SeoSolutionPageConfig;
};

export function SeoSolutionPage({ page }: SeoSolutionPageProps) {
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

      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl lg:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-400">{page.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={page.primaryCta.href}
              className="inline-flex h-11 items-center justify-center rounded-sm bg-white px-5 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              {page.primaryCta.label}
            </Link>
            {page.secondaryCta && (
              <Link
                href={page.secondaryCta.href}
                className="inline-flex h-11 items-center justify-center rounded-sm border border-neutral-700 px-5 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
              >
                {page.secondaryCta.label}
              </Link>
            )}
          </div>
        </header>

        <article className="space-y-10 text-base leading-relaxed text-neutral-400">
          {page.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-medium text-white sm:text-2xl">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="mt-4">
                  {paragraph.includes("Agentic API v2") ? (
                    <>
                      {paragraph.split("Agentic API v2")[0]}
                      <Link
                        href="/docs/agentic-v2"
                        className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
                      >
                        Agentic API v2
                      </Link>
                      {paragraph.split("Agentic API v2")[1]}
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
              <Link
                href={page.primaryCta.href}
                className="inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                Get started
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                View pricing
              </Link>
            </div>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}