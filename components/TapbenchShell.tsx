"use client";

import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

export function TapbenchShell(props: {
  children: ReactNode;
  landing?: boolean;
}) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-tapbench-project-landing={props.landing ? true : undefined}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <LandingNav />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-10 pb-16">{props.children}</div>
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
