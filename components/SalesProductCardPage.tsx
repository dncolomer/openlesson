import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import type { SalesProductCard } from "@/lib/sales/product-cards";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";

const BACKGROUND_IMAGE = PITCH_ASSETS.aesthetics.useCase;

type SalesProductCardPageProps = {
  card: SalesProductCard;
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm sm:p-6">
      {eyebrow ? (
        <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">{eyebrow}</p>
      ) : null}
      <h2 className={`text-xl font-medium tracking-[-0.4px] text-white ${eyebrow ? "mt-2" : ""}`}>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-400 sm:text-base">{children}</div>
    </section>
  );
}

function SpecTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-hidden border border-zinc-800/90">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-zinc-800/90 first:border-t-0">
              <th className="w-[34%] align-top bg-zinc-950/80 px-3 py-2.5 font-medium text-zinc-300 sm:px-4">
                {row.label}
              </th>
              <td className="align-top px-3 py-2.5 text-zinc-400 sm:px-4">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({
  withoutLabel,
  withLabel,
  rows,
}: {
  withoutLabel: string;
  withLabel: string;
  rows: { without: string; with: string }[];
}) {
  return (
    <div className="overflow-x-auto border border-zinc-800/90">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950/80">
            <th className="px-3 py-2.5 font-medium text-zinc-400 sm:px-4">{withoutLabel}</th>
            <th className="px-3 py-2.5 font-medium text-zinc-300 sm:px-4">{withLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.without} className="border-t border-zinc-800/90">
              <td className="align-top px-3 py-2.5 text-zinc-500 sm:px-4">{row.without}</td>
              <td className="align-top px-3 py-2.5 text-zinc-300 sm:px-4">{row.with}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-zinc-400 marker:text-zinc-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-zinc-400 marker:text-zinc-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function SalesProductCardPage({ card }: SalesProductCardPageProps) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-sales-product-card={card.slug}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-10 pb-16 sm:pt-12">
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Sales
        </Link>

        <div className="mt-8 mb-4 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          {card.eyebrow.toUpperCase()}
        </div>
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-1.8px] text-white sm:text-5xl">
          {card.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-zinc-400">{card.oneLine}</p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={card.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            <Calendar size={15} />
            Book a demo
            <ArrowRight size={14} />
          </a>
          <p className="font-mono text-[11px] uppercase tracking-[1.4px] text-zinc-600">
            uncertain.systems · noindex
          </p>
        </div>

        {card.image ? (
          <figure
            className="mt-8 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.9)]"
            data-sales-product-visual
            data-sales-product-image={card.image}
          >
            <Image
              src={card.image}
              alt={card.imageAlt || card.title}
              width={2080}
              height={1644}
              className="h-auto w-full object-cover object-top"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
            {card.imageCaption ? (
              <figcaption className="border-t border-zinc-800/90 px-4 py-3 font-mono text-[10px] uppercase tracking-[1.4px] text-zinc-500 sm:px-5">
                {card.imageCaption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <div className="mt-10 space-y-5">
          <Section title="What it is">
            <p>{card.whatItIs}</p>
            <SpecTable rows={card.specs} />
          </Section>

          <Section title={card.inputsHeading}>
            <SpecTable rows={card.inputs} />
            {card.inputsNote ? <p>{card.inputsNote}</p> : null}
          </Section>

          {card.integration ? (
            <Section title={card.integration.title}>
              <p>{card.integration.body}</p>
              <BulletList items={card.integration.bullets} />
              {card.integration.note ? <p>{card.integration.note}</p> : null}
            </Section>
          ) : null}

          <Section title="Candidate experience">
            <NumberedList items={card.experience} />
            {card.experienceNote ? <p>{card.experienceNote}</p> : null}
          </Section>

          <Section title="What the client gets">
            {card.deliverablesNote ? <p>{card.deliverablesNote}</p> : null}
            <SpecTable rows={card.deliverables} />
          </Section>

          {card.valueModes && card.valueModes.length > 0 ? (
            <Section title="Two ways this product creates value">
              {card.valueModes.map((mode) => (
                <div key={mode.title}>
                  <h3 className="text-base font-medium text-zinc-200">{mode.title}</h3>
                  <p className="mt-2">{mode.body}</p>
                </div>
              ))}
            </Section>
          ) : null}

          <Section title="When to use it">
            <BulletList items={card.whenToUse} />
          </Section>

          <Section title={card.comparisonTitle}>
            <ComparisonTable
              withoutLabel={card.comparisonWithoutLabel}
              withLabel={card.comparisonWithLabel}
              rows={card.comparison}
            />
          </Section>

          <Section title="Suggested placement in the funnel">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-sm border border-zinc-800 bg-zinc-950/90 p-4 font-mono text-xs leading-relaxed text-zinc-400 sm:text-sm">
              {card.funnel}
            </pre>
            {card.funnelNote ? <p>{card.funnelNote}</p> : null}
          </Section>

          <Section title="Pilot sketch">
            <NumberedList items={card.pilot} />
            <p>
              <span className="font-medium text-zinc-300">Success metrics: </span>
              {card.successMetrics}
            </p>
          </Section>

          <Section title="Ask / next step">
            <BulletList items={card.ask} />
            <a
              href={card.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              <Calendar size={15} />
              Book a demo
              <ArrowRight size={14} />
            </a>
          </Section>
        </div>

        <p className="mt-10 text-sm text-zinc-500">{card.footer}</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-600">
          uncertain.systems
        </p>
      </div>
    </main>
  );
}
