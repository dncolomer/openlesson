import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";

export function MarketingPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen border border-white/40 bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700">
      <PublicPageField />
      <PublicConsoleWash />
      <LandingNav />
      {children}
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  id,
  mark = true,
}: {
  eyebrow: string;
  title: string;
  id?: string;
  mark?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      </div>
      <h2
        id={id}
        className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl"
      >
        {title}
      </h2>
    </div>
  );
}
