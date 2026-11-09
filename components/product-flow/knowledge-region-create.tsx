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
import {
  FLOW_FORM_INPUT,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { RegionSimulationSetup } from "@/components/product-flow/region-simulation-setup";

type FlowChoice = { id: string; name: string; title?: string };

export function KnowledgeRegionCreate({ kind }: { kind: ProductFlowKind }) {
  if (kind === "verification") {
    return <RegionSimulationSetup />;
  }
  return <LegacyKnowledgeRegionCreate kind={kind} />;
}

function LegacyKnowledgeRegionCreate({ kind }: { kind: ProductFlowKind }) {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowChoice[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const productLabel =
    kind === "calibration" ? "Calibration" : kind === "solve" ? "Solve" : "Verification";
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
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6" data-knowledge-region-create={kind}>
        <FlowFormHeader
          backHref={`/dashboard?tab=${kind}_regions`}
          backLabel="Back to knowledge regions"
          title="Create knowledge region"
          description={`Attach a region to an existing ${productLabel.toLowerCase()} flow, or create a flow first.`}
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <FlowFormCard data-region-create-from-flow="">
          {offer.needsCreateFlowFirst ? (
            <Link
              href={productFlowNewPath(kind)}
              data-create-flow-first=""
              className={FLOW_PRIMARY_BTN}
            >
              Create a Flow
            </Link>
          ) : (
            <>
              <FlowField label="Flow">
                <select
                  value={selectedFlowId}
                  onChange={(event) => setSelectedFlowId(event.target.value)}
                  data-region-flow-select
                  className={FLOW_FORM_INPUT}
                >
                  <option value="">Select a flow</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
              </FlowField>
              <Link
                href={productFlowNewPath(kind)}
                data-create-flow-first=""
                className={`${FLOW_GHOST_BTN} w-fit`}
              >
                Create a Flow
              </Link>
              <FlowField label="Region name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Region name"
                  data-region-name-input
                  className={FLOW_FORM_INPUT}
                />
              </FlowField>
              <button
                type="button"
                disabled={busy || !name.trim() || !selectedFlowId}
                onClick={() => void create()}
                data-create-region-from-flow
                className={FLOW_PRIMARY_BTN}
              >
                Create from flow
              </button>
            </>
          )}
        </FlowFormCard>
      </div>
    </ProductSurface>
  );
}
