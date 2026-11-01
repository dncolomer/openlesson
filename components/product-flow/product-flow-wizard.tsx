"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  acceptProductFlowPublish,
  DASHBOARD_FLOWS_GENERATE_PATH,
  DASHBOARD_FLOWS_PATH,
  emptyProductFlowDraft,
  nextProductFlowWizardStep,
  previousProductFlowWizardStep,
  PRODUCT_FLOW_WIZARD_STEPS,
  productFlowDashboardPath,
  productFlowWizardCanAdvance,
  type ProductFlowDraft,
  type ProductFlowKind,
  type ProductFlowWizardStep,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_FORM_INPUT,
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
  FlowWizardSteps,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";

function wizardDescription(kind: ProductFlowKind, step: ProductFlowWizardStep): string {
  if (step === "name") return "A short name for the dashboard list and the public run.";
  if (step === "publish") {
    return "Review, then publish. The public run asks for identification first.";
  }
  if (kind === "calibration") return "Goal, countdown, and sounding questions.";
  if (kind === "solve") return "The topic learners work on in the Solve canvas.";
  return "Topic and starting questions. Generate a pool or write your own.";
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

  const heading = useMemo(() => {
    if (step === "name") return `Name this ${productLabel.toLowerCase()} flow`;
    if (step === "author") return `Author the ${productLabel.toLowerCase()} flow`;
    return `Publish ${draft.name.trim() || "this flow"}`;
  }, [draft.name, productLabel, step]);

  function patch(next: Partial<ProductFlowDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function setQuestion(index: number, value: string) {
    const questions = draft.questions.slice();
    questions[index] = value;
    patch({ questions });
  }

  async function generateQuestions() {
    const topic = draft.topic.trim();
    const goal = draft.goal.trim();
    if (kind === "verification" && !topic) return;
    if (kind === "calibration" && !goal) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(DASHBOARD_FLOWS_GENERATE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "calibration" ? { kind, goal } : { kind, topic },
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not generate questions"));
      }
      const questions = Array.isArray(payload.questions)
        ? payload.questions.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];
      if (!questions.length) {
        throw new Error("No questions generated");
      }
      patch({ questions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate questions");
    } finally {
      setBusy(false);
    }
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
          questions: accepted.questions,
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

        {step === "author" && kind === "solve" ? (
          <FlowFormCard data-solve-flow-editor="">
            <FlowField label="Topic">
              <input
                value={draft.topic}
                onChange={(event) => patch({ topic: event.target.value })}
                placeholder="Topic"
                data-solve-flow-topic
                className={FLOW_FORM_INPUT}
              />
            </FlowField>
            {actions}
          </FlowFormCard>
        ) : null}

        {step === "author" && kind === "verification" ? (
          <FlowFormCard data-verification-flow-editor="">
            <FlowField label="Topic">
              <input
                value={draft.topic}
                onChange={(event) => patch({ topic: event.target.value })}
                placeholder="Topic"
                data-verification-flow-topic
                className={FLOW_FORM_INPUT}
              />
            </FlowField>
            <button
              type="button"
              disabled={busy || !draft.topic.trim()}
              onClick={() => void generateQuestions()}
              data-verification-generate-from-topic
              className={FLOW_GHOST_BTN}
            >
              {busy ? "Generating…" : "Generate questions from this topic"}
            </button>
            <div className="space-y-3" data-verification-flow-pool>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                Starting questions
              </p>
              {draft.questions.map((value, index) => (
                <input
                  key={index}
                  value={value}
                  onChange={(event) => setQuestion(index, event.target.value)}
                  placeholder={`Starting question ${index + 1}`}
                  data-verification-flow-question
                  className={FLOW_FORM_INPUT}
                />
              ))}
              <button
                type="button"
                data-verification-flow-add-question
                className={FLOW_GHOST_BTN}
                onClick={() => patch({ questions: [...draft.questions, ""] })}
              >
                Add question
              </button>
            </div>
            {actions}
          </FlowFormCard>
        ) : null}

        {step === "author" && kind === "calibration" ? (
          <FlowFormCard data-calibration-flow-editor="">
            <FlowField label="Goal">
              <textarea
                value={draft.goal}
                onChange={(event) => patch({ goal: event.target.value })}
                placeholder="Goal"
                data-calibration-flow-goal
                rows={3}
                className={FLOW_FORM_TEXTAREA}
              />
            </FlowField>
            <button
              type="button"
              disabled={busy || !draft.goal.trim()}
              onClick={() => void generateQuestions()}
              data-calibration-generate-from-goal
              className={FLOW_GHOST_BTN}
            >
              {busy ? "Generating…" : "Generate questions from this goal"}
            </button>
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
            <div className="space-y-3" data-calibration-flow-pool>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                Questions
              </p>
              {draft.questions.map((value, index) => (
                <textarea
                  key={index}
                  value={value}
                  onChange={(event) => setQuestion(index, event.target.value)}
                  placeholder={`Question ${index + 1}`}
                  data-calibration-flow-question
                  rows={2}
                  className={FLOW_FORM_TEXTAREA}
                />
              ))}
              <button
                type="button"
                data-calibration-flow-add-question
                className={FLOW_GHOST_BTN}
                onClick={() => patch({ questions: [...draft.questions, ""] })}
              >
                Add question
              </button>
            </div>
            {actions}
          </FlowFormCard>
        ) : null}

        {step === "publish" ? (
          <FlowFormCard data-flow-publish-review="">
            <div className="space-y-3">
              <p className="text-lg font-medium tracking-[-0.4px] text-white" data-flow-name>
                {draft.name}
              </p>
              <p className="text-sm leading-relaxed text-neutral-400">
                {kind === "calibration" ? draft.goal : draft.topic}
              </p>
              {kind === "solve" ? null : (
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  {draft.questions.filter((item) => item.trim()).length} questions
                </p>
              )}
            </div>
            {actions}
          </FlowFormCard>
        ) : null}
      </div>
    </ProductSurface>
  );
}
