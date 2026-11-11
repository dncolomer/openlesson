"use client";

import Image from "next/image";
import Link from "next/link";
import {
  dashboardHomeCtas,
  dashboardHomeIntegrationsCta,
} from "@/lib/dashboard-home-overview";
import { MARKETING_MEDIA_FILL_CLASS } from "@/lib/marketing/shell";

export function DashboardHomeTab() {
  const ctas = dashboardHomeCtas();
  const integrations = dashboardHomeIntegrationsCta();

  return (
    <div
      className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4"
      data-dashboard-home
      data-dashboard-home-overview
    >
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Platform
        </p>
        <h2 className="mt-1 text-2xl font-medium tracking-[-0.6px] text-white">
          Home
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Pick a product. Run Solve / Practice, verify work, or calibrate a prior.
        </p>
      </header>

      <section
        className="sticky top-0 z-10 -mx-4 bg-gradient-to-b from-black from-40% via-black/90 to-transparent px-4 pb-4 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        data-dashboard-home-integrations
      >
        <Link
          href={integrations.href}
          data-dashboard-home-integrations-link
          className="console-copy flex items-center justify-between gap-4 px-5 py-3 transition hover:border-white/70"
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              {integrations.eyebrow}
            </p>
            <p className="mt-1 text-sm font-medium tracking-[-0.2px] text-white">
              {integrations.label}
            </p>
            <p className="mt-0.5 text-sm text-neutral-400">{integrations.body}</p>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80">
            {integrations.action}
          </span>
        </Link>
      </section>

      <section
        className="mt-auto grid min-h-0 flex-1 gap-3 md:grid-cols-3 md:items-stretch"
        data-dashboard-home-cta
      >
        {ctas.map((cta) => (
          <article
            key={cta.id}
            data-dashboard-home-cta-card={cta.id}
            className="console-copy relative min-h-[18rem] overflow-hidden md:h-full"
          >
            <div
              className={`absolute inset-0 ${MARKETING_MEDIA_FILL_CLASS}`}
              data-dashboard-home-cta-visual={cta.id}
            >
              <Image
                src={cta.imageSrc}
                alt={cta.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black via-black/85 to-transparent px-5 pb-5 pt-28">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-400">
                Open
              </p>
              <h3 className="mt-3 text-xl font-medium tracking-[-0.4px] text-white">
                {cta.label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{cta.body}</p>
              <nav className="mt-6 flex flex-col gap-1.5" aria-label={cta.label}>
                {cta.links.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    data-dashboard-home-cta-link={link.id}
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/80 transition hover:text-white"
                  >
                    {link.label} →
                  </Link>
                ))}
              </nav>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
