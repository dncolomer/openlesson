import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import {
  PUBLIC_FIELD_DEFAULT_STILL,
  PublicConsoleWash,
  PublicPageField,
} from "@/components/ui/console-frame";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#0e1c2c] text-white">
      <PublicPageField image={PUBLIC_FIELD_DEFAULT_STILL} />
      <PublicConsoleWash />
      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingNav />
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">404</p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.6px] text-white sm:text-4xl">
              Page not found
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-300">
              The page you requested does not exist.
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="inline-block border border-white/40 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white hover:text-black"
              >
                Back to home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
