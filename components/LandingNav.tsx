"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  COMMUNITY_LINKS,
  COMMUNITY_NAV_LABEL,
  MAIN_NAV_PRODUCT_LINKS,
  PRICING_NAV_LINKS,
  TOP_LINKS,
} from "@/lib/marketing/nav";

type LandingNavProps = {
  overlay?: boolean;
};

export function LandingNav({ overlay = false }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const [mobilePricingOpen, setMobilePricingOpen] = useState(false);
  const communityRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!communityOpen && !pricingOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (communityOpen && !communityRef.current?.contains(target)) {
        setCommunityOpen(false);
      }
      if (pricingOpen && !pricingRef.current?.contains(target)) {
        setPricingOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommunityOpen(false);
        setPricingOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [communityOpen, pricingOpen]);

  return (
    <header
      className={`z-40 px-5 py-4 backdrop-blur-md ${
        overlay
          ? "absolute inset-x-0 top-0 border-b-0 bg-[#0a0a0a]/40"
          : "sticky top-0 border-b border-zinc-900 bg-[#0a0a0a]/86"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="transition hover:opacity-90">
          <BrandLogo nameClassName="text-base font-semibold tracking-tight text-white" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex" aria-label="Main navigation">
          {MAIN_NAV_PRODUCT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}

          <div className="relative" ref={pricingRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1 transition hover:text-white"
              aria-expanded={pricingOpen}
              aria-haspopup="menu"
              aria-controls="pricing-menu"
              onClick={() => {
                setPricingOpen((open) => !open);
                setCommunityOpen(false);
              }}
            >
              Pricing
              <ChevronDown
                size={14}
                className={`transition-transform ${pricingOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {pricingOpen && (
              <div
                id="pricing-menu"
                role="menu"
                aria-label="Pricing"
                className="absolute left-0 top-full z-50 mt-2 min-w-[12.5rem] border border-zinc-800 bg-[#0a0a0a]/95 py-1 shadow-xl shadow-black/40 backdrop-blur-md"
              >
                {PRICING_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    onClick={() => setPricingOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {TOP_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}

          <div className="relative" ref={communityRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1 transition hover:text-white"
              aria-expanded={communityOpen}
              aria-haspopup="menu"
              aria-controls="community-menu"
              onClick={() => {
                setCommunityOpen((open) => !open);
                setPricingOpen(false);
              }}
            >
              {COMMUNITY_NAV_LABEL}
              <ChevronDown
                size={14}
                className={`transition-transform ${communityOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {communityOpen && (
              <div
                id="community-menu"
                role="menu"
                aria-label={COMMUNITY_NAV_LABEL}
                className="absolute left-0 top-full z-50 mt-2 min-w-[12.5rem] border border-zinc-800 bg-[#0a0a0a]/95 py-1 shadow-xl shadow-black/40 backdrop-blur-md"
              >
                {COMMUNITY_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    onClick={() => setCommunityOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-2 py-2 text-sm text-zinc-500 transition hover:text-white">
            Login
          </Link>
        </div>

        <button
          type="button"
          className="rounded-sm border border-zinc-800 p-2 text-zinc-400 md:hidden"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="mx-auto mt-4 max-w-6xl border-t border-zinc-900 pt-4 md:hidden" aria-label="Mobile navigation">
          <ul className="space-y-1 text-sm">
            {MAIN_NAV_PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-sm px-2 py-2 text-zinc-300"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-zinc-300"
                aria-expanded={mobilePricingOpen}
                onClick={() => setMobilePricingOpen((open) => !open)}
              >
                Pricing
                <ChevronDown
                  size={14}
                  className={`transition-transform ${mobilePricingOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {mobilePricingOpen && (
                <ul className="mb-1 ml-2 space-y-0.5 border-l border-zinc-800 pl-2">
                  {PRICING_NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block rounded-sm px-2 py-2 text-zinc-400"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            {TOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-sm px-2 py-2 text-zinc-300"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-zinc-300"
                aria-expanded={mobileCommunityOpen}
                onClick={() => setMobileCommunityOpen((open) => !open)}
              >
                {COMMUNITY_NAV_LABEL}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${mobileCommunityOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {mobileCommunityOpen && (
                <ul className="mb-1 ml-2 space-y-0.5 border-l border-zinc-800 pl-2">
                  {COMMUNITY_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block rounded-sm px-2 py-2 text-zinc-400"
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <Link href="/login" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
