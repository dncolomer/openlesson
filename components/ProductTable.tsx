import Link from "next/link";
import { ArrowRight, Blocks, Bot, BrainCircuit, Layers, Mic, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProductTableRow = {
  name: string;
  pitch: string;
  description: string;
  href?: string;
  ctaLabel?: string;
  upcoming?: boolean;
  icon: LucideIcon;
};

export const LANDING_PRODUCT_ROWS: ProductTableRow[] = [
  {
    name: "Workspace",
    icon: Layers,
    pitch: "Foundation for every verification, optimization, and augmentation flow.",
    description:
      "Structure skills and scenarios, attach docs and proof of work, and run every openLesson product against one live learning world model.",
    href: "/workspace/new",
    ctaLabel: "Create workspace",
  },
  {
    name: "Trace Interruption Model",
    icon: BrainCircuit,
    pitch: "The shared model behind every product — not a standalone SKU.",
    description:
      "Trained to predict optimal interruptions on the learning path: when to probe, coach, or request proof instead of waiting for the next linear analytics event.",
    href: "/products/trace-interruption-model",
  },
  {
    name: "Proof-of-Work API",
    icon: Blocks,
    pitch: "Build custom apps on an evolving measurement layer.",
    description:
      "Headless scoring, agentic MCP tools, and TIM-powered interruption hints — the programmable base for verification, optimization, and augmentation you own end to end.",
    href: "/products/proof-of-work-api",
  },
  {
    name: "Think Aloud Protocol",
    icon: Mic,
    pitch: "Live verification links with Socratic probe.",
    description:
      "Candidates and learners think aloud while they work. TIM targets reasoning gaps in the moment — including TAP-cha human checks bots cannot fake.",
    href: "/products/think-aloud-protocol",
  },
  {
    name: "Integrated Learning Environment",
    icon: Sparkles,
    pitch: "Hosted practice when depth beats checkbox tests.",
    description:
      "Coached scenarios wired to verified gaps — a take-home and quiz replacement for complex cognition, with interruptions timed to what the model already knows.",
    href: "/products/integrated-learning-environment",
  },
  {
    name: "Agentic Learning Environment",
    icon: Bot,
    pitch: "Evolve agent skills from real runs.",
    description:
      "Iterate skill.md files and validate tool-use inside your data boundary until deploy readiness clears — same workspace and TIM loop as human products.",
    href: "/products/agentic-learning-environment",
  },
];

function LearnMoreButton({
  href,
  label = "Learn more",
  disabled,
}: {
  href?: string;
  label?: string;
  disabled?: boolean;
}) {
  if (!href || disabled) return null;

  return (
    <Link
      href={href}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-900/80 px-3.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
    >
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}

function ProductRow({ row }: { row: ProductTableRow }) {
  const Icon = row.icon;

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-800/90 px-4 py-5 first:border-t-0 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/80 text-zinc-200">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-white">{row.name}</h3>
            {row.upcoming ? (
              <span className="rounded-sm border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1px] text-zinc-500">
                Soon
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-snug text-zinc-300">{row.pitch}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{row.description}</p>
        </div>
      </div>
      <LearnMoreButton
        href={row.href}
        label={row.ctaLabel ?? "Learn more"}
        disabled={row.upcoming}
      />
    </div>
  );
}

export function ProductTable({ rows = LANDING_PRODUCT_ROWS }: { rows?: ProductTableRow[] }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/70 backdrop-blur-sm">
      <div className="border-b border-zinc-800 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600 sm:px-5">
        Product
      </div>
      {rows.map((row) => (
        <ProductRow key={row.name} row={row} />
      ))}
      <div className="border-t border-zinc-800/90 px-4 py-3 sm:px-5">
        <Link
          href="/use-cases"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          Browse use cases
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}