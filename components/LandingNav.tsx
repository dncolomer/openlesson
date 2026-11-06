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
  USE_CASES_NAV_LINK,
} from "@/lib/marketing/nav";
import { createClient } from "@/lib/supabase/client";

type LandingNavProps = {
  overlay?: boolean;
};

function communityAnchorProps(href: string) {
  if (href.startsWith("http")) {
    return { target: "_blank" as const, rel: "noopener noreferrer" };
  }
  return {};
}

export function LandingNav({ overlay = false }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const communityRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!communityOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!communityRef.current?.contains(target)) {
        setCommunityOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommunityOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [communityOpen]);

  return (
    <header
      className={`z-40 px-5 py-4 backdrop-blur-md ${
        overlay
          ? "absolute inset-x-0 top-0 border-b-0 bg-[#0a0a0a]/40"
          : "sticky top-0 border-b border-white/30 bg-black/85"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-4">
        <Link href="/" className="transition hover:opacity-90">
          <BrandLogo nameClassName="text-base font-semibold tracking-tight text-white" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex" aria-label="Main navigation">
          <div className="console-copy flex items-stretch" data-nav-products>
            {MAIN_NAV_PRODUCT_LINKS.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 hover:text-white ${
                  index > 0 ? "border-l border-white/25" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Link href={USE_CASES_NAV_LINK.href} className="transition hover:text-white">
            {USE_CASES_NAV_LINK.label}
          </Link>

          {PRICING_NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}

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
                    {...communityAnchorProps(link.href)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn === true ? (
            <Link
              href="/dashboard"
              className="px-2 py-2 text-sm text-zinc-500 transition hover:text-white"
            >
              Dashboard
            </Link>
          ) : isLoggedIn === false ? (
            <Link href="/login" className="px-2 py-2 text-sm text-zinc-500 transition hover:text-white">
              Login
            </Link>
          ) : null}
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
        <nav className="mx-auto mt-4 w-full max-w-[96rem] border-t border-zinc-900 pt-4 md:hidden" aria-label="Mobile navigation">
          <ul className="space-y-1 text-sm">
            <li>
              <div className="console-copy divide-y divide-white/20">
                {MAIN_NAV_PRODUCT_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-3 py-2 font-medium text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </li>
            <li>
              <Link
                href={USE_CASES_NAV_LINK.href}
                className="block rounded-sm px-2 py-2 text-zinc-300"
                onClick={() => setMobileOpen(false)}
              >
                {USE_CASES_NAV_LINK.label}
              </Link>
            </li>
            {PRICING_NAV_LINKS.map((link) => (
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
                        {...communityAnchorProps(link.href)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            {isLoggedIn === true ? (
              <li>
                <Link
                  href="/dashboard"
                  className="block rounded-sm px-2 py-2 text-zinc-300"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
              </li>
            ) : isLoggedIn === false ? (
              <li>
                <Link
                  href="/login"
                  className="block rounded-sm px-2 py-2 text-zinc-300"
                  onClick={() => setMobileOpen(false)}
                >
                  Login
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      )}
    </header>
  );
}
