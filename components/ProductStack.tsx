import Link from "next/link";
import { ArrowRight, Bot, Layers, User, Users } from "lucide-react";
import { AUDIENCE_LABELS, PRODUCTS, WORKSPACE_FOUNDATION, type ProductAudience } from "@/lib/seo/products";

const AUDIENCE_ICONS: Record<ProductAudience, typeof User> = {
  human: User,
  agent: Bot,
  both: Users,
};

type ProductStackProps = {
  variant?: "landing" | "compact";
  showFoundation?: boolean;
};

export function ProductStack({ variant = "landing", showFoundation = true }: ProductStackProps) {
  const compact = variant === "compact";

  return (
    <div className={compact ? "space-y-6" : "space-y-10"}>
      {showFoundation && (
        <div
          className={`border border-zinc-800 bg-zinc-950/70 ${
            compact ? "p-5" : "p-6 sm:p-8"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-cyan-400/20 bg-cyan-950/30">
              <Layers className="text-cyan-200" size={18} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[2px] text-cyan-300/70">
                {WORKSPACE_FOUNDATION.eyebrow}
              </div>
              <h3 className={`mt-2 font-medium text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
                {WORKSPACE_FOUNDATION.title}
              </h3>
              <p className={`mt-3 leading-relaxed text-zinc-400 ${compact ? "text-sm" : "text-base"}`}>
                {WORKSPACE_FOUNDATION.summary}
              </p>
              <ul className={`mt-4 space-y-2 text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}>
                {WORKSPACE_FOUNDATION.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-cyan-300/60">—</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {PRODUCTS.map((product) => {
          const AudienceIcon = AUDIENCE_ICONS[product.audience];
          const upcoming = product.status === "upcoming";
          return (
            <div
              key={product.id}
              className={`flex flex-col border bg-zinc-950/70 transition ${
                upcoming
                  ? "border-dashed border-zinc-800/90 opacity-90"
                  : "border-zinc-800 hover:border-zinc-700"
              } ${compact ? "p-5" : "p-6"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                  {product.eyebrow}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {upcoming && (
                    <span className="rounded-sm border border-amber-400/25 bg-amber-950/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-amber-200">
                      Upcoming
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] ${
                      product.audience === "agent"
                        ? "border-violet-400/25 bg-violet-950/30 text-violet-200"
                        : product.audience === "both"
                          ? "border-cyan-400/20 bg-cyan-950/25 text-cyan-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    <AudienceIcon size={11} />
                    {AUDIENCE_LABELS[product.audience]}
                  </span>
                </div>
              </div>
              <h3 className={`mt-2 font-medium text-white ${compact ? "text-base" : "text-lg"}`}>
                {product.title}
              </h3>
              <p className={`mt-3 flex-1 leading-relaxed text-zinc-400 ${compact ? "text-sm" : "text-sm"}`}>
                {product.summary}
              </p>
              <ul className={`mt-4 space-y-2 text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}>
                {product.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-cyan-300/60">—</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {upcoming ? (
                <p className={`mt-5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600 ${compact ? "text-xs" : ""}`}>
                  Coming soon
                </p>
              ) : (
                product.href &&
                product.ctaLabel && (
                  <Link
                    href={product.href}
                    className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white ${
                      compact ? "text-xs" : ""
                    }`}
                  >
                    {product.ctaLabel}
                    <ArrowRight size={14} />
                  </Link>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}