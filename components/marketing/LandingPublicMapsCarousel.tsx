"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import {
  LANDING_MAP_SIGNUP_HREF,
  LANDING_PUBLIC_MAPS_PATH,
  truncatePublicMapSummary,
  type PublicMapCatalogItem,
} from "@/lib/dashboard-home-catalog";
import { PLATFORM_PUBLIC_MAPS } from "@/lib/marketing/platform";

export function LandingPublicMapsCarousel() {
  const [maps, setMaps] = useState<PublicMapCatalogItem[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/landing/maps" satisfies typeof LANDING_PUBLIC_MAPS_PATH)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const next = Array.isArray(payload?.maps) ? payload.maps : [];
        setMaps(next);
      })
      .catch(() => {
        if (!cancelled) setMaps([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (maps.length === 0) return null;

  function scrollByCard(direction: -1 | 1) {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.max(360, Math.round(node.clientWidth * 0.8));
    node.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className="mt-10" data-home-maps-carousel>
      <h2 className="text-lg font-medium tracking-[-0.4px] text-white sm:text-xl">
        {PLATFORM_PUBLIC_MAPS.title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{PLATFORM_PUBLIC_MAPS.lead}</p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-none border border-white/40 text-white transition hover:border-white/80 sm:inline-flex"
          aria-label="Previous maps"
        >
          <ChevronLeft size={16} />
        </button>
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex min-w-0 flex-1 gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory"
        >
          {maps.map((item) => {
            const summary = truncatePublicMapSummary(item.summary);
            return (
              <Link
                key={item.id}
                href={PLATFORM_PUBLIC_MAPS.signupHref satisfies typeof LANDING_MAP_SIGNUP_HREF}
                data-home-map-card
                className="group relative min-h-[22rem] w-[20rem] shrink-0 snap-start overflow-hidden rounded-none border border-white/20 text-left transition hover:border-white/60 sm:min-h-[24rem] sm:w-[24rem] lg:min-h-[26rem] lg:w-[28rem]"
              >
                <WorkspaceCardHero
                  workspaceId={item.id}
                  coverImageUrl={item.coverImageUrl}
                  fallback="aesthetic"
                  heightClassName="absolute inset-0 h-full min-h-[22rem] sm:min-h-[24rem] lg:min-h-[26rem]"
                />
                <div className="relative flex min-h-[22rem] flex-col justify-end p-4 sm:min-h-[24rem] sm:p-5 lg:min-h-[26rem]">
                  <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300">
                    {item.category || "Map"}
                    {item.isAycl && item.priceLabel ? ` · ${item.priceLabel}` : ""}
                  </p>
                  <p className="mt-1 text-base font-medium text-white sm:text-lg">{item.title}</p>
                  {summary ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-200">
                      {summary}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-none border border-white/40 text-white transition hover:border-white/80 sm:inline-flex"
          aria-label="Next maps"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
