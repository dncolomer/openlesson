"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LearningModelSizePicker } from "@/components/learning-model/LearningModelSizePicker";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
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

export function ProductFlowWizard({ kind }: { kind: ProductFlowKind }) {
  const router = useRouter();
  const [step, setStep] = useState<ProductFlowWizardStep>("name");
  const [draft, setDraft] = useState<ProductFlowDraft>(() => emptyProductFlowDraft(kind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const productLabel = kind === "calibration" ? "Calibration" : "Verification";
  const canAdvance = productFlowWizardCanAdvance(step, draft);
  const catalog = parseLearningModelSize(draft.actionCatalog);

  const stepIndex = PRODUCT_FLOW_WIZARD_STEPS.indexOf(step);
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

  return (
    <ProductSurface label={`${productLabel} flow`}>
      <div
        className="space-y-6"
        data-flow-wizard=""
        data-flow-wizard-kind={kind}
        data-flow-wizard-step={step}
      >
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Step {stepIndex + 1} of {PRODUCT_FLOW_WIZARD_STEPS.length} · {step}
        </p>
        <h1 className="text-3xl font-medium tracking-[-1.2px] text-white">{heading}</h1>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {step === "name" ? (
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Flow name"
            data-flow-name=""
            className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
          />
        ) : null}

        {step === "author" && kind === "verification" ? (
          <section className="space-y-3 border border-neutral-800 p-4" data-verification-flow-editor>
            <input
              value={draft.topic}
              onChange={(event) => patch({ topic: event.target.value })}
              placeholder="Topic"
              data-verification-flow-topic
              className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              disabled={busy || !draft.topic.trim()}
              onClick={() => void generateQuestions()}
              data-verification-generate-from-topic
              className="border border-white/80 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "Generating…" : "Generate questions from this topic"}
            </button>
            <LearningModelSizePicker
              name="verification-flow-learning-model"
              value={catalog}
              onChange={(value: LearningModelSize) => patch({ actionCatalog: value })}
              disabled={busy}
            />
            <div className="space-y-2" data-verification-flow-pool>
              {draft.questions.map((value, index) => (
                <input
                  key={index}
                  value={value}
                  onChange={(event) => setQuestion(index, event.target.value)}
                  placeholder={`Starting question ${index + 1}`}
                  data-verification-flow-question
                  className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                />
              ))}
              <button
                type="button"
                data-verification-flow-add-question
                className="text-[11px] text-neutral-300 underline"
                onClick={() => patch({ questions: [...draft.questions, ""] })}
              >
                Add question
              </button>
            </div>
          </section>
        ) : null}

        {step === "author" && kind === "calibration" ? (
          <section className="space-y-3 border border-neutral-800 p-4" data-calibration-flow-editor>
            <textarea
              value={draft.goal}
              onChange={(event) => patch({ goal: event.target.value })}
              placeholder="Goal"
              data-calibration-flow-goal
              rows={3}
              className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              disabled={busy || !draft.goal.trim()}
              onClick={() => void generateQuestions()}
              data-calibration-generate-from-goal
              className="border border-white/80 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "Generating…" : "Generate questions from this goal"}
            </button>
            <label className="flex items-center gap-3 text-xs text-neutral-300">
              Countdown
              <select
                value={draft.durationMinutes}
                data-calibration-flow-minutes
                onChange={(event) =>
                  patch({ durationMinutes: flowCountdownMinutes(event.target.value) })
                }
                className="border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white"
              >
                {FLOW_COUNTDOWN_MINUTES.map((value) => (
                  <option key={value} value={value}>
                    {value} min
                  </option>
                ))}
              </select>
            </label>
            <LearningModelSizePicker
              name="calibration-flow-learning-model"
              value={catalog}
              onChange={(value: LearningModelSize) => patch({ actionCatalog: value })}
              disabled={busy}
            />
            <div className="space-y-2" data-calibration-flow-pool>
              {draft.questions.map((value, index) => (
                <textarea
                  key={index}
                  value={value}
                  onChange={(event) => setQuestion(index, event.target.value)}
                  placeholder={`Question ${index + 1}`}
                  data-calibration-flow-question
                  rows={2}
                  className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                />
              ))}
              <button
                type="button"
                data-calibration-flow-add-question
                className="text-[11px] text-neutral-300 underline"
                onClick={() => patch({ questions: [...draft.questions, ""] })}
              >
                Add question
              </button>
            </div>
          </section>
        ) : null}

        {step === "publish" ? (
          <section className="space-y-3 border border-neutral-800 p-4" data-flow-publish-review>
            <p className="text-sm text-white" data-flow-name>
              {draft.name}
            </p>
            <p className="text-xs text-neutral-400">
              {kind === "calibration" ? draft.goal : draft.topic}
            </p>
            <p className="text-xs text-neutral-500">
              {draft.questions.filter((item) => item.trim()).length} questions · {catalog} actions
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step !== "name" ? (
            <button
              type="button"
              className="border border-white/40 px-4 py-2 text-sm text-white"
              onClick={() => setStep(previousProductFlowWizardStep(step))}
            >
              Back
            </button>
          ) : (
            <Link href={productFlowDashboardPath(kind)} className="border border-white/40 px-4 py-2 text-sm text-white">
              Cancel
            </Link>
          )}
          {step === "publish" ? (
            <button
              type="button"
              disabled={busy || !canAdvance}
              onClick={() => void publish()}
              data-flow-publish=""
              className="bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Publish
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !canAdvance}
              onClick={() => setStep(nextProductFlowWizardStep(step))}
              className="bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </ProductSurface>
  );
}
