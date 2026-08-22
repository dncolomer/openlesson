"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";

const CTA = "Create your Workspace";
const CTA_HREF = "/workspace/new";

const COMMUNITY_LINKS = [
  { href: "/all-you-can-learn", label: "All-You-Can-Learn" },
  { href: "/community-events", label: "Community Events" },
  { href: "/map-of-knowledge", label: "Map of Knowledge" },
  { href: "/tapbench", label: "TAPBench" },
] as const;

const TOP_LINKS = [
  { href: "/vision", label: "Vision" },
  { href: "/science", label: "Science" },
] as const;

function PrimaryCta({ compact = false }: { compact?: boolean }) {
  return (
    <TrackedCtaLink
      href={CTA_HREF}
      label={CTA}
      location="nav"
      page="/"
      className={`inline-flex items-center justify-center rounded-sm bg-white font-medium text-black transition hover:bg-zinc-200 ${
        compact ? "px-4 py-2 text-sm" : "min-h-12 px-5 py-3 text-sm"
      }`}
    />
  );
}

type LandingNavProps = {
  overlay?: boolean;
};

export function LandingNav({ overlay = false }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const communityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!communityOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!communityRef.current?.contains(event.target as Node)) {
        setCommunityOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCommunityOpen(false);
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
          : "sticky top-0 border-b border-zinc-900 bg-[#0a0a0a]/86"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="transition hover:opacity-90">
          <BrandLogo nameClassName="text-base font-semibold tracking-tight text-white" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex" aria-label="Main navigation">
          <Link href="/#platform" className="transition hover:text-white">
            Platform
          </Link>
          <Link href="/pricing" className="transition hover:text-white">
            Pricing
          </Link>
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
              onClick={() => setCommunityOpen((open) => !open)}
            >
              Projects & Community
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
                aria-label="Projects & Community"
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
          <PrimaryCta compact />
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
            <li>
              <Link href="/#platform" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Platform
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Pricing
              </Link>
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
                Projects & Community
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
            <li className="pt-2">
              <PrimaryCta compact />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
