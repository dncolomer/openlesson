"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  parseProductFlowKind,
  PRODUCT_FLOW_KINDS,
  productFlowKindLabel,
  productFlowNewPath,
  productRegionDashboardPath,
  productRegionPagePath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_FORM_INPUT,
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
  PRODUCT_CREATE_SHELL,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
  FlowWizardSteps,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import {
  DASHBOARD_REGION_SIMULATION_JOBS_PATH,
  DASHBOARD_REGION_SIMULATION_PATH,
  matchSimulationFlows,
  nextRegionSimulationWizardStep,
  parseCustomExplorationStrategy,
  previousRegionSimulationWizardStep,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_FLOW_MATCH_LIMIT,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
  REGION_SIMULATION_WIZARD_STEPS,
  regionSimulationWizardCanAdvance,
  regionSimulationProgressOverall,
  type ExplorationStrategyId,
  type RegionSimulationProgress,
  type RegionSimulationWizardStep,
} from "@/lib/region-simulation";
import {
  clampSamplesPerAiUse,
  REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE,
} from "@/lib/region-simulation-ai-use-catalog";
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
  instructions?: string;
  custom?: boolean;
};

type SetupAiUse = {
  id: string;
  displayName: string;
  thinkingLabel: string;
  imageInput: boolean;
  training: "denied" | "allowed";
};

function toggleId<T extends string>(current: readonly T[], id: T): T[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function wizardHeading(step: RegionSimulationWizardStep): string {
  if (step === "name") return "Name this knowledge region";
  if (step === "flows") return "Pick flows";
  if (step === "explore") return "Choose exploration strategies";
  if (step === "ai-use") return "Add AI-use models";
  return "Run the simulation";
}

function wizardDescription(step: RegionSimulationWizardStep, productLabel: string): string {
  if (step === "name") return "A short name for the dashboard list.";
  if (step === "flows") {
    return `Required. Search and pick the ${productLabel.toLowerCase()} flows that supply the problems the agents will solve.`;
  }
  if (step === "explore") {
    return "Clusters describe exploration styles, not a person's ability or worth. Add a custom strategy to use its prompt as the agent instructions.";
  }
  if (step === "ai-use") {
    return "Optional. None are selected by default. Picking a model uses a single seed flow.";
  }
  return `Review the setup, then run. Agents solve the selected ${productLabel.toLowerCase()} problems and the result is an annotated region.`;
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
  kind: lockedKind,
  apiPath = DASHBOARD_REGION_SIMULATION_PATH,
  detailsBasePath,
}: {
  kind?: ProductFlowKind;
  apiPath?: string;
  detailsBasePath?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ProductFlowKind>(lockedKind ?? "solve");
  const [step, setStep] = useState<RegionSimulationWizardStep>("name");
  const productLabel = productFlowKindLabel(kind);
  const [flows, setFlows] = useState<SetupFlow[]>([]);
  const [strategies, setStrategies] = useState<SetupStrategy[]>([]);
  const [name, setName] = useState("");
  const [flowIds, setFlowIds] = useState<string[]>([]);
  const [flowQuery, setFlowQuery] = useState("");
  const [strategyIds, setStrategyIds] = useState<ExplorationStrategyId[]>([]);
  const [customName, setCustomName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [samplesPerStrategy, setSamplesPerStrategy] = useState(REGION_SIMULATION_DEFAULT_SAMPLES);
  const [includeHumanData, setIncludeHumanData] = useState(false);
  const [aiUseCatalog, setAiUseCatalog] = useState<SetupAiUse[]>([]);
  const [aiUseCatalogIds, setAiUseCatalogIds] = useState<string[]>([]);
  const [samplesPerAiUse, setSamplesPerAiUse] = useState(REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<RegionSimulationProgress[]>([]);
  const [result, setResult] = useState<RegionSimulationRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiPath}?kind=${kind}`)
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
        const catalog = Array.isArray(payload.aiUseCatalog) ? payload.aiUseCatalog : [];
        setAiUseCatalog(
          catalog.map((row: SetupAiUse) => ({
            id: String(row.id || ""),
            displayName: String(row.displayName || row.id),
            thinkingLabel: String(row.thinkingLabel || ""),
            imageInput: Boolean(row.imageInput),
            training: row.training === "allowed" ? "allowed" : "denied",
          })),
        );
        setAiUseCatalogIds([]);
        const aiSamples = Number(payload.defaultSamplesPerAiUse);
        if (Number.isFinite(aiSamples)) setSamplesPerAiUse(clampSamplesPerAiUse(aiSamples));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load simulation setup");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, apiPath]);

  useEffect(() => {
    setFlowIds([]);
    setFlowQuery("");
    setCustomName("");
    setCustomInstructions("");
    setStep("name");
  }, [kind]);

  const selectedFlows = useMemo(
    () => flows.filter((flow) => flowIds.includes(flow.id)),
    [flowIds, flows],
  );
  const flowMatches = useMemo(
    () =>
      matchSimulationFlows(
        flows.filter((flow) => !flowIds.includes(flow.id)),
        flowQuery,
        REGION_SIMULATION_FLOW_MATCH_LIMIT,
      ),
    [flowIds, flowQuery, flows],
  );
  const customStrategies = strategies.filter((strategy) => strategy.custom);
  const catalogStrategies = strategies.filter((strategy) => !strategy.custom);
  const realSessionCount = selectedFlows.reduce((sum, flow) => sum + flow.realSessionCount, 0);
  const showHumanOption = realSessionCount > 0;

  useEffect(() => {
    if (!showHumanOption && includeHumanData) setIncludeHumanData(false);
  }, [includeHumanData, showHumanOption]);

  function addFlow(id: string) {
    setFlowIds((current) => {
      if (aiUseCatalogIds.length) return [id];
      return current.includes(id) ? current : [...current, id];
    });
    setFlowQuery("");
  }

  async function pollJob(jobId: string, onProgress: (progress: RegionSimulationProgress[]) => void) {
    for (let i = 0; i < 180; i += 1) {
      const status = await fetch(`${DASHBOARD_REGION_SIMULATION_JOBS_PATH}/${jobId}`);
      const payload = (await status.json().catch(() => ({}))) as Record<string, unknown>;
      if (Array.isArray(payload.progress)) onProgress(payload.progress as RegionSimulationProgress[]);
      const jobStatus = String(payload.status || "");
      if (jobStatus === "done" || jobStatus === "failed") return payload;
      if (jobStatus === "queued" || jobStatus === "running") {
        await fetch(`${DASHBOARD_REGION_SIMULATION_JOBS_PATH}/${jobId}/tick`, { method: "POST" }).catch(
          () => null,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Simulation job timed out");
  }

  function removeFlow(id: string) {
    setFlowIds((current) => current.filter((item) => item !== id));
  }

  function addCustomStrategy() {
    const parsed = parseCustomExplorationStrategy({
      name: customName,
      instructions: customInstructions,
    });
    if (!parsed) return;
    setStrategies((current) =>
      current.some((row) => row.id === parsed.id)
        ? current
        : [
            ...current,
            {
              id: parsed.id,
              name: parsed.name,
              description: parsed.description,
              instructions: parsed.instructions,
              custom: true,
            },
          ],
    );
    setStrategyIds((current) => (current.includes(parsed.id) ? current : [...current, parsed.id]));
    setCustomName("");
    setCustomInstructions("");
  }

  function removeCustomStrategy(id: ExplorationStrategyId) {
    setStrategies((current) => current.filter((row) => row.id !== id));
    setStrategyIds((current) => current.filter((item) => item !== id));
  }

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
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: name.trim(),
          flowIds,
          strategyIds,
          customStrategies: customStrategies
            .filter((strategy) => strategyIds.includes(strategy.id))
            .map((strategy) => ({
              id: strategy.id,
              name: strategy.name,
              instructions: strategy.instructions || "",
              description: strategy.description,
            })),
          samplesPerStrategy,
          includeHumanData: showHumanOption && includeHumanData,
          aiUseCatalogIds,
          samplesPerAiUse,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(errorMessageFromBody(payload, "Could not run simulation"));
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as Record<string, unknown>;
        if (payload.type === "jobs") {
          const jobId = String(payload.jobId || payload.explorationJobId || "");
          if (jobId && apiPath === DASHBOARD_REGION_SIMULATION_PATH) {
            const done = await pollJob(jobId, setProgress);
            const follow = String(done.followUpJobId || payload.aiUseJobId || "");
            if (follow) await pollJob(follow, setProgress);
          }
          setResult({
            persisted: true,
            id: String(payload.regionId || ""),
            regionPath: "",
            parentName: name.trim(),
            clusters: [],
            summary: {
              name: name.trim(),
              flows: selectedFlows.map((flow) => ({ id: flow.id, name: flow.name })),
              strategies: strategies.filter((row) => strategyIds.includes(row.id)),
              samplesPerStrategy,
              simulatedCount: 0,
              realSessionCount: 0,
            },
            progress: Array.isArray(payload.progress)
              ? (payload.progress as RegionSimulationProgress[])
              : progress,
          });
        } else {
          setResult(payload as unknown as RegionSimulationRunResult);
        }
      } else {
        const next = await readSimulationStream(response, setProgress);
        setResult(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run simulation");
    } finally {
      setBusy(false);
    }
  }

  const summary: RegionSimulationSummary | null = result?.summary ?? null;
  const clusters: RegionSimulationClusterResult[] = result?.clusters ?? [];
  const canAdvance = regionSimulationWizardCanAdvance(step, {
    name,
    flowIds,
    strategyIds,
  });
  const selectedStrategies = strategies.filter((row) => strategyIds.includes(row.id));
  const selectedAiUse = aiUseCatalog.filter((row) => aiUseCatalogIds.includes(row.id));

  const actions = (
    <div className="flex flex-wrap gap-3 pt-2">
      {step !== "name" ? (
        <button
          type="button"
          className={FLOW_SECONDARY_BTN}
          disabled={busy}
          onClick={() => setStep(previousRegionSimulationWizardStep(step))}
        >
          Back
        </button>
      ) : (
        <button
          type="button"
          className={FLOW_SECONDARY_BTN}
          onClick={() => router.push(productRegionDashboardPath())}
        >
          Cancel
        </button>
      )}
      {step === "run" ? (
        <button
          type="button"
          disabled={busy || !canAdvance}
          onClick={() => void run()}
          data-run-simulation=""
          className={FLOW_PRIMARY_BTN}
        >
          {busy ? "Running simulation…" : "Run simulation"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !canAdvance}
          onClick={() => setStep(nextRegionSimulationWizardStep(step))}
          className={FLOW_PRIMARY_BTN}
        >
          Continue
        </button>
      )}
    </div>
  );

  return (
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div
        className={PRODUCT_CREATE_SHELL}
        data-knowledge-region-create={kind}
        data-region-simulation-wizard=""
        data-region-simulation-wizard-step={result ? "result" : step}
      >
        <FlowFormHeader
          backHref={productRegionDashboardPath()}
          backLabel="Back to knowledge regions"
          kicker={
            result ? undefined : (
              <FlowWizardSteps steps={REGION_SIMULATION_WIZARD_STEPS} current={step} />
            )
          }
          title={result ? result.parentName : wizardHeading(step)}
          description={
            result
              ? `Simulated exploration styles on the selected ${productLabel.toLowerCase()} flows. Clusters describe how agents searched, not a person's ability.`
              : wizardDescription(step, productLabel)
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
                href={
                  detailsBasePath
                    ? `${detailsBasePath}/${encodeURIComponent(result.id || "")}`
                    : result.regionPath || productRegionPagePath(kind, result.id || "")
                }
                className={FLOW_PRIMARY_BTN}
                data-open-region-details=""
              >
                Open details
              </Link>
            </div>
          </FlowFormCard>
        ) : (
          <FlowFormCard data-region-simulation-setup="">
            {step === "name" ? (
              <div className="grid gap-6 md:grid-cols-2">
                <FlowField label="Type">
                  <select
                    className={FLOW_FORM_INPUT}
                    value={kind}
                    disabled={Boolean(lockedKind)}
                    data-region-kind=""
                    onChange={(event) => {
                      const next = parseProductFlowKind(event.target.value);
                      if (next) setKind(next);
                    }}
                  >
                    {PRODUCT_FLOW_KINDS.map((item) => (
                      <option key={item} value={item}>
                        {productFlowKindLabel(item)}
                      </option>
                    ))}
                  </select>
                </FlowField>
                <FlowField label="Region name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Region name"
                    data-region-name-input
                    className={FLOW_FORM_INPUT}
                  />
                </FlowField>
              </div>
            ) : null}

            {step === "flows" ? (
              flows.length === 0 ? (
                <Link
                  href={productFlowNewPath(kind)}
                  data-create-flow-first=""
                  className={FLOW_PRIMARY_BTN}
                >
                  Create a Flow
                </Link>
              ) : (
                <fieldset className="space-y-2" data-region-simulation-flows="">
                  <legend className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    {productLabel} flows
                  </legend>
                  {selectedFlows.length ? (
                    <ul className="flex flex-wrap gap-2" data-region-simulation-flow-selected="">
                      {selectedFlows.map((flow) => (
                        <li key={flow.id}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 border border-white/40 px-3 py-1.5 text-sm text-white"
                            data-region-simulation-flow={flow.id}
                            onClick={() => removeFlow(flow.id)}
                          >
                            {flow.name}
                            <span className="text-neutral-500">×</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    value={flowQuery}
                    onChange={(event) => setFlowQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const first = flowMatches[0];
                      if (first) addFlow(first.id);
                    }}
                    placeholder="Search flows"
                    data-region-simulation-flow-search=""
                    className={FLOW_FORM_INPUT}
                  />
                  {flowMatches.length ? (
                    <ul className="space-y-2" data-region-simulation-flow-matches="">
                      {flowMatches.map((flow) => (
                        <li key={flow.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 border border-white/20 px-3 py-2 text-left text-sm text-white"
                            data-region-simulation-flow-match={flow.id}
                            onClick={() => addFlow(flow.id)}
                          >
                            <span>
                              {flow.name}
                              <span className="ml-2 text-neutral-500">
                                {flow.questionCount} problem{flow.questionCount === 1 ? "" : "s"}
                                {flow.realSessionCount
                                  ? ` · ${flow.realSessionCount} real session${flow.realSessionCount === 1 ? "" : "s"}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-neutral-500" data-region-simulation-flow-empty="">
                      {flowQuery.trim() ? "No matching flows." : "All matching flows are already selected."}
                    </p>
                  )}
                </fieldset>
              )
            ) : null}

            {step === "explore" ? (
              <>
                <fieldset className="space-y-2" data-region-simulation-strategies="">
                  <legend className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                    Exploration strategies
                  </legend>
                  {catalogStrategies.map((strategy) => (
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
                  {customStrategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      className="flex items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                      data-region-simulation-custom-strategy={strategy.id}
                    >
                      <label className="flex flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={strategyIds.includes(strategy.id)}
                          onChange={() => setStrategyIds(toggleId(strategyIds, strategy.id))}
                          data-region-simulation-strategy={strategy.id}
                        />
                        <span>
                          <span className="block">{strategy.name}</span>
                          <span className="block text-xs text-neutral-400">
                            {strategy.instructions || strategy.description}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        className={FLOW_GHOST_BTN}
                        data-region-simulation-remove-custom={strategy.id}
                        onClick={() => removeCustomStrategy(strategy.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="space-y-2 border border-dashed border-white/20 px-3 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                      Custom strategy
                    </p>
                    <input
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                      placeholder="Strategy name"
                      data-region-simulation-custom-name=""
                      className={FLOW_FORM_INPUT}
                    />
                    <textarea
                      value={customInstructions}
                      onChange={(event) => setCustomInstructions(event.target.value)}
                      placeholder="Prompt for this exploration style"
                      rows={3}
                      data-region-simulation-custom-instructions=""
                      className={FLOW_FORM_TEXTAREA}
                    />
                    <button
                      type="button"
                      disabled={!customName.trim() || !customInstructions.trim()}
                      onClick={addCustomStrategy}
                      data-region-simulation-add-custom=""
                      className={FLOW_GHOST_BTN}
                    >
                      Add strategy
                    </button>
                  </div>
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
              </>
            ) : null}

            {step === "ai-use" ? (
              <fieldset className="space-y-2" data-region-simulation-ai-use="">
                <legend className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  AI-use models
                </legend>
                {aiUseCatalog.map((row) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                  >
                    <input
                      type="checkbox"
                      checked={aiUseCatalogIds.includes(row.id)}
                      onChange={() => {
                        const next = toggleId(aiUseCatalogIds, row.id);
                        setAiUseCatalogIds(next);
                        if (next.length && flowIds.length > 1) setFlowIds(flowIds.slice(0, 1));
                      }}
                      data-region-simulation-ai-use={row.id}
                    />
                    <span>
                      <span className="block">{row.displayName}</span>
                      <span className="block text-xs text-neutral-400">
                        {row.thinkingLabel} · training {row.training}
                      </span>
                    </span>
                  </label>
                ))}
                <FlowField label="Samples per AI-use model">
                  <input
                    type="number"
                    min={3}
                    max={12}
                    value={samplesPerAiUse}
                    onChange={(event) =>
                      setSamplesPerAiUse(clampSamplesPerAiUse(event.target.value))
                    }
                    data-region-simulation-ai-use-samples=""
                    className={FLOW_FORM_INPUT}
                  />
                </FlowField>
              </fieldset>
            ) : null}

            {step === "run" ? (
              <>
                <dl
                  className="grid gap-3 text-sm text-neutral-300 sm:grid-cols-2"
                  data-region-simulation-review=""
                >
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Name</dt>
                    <dd className="mt-1 text-white">{name.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Type</dt>
                    <dd className="mt-1 text-white">{productLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Flows</dt>
                    <dd className="mt-1 text-white">
                      {selectedFlows.map((flow) => flow.name).join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                      Strategies
                    </dt>
                    <dd className="mt-1 text-white">
                      {selectedStrategies.map((row) => row.name).join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                      Samples per strategy
                    </dt>
                    <dd className="mt-1 text-white">{samplesPerStrategy}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                      AI-use models
                    </dt>
                    <dd className="mt-1 text-white">
                      {selectedAiUse.map((row) => row.displayName).join(", ") || "None"}
                    </dd>
                  </div>
                </dl>
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
                  <div className="space-y-4" data-region-simulation-progress="">
                    {(() => {
                      const overall = regionSimulationProgressOverall(progress);
                      return (
                        <div data-region-simulation-progress-overall="">
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                              Run
                            </span>
                            <span className="font-mono text-[10px] text-neutral-400">
                              {overall.done} / {overall.total}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10">
                            <div
                              className="h-1.5 bg-white transition-[width] duration-300"
                              style={{ width: `${overall.percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                    <ul className="space-y-3">
                      {progress.map((row) => {
                        const percent =
                          row.total > 0
                            ? Math.min(100, Math.round((row.done / row.total) * 100))
                            : 0;
                        return (
                          <li
                            key={row.strategyId}
                            className="space-y-1.5"
                            data-region-simulation-progress-row={row.strategyId}
                          >
                            <div className="flex items-baseline justify-between gap-3 text-sm text-neutral-300">
                              <span>{row.strategyName}</span>
                              <span className="font-mono text-[10px] text-neutral-400">
                                {row.done} / {row.total}
                              </span>
                            </div>
                            <div className="h-1 w-full bg-white/10">
                              <div
                                className="h-1 bg-white/80 transition-[width] duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}

            {actions}
          </FlowFormCard>
        )}
      </div>
    </ProductSurface>
  );
}
