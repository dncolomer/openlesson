"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  productFlowKindLabel,
  productFlowNewPath,
  productRegionPagePath,
  productRegionStudioPath,
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
import {
  DASHBOARD_REGION_SIMULATION_PATH,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
  type ExplorationStrategyId,
  type RegionSimulationProgress,
} from "@/lib/region-simulation";
import type {
  RegionSimulationClusterResult,
  RegionSimulationRunResult,
  RegionSimulationSummary,
} from "@/lib/region-simulation-run";

type SetupFlow = {
  id: string;
  name: string;
  topic?: string;
  questionCount: number;
  realSessionCount: number;
};

type SetupStrategy = {
  id: ExplorationStrategyId;
  name: string;
  description: string;
};

function toggleId<T extends string>(current: readonly T[], id: T): T[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

async function readSimulationStream(
  response: Response,
  onProgress: (progress: RegionSimulationProgress[]) => void,
): Promise<RegionSimulationRunResult> {
  if (!response.body) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (payload.type === "error") {
      throw new Error(String(payload.error || "Could not run simulation"));
    }
    return payload as unknown as RegionSimulationRunResult;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RegionSimulationRunResult | null = null;
  let streamError = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const payload = JSON.parse(trimmed) as Record<string, unknown>;
      if (payload.type === "progress" && Array.isArray(payload.progress)) {
        onProgress(payload.progress as RegionSimulationProgress[]);
      } else if (payload.type === "error") {
        streamError = String(payload.error || "Could not run simulation");
      } else if (payload.type === "result") {
        result = payload as unknown as RegionSimulationRunResult;
      }
    }
    if (done) break;
  }
  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("Simulation finished without a region");
  return result;
}

export function RegionSimulationSetup({
  kind,
}: {
  kind: ProductFlowKind;
}) {
  const productLabel = productFlowKindLabel(kind);
  const [flows, setFlows] = useState<SetupFlow[]>([]);
  const [strategies, setStrategies] = useState<SetupStrategy[]>([]);
  const [name, setName] = useState("");
  const [flowIds, setFlowIds] = useState<string[]>([]);
  const [strategyIds, setStrategyIds] = useState<ExplorationStrategyId[]>([]);
  const [samplesPerStrategy, setSamplesPerStrategy] = useState(REGION_SIMULATION_DEFAULT_SAMPLES);
  const [includeHumanData, setIncludeHumanData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<RegionSimulationProgress[]>([]);
  const [result, setResult] = useState<RegionSimulationRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DASHBOARD_REGION_SIMULATION_PATH}?kind=${kind}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load simulation setup"));
        }
        if (cancelled) return;
        const listedFlows = Array.isArray(payload.flows) ? payload.flows : [];
        const listedStrategies = Array.isArray(payload.strategies) ? payload.strategies : [];
        setFlows(
          listedFlows.map((flow: SetupFlow) => ({
            id: String(flow.id || ""),
            name: String(flow.name || "Flow"),
            topic: flow.topic,
            questionCount: Number(flow.questionCount) || 1,
            realSessionCount: Number(flow.realSessionCount) || 0,
          })),
        );
        setStrategies(
          listedStrategies.map((strategy: SetupStrategy) => ({
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
          })),
        );
        setStrategyIds(
          listedStrategies.map((strategy: SetupStrategy) => strategy.id).filter(Boolean),
        );
        const samples = Number(payload.defaultSamplesPerStrategy);
        if (Number.isFinite(samples)) setSamplesPerStrategy(samples);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load simulation setup");
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const selectedFlows = useMemo(
    () => flows.filter((flow) => flowIds.includes(flow.id)),
    [flowIds, flows],
  );
  const realSessionCount = selectedFlows.reduce((sum, flow) => sum + flow.realSessionCount, 0);
  const showHumanOption = realSessionCount > 0;

  useEffect(() => {
    if (!showHumanOption && includeHumanData) setIncludeHumanData(false);
  }, [includeHumanData, showHumanOption]);

  async function run() {
    if (!name.trim() || !flowIds.length || !strategyIds.length) return;
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(
      strategyIds.map((id) => {
        const strategy = strategies.find((row) => row.id === id);
        return {
          strategyId: id,
          strategyName: strategy?.name || id,
          done: 0,
          total: samplesPerStrategy,
        };
      }),
    );
    try {
      const response = await fetch(DASHBOARD_REGION_SIMULATION_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          flowIds,
          strategyIds,
          samplesPerStrategy,
          includeHumanData: showHumanOption && includeHumanData,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(errorMessageFromBody(payload, "Could not run simulation"));
      }
      const next = await readSimulationStream(response, setProgress);
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run simulation");
    } finally {
      setBusy(false);
    }
  }

  const summary: RegionSimulationSummary | null = result?.summary ?? null;
  const clusters: RegionSimulationClusterResult[] = result?.clusters ?? [];

  return (
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6" data-knowledge-region-create={kind}>
        <FlowFormHeader
          backHref={`/dashboard?tab=${kind}_regions`}
          backLabel="Back to knowledge regions"
          title={result ? result.parentName : "Create knowledge region"}
          description={
            result
              ? `Simulated exploration styles on the selected ${productLabel.toLowerCase()} flows. Clusters describe how agents searched, not a person's ability.`
              : `Creating a region means configuring and running a simulation. Pick ${productLabel.toLowerCase()} flows and exploration strategies; agents solve those problems and the result is an annotated region.`
          }
        />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {result && summary ? (
          <FlowFormCard data-region-simulation-result="">
            <p className="text-sm text-neutral-300" data-region-simulation-origin="simulated">
              Simulated points are always labelled simulated. They are never shown as a real person's result.
            </p>
            <dl className="grid gap-3 text-sm text-neutral-300 sm:grid-cols-2" data-region-simulation-summary="">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Flows</dt>
                <dd className="mt-1 text-white">{summary.flows.map((flow) => flow.name).join(", ")}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Strategies</dt>
                <dd className="mt-1 text-white">{summary.strategies.map((row) => row.name).join(", ")}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  Samples per strategy
                </dt>
                <dd className="mt-1 text-white">{summary.samplesPerStrategy}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  Real sessions included
                </dt>
                <dd className="mt-1 text-white">{summary.realSessionCount}</dd>
              </div>
            </dl>
            <ul className="space-y-2" data-region-simulation-clusters="">
              {clusters.map((cluster) => (
                <li
                  key={cluster.strategyId}
                  className="border border-white/20 px-3 py-2 text-sm text-white"
                  data-region-simulation-cluster={cluster.strategyId}
                >
                  {cluster.name}
                  <span className="ml-2 text-neutral-500">{cluster.sampleCount} simulated</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                href={result.regionPath || productRegionPagePath(kind, result.id || "")}
                className={FLOW_PRIMARY_BTN}
                data-open-region-details=""
              >
                Open details
              </Link>
              <Link
                href={result.studioPath || productRegionStudioPath(kind, result.id || "")}
                className={FLOW_GHOST_BTN}
                data-open-simulated-region=""
              >
                Open in Data Studio
              </Link>
            </div>
          </FlowFormCard>
        ) : (
          <FlowFormCard data-region-simulation-setup="">
            {flows.length === 0 ? (
              <Link
                href={productFlowNewPath(kind)}
                data-create-flow-first=""
                className={FLOW_PRIMARY_BTN}
              >
                Create a Flow
              </Link>
            ) : (
              <>
                <FlowField label="Region name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Region name"
                    data-region-name-input
                    className={FLOW_FORM_INPUT}
                  />
                </FlowField>

                <fieldset className="space-y-2" data-region-simulation-flows="">
                  <legend className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    {productLabel} flows
                  </legend>
                  <p className="text-xs text-neutral-500">
                    Required. These flows supply the problems the agents will solve.
                  </p>
                  {flows.map((flow) => (
                    <label
                      key={flow.id}
                      className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <input
                        type="checkbox"
                        checked={flowIds.includes(flow.id)}
                        onChange={() => setFlowIds(toggleId(flowIds, flow.id))}
                        data-region-simulation-flow={flow.id}
                      />
                      <span>
                        {flow.name}
                        <span className="ml-2 text-neutral-500">
                          {flow.questionCount} problem{flow.questionCount === 1 ? "" : "s"}
                          {flow.realSessionCount
                            ? ` · ${flow.realSessionCount} real session${flow.realSessionCount === 1 ? "" : "s"}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <fieldset className="space-y-2" data-region-simulation-strategies="">
                  <legend className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    Exploration strategies
                  </legend>
                  <p className="text-xs text-neutral-500">
                    Clusters describe exploration styles, not a person's ability or worth.
                  </p>
                  {strategies.map((strategy) => (
                    <label
                      key={strategy.id}
                      className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <input
                        type="checkbox"
                        checked={strategyIds.includes(strategy.id)}
                        onChange={() => setStrategyIds(toggleId(strategyIds, strategy.id))}
                        data-region-simulation-strategy={strategy.id}
                      />
                      <span>
                        <span className="block">{strategy.name}</span>
                        <span className="block text-xs text-neutral-400">{strategy.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <FlowField label="Samples per strategy">
                  <input
                    type="number"
                    min={REGION_SIMULATION_MIN_SAMPLES}
                    max={REGION_SIMULATION_MAX_SAMPLES}
                    value={samplesPerStrategy}
                    onChange={(event) =>
                      setSamplesPerStrategy(
                        Math.max(
                          REGION_SIMULATION_MIN_SAMPLES,
                          Math.min(
                            REGION_SIMULATION_MAX_SAMPLES,
                            Math.round(Number(event.target.value) || REGION_SIMULATION_DEFAULT_SAMPLES),
                          ),
                        ),
                      )
                    }
                    data-region-simulation-samples
                    className={FLOW_FORM_INPUT}
                  />
                </FlowField>

                {showHumanOption ? (
                  <label
                    className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                    data-region-simulation-include-humans=""
                  >
                    <input
                      type="checkbox"
                      checked={includeHumanData}
                      onChange={(event) => setIncludeHumanData(event.target.checked)}
                    />
                    <span>
                      Include data from real humans in these flows
                      <span className="ml-2 text-neutral-500">
                        {realSessionCount} session{realSessionCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </label>
                ) : null}

                {busy && progress.length > 0 ? (
                  <ul className="space-y-2" data-region-simulation-progress="">
                    {progress.map((row) => (
                      <li
                        key={row.strategyId}
                        className="text-sm text-neutral-300"
                        data-region-simulation-progress-row={row.strategyId}
                      >
                        {row.strategyName}: {row.done} / {row.total}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  disabled={busy || !name.trim() || !flowIds.length || !strategyIds.length}
                  onClick={() => void run()}
                  data-run-simulation=""
                  className={FLOW_PRIMARY_BTN}
                >
                  {busy ? "Running simulation…" : "Run simulation"}
                </button>
              </>
            )}
          </FlowFormCard>
        )}
      </div>
    </ProductSurface>
  );
}
