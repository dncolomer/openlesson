import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { PRODUCTS, WORKSPACE_FOUNDATION } from "@/lib/seo/products";

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

      <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
        {PRODUCTS.map((product) => (
          <div
            key={product.id}
            className={`flex flex-col border border-zinc-800 bg-zinc-950/70 transition hover:border-zinc-700 ${
              compact ? "p-5" : "p-6"
            }`}
          >
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
              {product.eyebrow}
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
            {product.href && product.ctaLabel && (
              <Link
                href={product.href}
                className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white ${
                  compact ? "text-xs" : ""
                }`}
              >
                {product.ctaLabel}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}