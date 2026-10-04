import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { PublicConsoleWash } from "@/components/ui/console-frame";

const DEFAULT_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

export function MarketingPageShell({
  children,
  backgroundImage = DEFAULT_BACKGROUND,
}: {
  children: React.ReactNode;
  backgroundImage?: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden border border-white/40 bg-black text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
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
}: {
  eyebrow: string;
  title: string;
  id?: string;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">{eyebrow}</div>
      <h2
        id={id}
        className="max-w-3xl text-4xl font-medium leading-[1.08] tracking-[-1.8px] text-white sm:text-5xl"
      >
        {title}
      </h2>
    </div>
  );
}
