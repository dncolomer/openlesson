"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";
import { SOLUTION_PAGES } from "@/lib/seo/solution-pages";

const CTA = "Create your Performance Workspace";
const CTA_HREF = "/workspace/new";

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

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (solutionsRef.current && !solutionsRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900 bg-[#0a0a0a]/86 px-5 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300">
          openLesson
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex" aria-label="Main navigation">
          <Link href="/platform" className="transition hover:text-white">
            Platform
          </Link>

          <div className="relative" ref={solutionsRef}>
            <button
              type="button"
              onClick={() => setSolutionsOpen((open) => !open)}
              className="inline-flex items-center gap-1 transition hover:text-white"
              aria-expanded={solutionsOpen}
              aria-haspopup="true"
            >
              Solutions
              <ChevronDown className={`size-4 transition-transform ${solutionsOpen ? "rotate-180" : ""}`} />
            </button>
            {solutionsOpen && (
              <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[22rem] rounded-md border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md">
                <div className="grid gap-1">
                  <Link
                    href="/solutions"
                    onClick={() => setSolutionsOpen(false)}
                    className="rounded-sm px-3 py-2.5 transition hover:bg-white/5 border-b border-zinc-800/80 mb-1"
                  >
                    <span className="block text-sm font-medium text-zinc-200">All solutions</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                      Browse every vertical guide
                    </span>
                  </Link>
                  {SOLUTION_PAGES.map((solution) => (
                    <Link
                      key={solution.slug}
                      href={solution.path}
                      onClick={() => setSolutionsOpen(false)}
                      className="rounded-sm px-3 py-2.5 transition hover:bg-white/5"
                    >
                      <span className="block text-sm font-medium text-zinc-200">{solution.navLabel}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                        {solution.navDescription}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a href="#problem" className="transition hover:text-white">
            Why it matters
          </a>
          <a href="#how" className="transition hover:text-white">
            How it Works
          </a>
          <Link href="/pricing" className="transition hover:text-white">
            Pricing
          </Link>
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
              <Link href="/platform" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Platform
              </Link>
            </li>
            <li className="px-2 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">Solutions</li>
            {SOLUTION_PAGES.map((solution) => (
              <li key={solution.slug}>
                <Link
                  href={solution.path}
                  className="block rounded-sm px-2 py-2 text-zinc-400"
                  onClick={() => setMobileOpen(false)}
                >
                  {solution.navLabel}
                </Link>
              </li>
            ))}
            <li>
              <a href="#problem" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Why it matters
              </a>
            </li>
            <li>
              <a href="#how" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                How it Works
              </a>
            </li>
            <li>
              <Link href="/pricing" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Pricing
              </Link>
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