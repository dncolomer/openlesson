"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { DASHBOARD_KNOWLEDGE_REGIONS_PATH } from "@/lib/dashboard-knowledge-regions";
import { DASHBOARD_FLOWS_PATH } from "@/lib/product-flow";
import {
  knowledgeRegionCreateOffersFlowSelect,
  productFlowNewPath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";

type FlowChoice = { id: string; name: string; title?: string };

export function KnowledgeRegionCreate({ kind }: { kind: ProductFlowKind }) {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowChoice[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const productLabel = kind === "calibration" ? "Calibration" : "Verification";
  const offer = knowledgeRegionCreateOffersFlowSelect(flows.length);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DASHBOARD_FLOWS_PATH}?kind=${kind}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not load flows"));
        const listed = Array.isArray(payload.flows) ? payload.flows : [];
        if (!cancelled) {
          setFlows(
            listed.map((flow: { id?: string; name?: string; title?: string }) => ({
              id: String(flow.id || ""),
              name: String(flow.name || flow.title || "Flow"),
              title: flow.title,
            })),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load flows");
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  async function create() {
    if (!selectedFlowId || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(DASHBOARD_KNOWLEDGE_REGIONS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: name.trim(), flowId: selectedFlowId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.regionPath) {
        throw new Error(errorMessageFromBody(payload, "Could not create knowledge region"));
      }
      router.push(String(payload.regionPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create knowledge region");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductSurface label={`${productLabel} knowledge region`}>
      <div className="space-y-6" data-knowledge-region-create={kind}>
        <Link href={`/dashboard?tab=${kind}_regions`} className="text-xs text-neutral-400 underline">
          Back to knowledge regions
        </Link>
        <h1 className="text-3xl font-medium tracking-[-1.2px] text-white">Create knowledge region</h1>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <section className="space-y-3" data-region-create-from-flow>
          <p className="text-sm text-neutral-400">
            Select existing {productLabel.toLowerCase()} flows, or create a flow first.
          </p>
          {offer.needsCreateFlowFirst ? (
            <Link
              href={productFlowNewPath(kind)}
              data-create-flow-first=""
              className="inline-flex h-12 items-center justify-center bg-white px-6 text-sm font-medium text-black"
            >
              Create a Flow
            </Link>
          ) : (
            <>
              <select
                value={selectedFlowId}
                onChange={(event) => setSelectedFlowId(event.target.value)}
                data-region-flow-select
                className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              >
                <option value="">Select a flow</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
              <Link
                href={productFlowNewPath(kind)}
                data-create-flow-first=""
                className="text-xs text-neutral-300 underline"
              >
                Create a Flow
              </Link>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Region name"
                data-region-name-input
                className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                disabled={busy || !name.trim() || !selectedFlowId}
                onClick={() => void create()}
                data-create-region-from-flow
                className="bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
              >
                Create from flow
              </button>
            </>
          )}
        </section>
      </div>
    </ProductSurface>
  );
}
