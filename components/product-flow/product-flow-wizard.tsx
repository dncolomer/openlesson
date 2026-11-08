"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  acceptProductFlowPublish,
  DASHBOARD_FLOWS_PATH,
  emptyProductFlowDraft,
  nextProductFlowWizardStep,
  previousProductFlowWizardStep,
  PRODUCT_FLOW_WIZARD_STEPS,
  productFlowDashboardPath,
  productFlowProblem,
  productFlowWizardCanAdvance,
  type ProductFlowDraft,
  type ProductFlowKind,
  type ProductFlowWizardStep,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_FORM_INPUT,
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
  FlowWizardSteps,
} from "@/components/product-flow/product-flow-form";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";

function wizardDescription(kind: ProductFlowKind, step: ProductFlowWizardStep): string {
  if (step === "name") return "A short name for the dashboard list and the public run.";
  if (step === "publish") {
    return "Review, then publish. The public run asks for identification first.";
  }
  if (kind === "calibration") return "Problem, optional files, and countdown.";
  return "The problem learners work on, and optional files used to generate the unsys model.";
}

export function ProductFlowWizard({ kind }: { kind: ProductFlowKind }) {
  const router = useRouter();
  const [step, setStep] = useState<ProductFlowWizardStep>("name");
  const [draft, setDraft] = useState<ProductFlowDraft>(() => emptyProductFlowDraft(kind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const productLabel =
    kind === "calibration" ? "Calibration" : kind === "solve" ? "Solve" : "Verification";
  const canAdvance = productFlowWizardCanAdvance(step, draft);
  const problem = productFlowProblem(draft);

  const heading = useMemo(() => {
    if (step === "name") return `Name this ${productLabel.toLowerCase()} flow`;
    if (step === "author") return `Author the ${productLabel.toLowerCase()} flow`;
    return `Publish ${draft.name.trim() || "this flow"}`;
  }, [draft.name, productLabel, step]);

  function patch(next: Partial<ProductFlowDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function setProblem(value: string) {
    patch({ topic: value, goal: value });
  }

  async function publish() {
    const accepted = acceptProductFlowPublish(draft);
    if (!accepted.ok) {
      setError(accepted.reason);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(DASHBOARD_FLOWS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: accepted.name,
          topic: accepted.topic,
          goal: accepted.goal,
          problem: accepted.topic,
          artifacts: accepted.artifacts,
          actionCatalog: accepted.actionCatalog,
          durationMinutes: accepted.durationMinutes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not publish flow"));
      }
      router.push(productFlowDashboardPath(kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish flow");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <div className="flex flex-wrap gap-3 pt-2">
      {step !== "name" ? (
        <button
          type="button"
          className={FLOW_SECONDARY_BTN}
          onClick={() => setStep(previousProductFlowWizardStep(step))}
        >
          Back
        </button>
      ) : (
        <button
          type="button"
          className={FLOW_SECONDARY_BTN}
          onClick={() => router.push(productFlowDashboardPath(kind))}
        >
          Cancel
        </button>
      )}
      {step === "publish" ? (
        <button
          type="button"
          disabled={busy || !canAdvance}
          onClick={() => void publish()}
          data-flow-publish=""
          className={FLOW_PRIMARY_BTN}
        >
          Publish
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !canAdvance}
          onClick={() => setStep(nextProductFlowWizardStep(step))}
          className={FLOW_PRIMARY_BTN}
        >
          Continue
        </button>
      )}
    </div>
  );

  return (
    <ProductSurface
      label={`${productLabel} flow`}
      activeTab={dashboardTabForProductSurface(kind)}
    >
      <div
        className="mx-auto w-full max-w-3xl space-y-6"
        data-flow-wizard=""
        data-flow-wizard-kind={kind}
        data-flow-wizard-step={step}
      >
        <FlowFormHeader
          kicker={<FlowWizardSteps steps={PRODUCT_FLOW_WIZARD_STEPS} current={step} />}
          title={heading}
          description={wizardDescription(kind, step)}
        />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {step === "name" ? (
          <FlowFormCard>
            <FlowField label="Flow name">
              <input
                value={draft.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Flow name"
                data-flow-name=""
                className={FLOW_FORM_INPUT}
              />
            </FlowField>
            {actions}
          </FlowFormCard>
        ) : null}

        {step === "author" ? (
          <FlowFormCard
            data-flow-problem=""
            data-solve-flow-editor={kind === "solve" ? "" : undefined}
            data-verification-flow-editor={kind === "verification" ? "" : undefined}
            data-calibration-flow-editor={kind === "calibration" ? "" : undefined}
          >
            <FlowProblemFields
              problem={problem}
              onProblemChange={setProblem}
              artifacts={draft.artifacts}
              onArtifactsChange={(artifacts) => patch({ artifacts })}
              topicHook={kind}
            />
            {kind === "calibration" ? (
              <FlowField label="Countdown">
                <select
                  value={draft.durationMinutes}
                  data-calibration-flow-minutes
                  onChange={(event) =>
                    patch({ durationMinutes: flowCountdownMinutes(event.target.value) })
                  }
                  className={FLOW_FORM_INPUT}
                >
                  {FLOW_COUNTDOWN_MINUTES.map((value) => (
                    <option key={value} value={value}>
                      {value} min
                    </option>
                  ))}
                </select>
              </FlowField>
            ) : null}
            {actions}
          </FlowFormCard>
        ) : null}

        {step === "publish" ? (
          <FlowFormCard data-flow-publish-review="">
            <div className="space-y-3">
              <p className="text-lg font-medium tracking-[-0.4px] text-white" data-flow-name>
                {draft.name}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-400">
                {problem}
              </p>
              {draft.artifacts.length ? (
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  {draft.artifacts.length} artifact{draft.artifacts.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            {actions}
          </FlowFormCard>
        ) : null}
      </div>
    </ProductSurface>
  );
}
