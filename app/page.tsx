"use client";

import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import {
  LandingCoreSection,
  LandingHeroEditorial,
  LandingProofSection,
  LandingWash,
} from "@/components/marketing/landing-heroes";

export default function B2BLandingPage() {
  return (
    <main className="relative min-h-screen border border-white/40 bg-black text-zinc-200 selection:bg-zinc-700">
      <LandingWash />
      <LandingNav />
      <LandingHeroEditorial />
      <LandingCoreSection />
      <LandingProofSection />
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
