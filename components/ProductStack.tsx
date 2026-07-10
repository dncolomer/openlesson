import Link from "next/link";
import { ArrowRight, Bot, BrainCircuit, Layers, User } from "lucide-react";
import {
  AGENT_COLUMN_PRODUCTS,
  HUMAN_COLUMN_PRODUCTS,
  TIM_FOUNDATION,
  WORKSPACE_FOUNDATION,
  type AudienceProductCopy,
  type ProductDefinition,
} from "@/lib/seo/products";

type ProductStackProps = {
  variant?: "landing" | "compact";
  showFoundation?: boolean;
};

function ProductCard({
  product,
  copy,
  compact,
}: {
  product: ProductDefinition;
  copy: AudienceProductCopy;
  compact: boolean;
}) {
  const upcoming = product.status === "upcoming";

  return (
    <div
      className={`flex flex-col border transition ${
        upcoming
          ? "border-dashed border-zinc-800/50 bg-zinc-950/35"
          : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
      } ${compact ? "p-5" : "p-6"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`font-mono text-[10px] uppercase tracking-[1.5px] ${
            upcoming ? "text-zinc-600/70" : "text-zinc-600"
          }`}
        >
          {product.eyebrow}
        </div>
        {upcoming && (
          <span className="rounded-sm border border-white/20 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-white">
            Upcoming
          </span>
        )}
      </div>
      <h3
        className={`mt-2 font-medium ${compact ? "text-base" : "text-lg"} ${
          upcoming ? "text-zinc-500" : "text-white"
        }`}
      >
        {product.title}
      </h3>
      <p
        className={`mt-3 flex-1 leading-relaxed ${compact ? "text-sm" : "text-sm"} ${
          upcoming ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        {copy.summary}
      </p>
      <ul
        className={`mt-4 space-y-2 ${compact ? "text-xs" : "text-sm"} ${
          upcoming ? "text-zinc-700" : "text-zinc-500"
        }`}
      >
        {copy.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className={upcoming ? "text-zinc-700" : "text-zinc-600"}>—</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {upcoming ? (
        <p
          className={`mt-5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-700 ${
            compact ? "text-xs" : ""
          }`}
        >
          Coming soon
        </p>
      ) : (
        copy.href &&
        copy.ctaLabel && (
          <Link
            href={copy.href}
            className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200 transition hover:text-white ${
              compact ? "text-xs" : ""
            }`}
          >
            {copy.ctaLabel}
            <ArrowRight size={14} />
          </Link>
        )
      )}
    </div>
  );
}

function AudienceColumn({
  title,
  icon: Icon,
  products,
  getCopy,
  compact,
}: {
  title: string;
  icon: typeof User;
  products: ProductDefinition[];
  getCopy: (product: ProductDefinition) => AudienceProductCopy;
  compact: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/80">
          <Icon className="text-white" size={15} />
        </div>
        <h3 className={`font-medium text-white ${compact ? "text-base" : "text-lg"}`}>{title}</h3>
      </div>
      <div className="space-y-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} copy={getCopy(product)} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function ProductStack({ variant = "landing", showFoundation = true }: ProductStackProps) {
  const compact = variant === "compact";

  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      {showFoundation && (
        <div className={compact ? "space-y-4" : "space-y-5"}>
          <div
            className={`border border-zinc-800 bg-zinc-950/70 ${
              compact ? "p-5" : "p-6 sm:p-8"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/80">
                <Layers className="text-white" size={18} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
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
                      <span className="text-zinc-600">—</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div
            className={`border border-zinc-800 bg-zinc-950/70 ${
              compact ? "p-5" : "p-6 sm:p-8"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/80">
                <BrainCircuit className="text-white" size={18} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  {TIM_FOUNDATION.eyebrow}
                </div>
                <h3 className={`mt-2 font-medium text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
                  {TIM_FOUNDATION.title}
                </h3>
                <p className={`mt-3 leading-relaxed text-zinc-400 ${compact ? "text-sm" : "text-base"}`}>
                  {TIM_FOUNDATION.summary}
                </p>
                <ul className={`mt-4 space-y-2 text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}>
                  {TIM_FOUNDATION.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="text-zinc-600">—</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2 lg:gap-8"}`}>
        <AudienceColumn
          title="For humans"
          icon={User}
          products={HUMAN_COLUMN_PRODUCTS}
          getCopy={(product) => product.forHuman!}
          compact={compact}
        />
        <AudienceColumn
          title="For agents"
          icon={Bot}
          products={AGENT_COLUMN_PRODUCTS}
          getCopy={(product) => product.forAgent!}
          compact={compact}
        />
      </div>
    </div>
  );
}