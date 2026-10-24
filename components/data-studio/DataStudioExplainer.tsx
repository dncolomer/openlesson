"use client";

import {
  dataStudioExplainer,
  type DataStudioExplainerFigureId,
} from "@/lib/data-studio-explainer";
import type { DataStudioProduct } from "@/lib/data-studio-view";

function WalkFigure() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full" aria-hidden>
      <text x="8" y="16" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="ui-monospace, monospace">
        hidden-state tree
      </text>
      <line x1="40" y1="48" x2="88" y2="108" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" />
      <line x1="40" y1="48" x2="132" y2="108" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="40" cy="48" r="5" fill="#fff" />
      <circle cx="88" cy="108" r="5" fill="#fff" />
      <circle cx="132" cy="108" r="5" fill="none" stroke="rgba(255,255,255,0.55)" />
      <text x="48" y="44" fill="#fff" fontSize="9" fontFamily="ui-monospace, monospace">
        root
      </text>
      <text x="70" y="128" fill="#fff" fontSize="9" fontFamily="ui-monospace, monospace">
        r1 · 10
      </text>
      <text x="118" y="128" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="ui-monospace, monospace">
        r2 · 80
      </text>
      <path d="M148 78 H188" stroke="rgba(255,255,255,0.45)" strokeWidth="1" markerEnd="url(#ds-help-arrow)" />
      <circle cx="228" cy="78" r="6" fill="#fff" />
      <text x="200" y="100" fill="#fff" fontSize="9" fontFamily="ui-monospace, monospace">
        one run
      </text>
      <defs>
        <marker id="ds-help-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="rgba(255,255,255,0.7)" />
        </marker>
      </defs>
    </svg>
  );
}

function SpacesFigure() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full" aria-hidden>
      <rect x="10" y="28" width="120" height="104" fill="none" stroke="rgba(255,255,255,0.22)" />
      <rect x="150" y="28" width="120" height="104" fill="none" stroke="rgba(255,255,255,0.22)" />
      <text x="18" y="20" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="ui-monospace, monospace">
        Path
      </text>
      <text x="158" y="20" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="ui-monospace, monospace">
        Path + text
      </text>
      <circle cx="70" cy="80" r="5" fill="#fff" />
      <circle cx="74" cy="84" r="5" fill="none" stroke="#fff" />
      <text x="44" y="118" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="ui-monospace, monospace">
        same walk
      </text>
      <circle cx="186" cy="70" r="5" fill="#fff" />
      <circle cx="232" cy="96" r="5" fill="none" stroke="#fff" />
      <text x="168" y="118" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="ui-monospace, monospace">
        same walk, different speech
      </text>
    </svg>
  );
}

function OverlayFigure({ product }: { product: DataStudioProduct }) {
  if (product === "learning") {
    return (
      <svg viewBox="0 0 280 150" className="h-full w-full" aria-hidden>
        <circle cx="70" cy="70" r="5" fill="#fff" />
        <circle cx="128" cy="92" r="5" fill="#fff" />
        <circle cx="176" cy="58" r="5" fill="#fff" />
        <circle cx="220" cy="100" r="5" fill="none" stroke="#fff" />
        <text x="78" y="66" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="ui-monospace, monospace">
          you
        </text>
        <text x="136" y="88" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="ui-monospace, monospace">
          you
        </text>
        <text x="16" y="136" fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="ui-monospace, monospace">
          play copies only · no region disk
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full" aria-hidden>
      <circle
        cx="130"
        cy="78"
        r="48"
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.4)"
      />
      <text x="118" y="30" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="ui-monospace, monospace">
        region
      </text>
      <circle cx="118" cy="70" r="4" fill="#fff" />
      <circle cx="142" cy="86" r="4" fill="#fff" />
      <circle cx="126" cy="94" r="4" fill="#fff" />
      <circle cx="214" cy="46" r="4" fill="none" stroke="#fff" />
      <text x="222" y="50" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="ui-monospace, monospace">
        outside
      </text>
    </svg>
  );
}

function InspectFigure() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full" aria-hidden>
      <circle cx="48" cy="78" r="6" fill="#fff" />
      <path d="M58 78 H108" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <rect x="108" y="28" width="156" height="96" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.35)" />
      <text x="118" y="48" fill="#fff" fontSize="9" fontFamily="ui-monospace, monospace">
        identity  ada
      </text>
      <text x="118" y="66" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="ui-monospace, monospace">
        flow_id   flow-a
      </text>
      <text x="118" y="84" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="ui-monospace, monospace">
        speech    spoken proof
      </text>
      <text x="118" y="106" fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="ui-monospace, monospace">
        vector · raw · PoW
      </text>
    </svg>
  );
}

function FigureVisual({
  id,
  product,
}: {
  id: DataStudioExplainerFigureId;
  product: DataStudioProduct;
}) {
  if (id === "walk") return <WalkFigure />;
  if (id === "spaces") return <SpacesFigure />;
  if (id === "overlay") return <OverlayFigure product={product} />;
  return <InspectFigure />;
}

export function DataStudioExplainer({
  product,
  onBack,
}: {
  product: DataStudioProduct;
  onBack: () => void;
}) {
  const copy = dataStudioExplainer(product);
  return (
    <div
      className="absolute inset-0 z-[4] overflow-auto bg-[#070708]/92 px-5 py-4 text-white"
      data-data-studio-explainer=""
      data-data-studio-explainer-product={product}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{copy.kicker}</p>
          <h2 className="mt-1 text-sm font-medium tracking-wide text-white">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-neutral-300">{copy.lede}</p>
        </div>
        <button
          type="button"
          className="border border-white/25 px-2 py-1 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
          onClick={onBack}
          data-data-studio-explainer-back
        >
          Back to map
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {copy.figures.map((figure) => (
          <section
            key={figure.id}
            className="border border-white/15 bg-black/40 p-3"
            data-data-studio-explainer-figure={figure.id}
          >
            <div className="h-36 border border-white/10 bg-[#070708]">
              <FigureVisual id={figure.id} product={product} />
            </div>
            <h3 className="mt-3 text-[11px] uppercase tracking-wide text-white">{figure.title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{figure.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-neutral-500">{copy.controls}</p>
    </div>
  );
}
