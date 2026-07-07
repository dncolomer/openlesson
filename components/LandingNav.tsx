"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { TrackedCtaLink } from "@/components/TrackedCtaLink";

const CTA = "Create your Verification Workspace";
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
          <Link href="/#products" className="transition hover:text-white">
            Products
          </Link>
          <Link href="/#how" className="transition hover:text-white">
            How it works
          </Link>
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
            <li>
              <Link href="/#products" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                Products
              </Link>
            </li>
            <li>
              <Link href="/#how" className="block rounded-sm px-2 py-2 text-zinc-300" onClick={() => setMobileOpen(false)}>
                How it Works
              </Link>
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