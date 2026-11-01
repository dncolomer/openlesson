"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildVerificationFlowSkillMarkdown,
  verificationFlowSkillFilename,
} from "@/lib/verification-flow";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  DASHBOARD_FLOWS_PATH,
  productFlowDashboardPath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_DANGER_BTN,
  FLOW_FORM_INPUT,
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { CopyFlowUrlButton } from "@/components/product-flow/copy-flow-url-button";

type LoadedFlow = {
  id: string;
  name: string;
  topic?: string;
  goal?: string;
  questions: Array<{ id?: string; text?: string }>;
  durationMinutes?: number;
  publicToken: string;
  workspaceId: string;
};

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProductFlowPage({
  kind,
  flowId,
}: {
  kind: ProductFlowKind;
  flowId: string;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<LoadedFlow | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [draftQuestions, setDraftQuestions] = useState<string[]>([""]);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const productLabel =
    kind === "calibration" ? "Calibration" : kind === "solve" ? "Solve" : "Verification";

  const load = useCallback(async () => {
    const response = await fetch(`${DASHBOARD_FLOWS_PATH}/${encodeURIComponent(flowId)}?kind=${kind}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(errorMessageFromBody(payload, "Could not load flow"));
      return;
    }
    const next = payload.flow as LoadedFlow;
    setFlow(next);
    setName(String(next.name || payload.name || ""));
    setTopic(String(next.topic || ""));
    setGoal(String(next.goal || ""));
    setMinutes(flowCountdownMinutes(next.durationMinutes));
    setDraftQuestions(
      Array.isArray(next.questions) && next.questions.length
        ? next.questions.map((question) => String(question.text || ""))
        : [""],
    );
    setPublicUrl(String(payload.publicUrl || ""));
  }, [flowId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_FLOWS_PATH}/${encodeURIComponent(flow.id)}?kind=${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "solve"
            ? { action: "update", name, topic, durationMinutes: minutes }
            : {
                action: "update",
                name,
                topic,
                goal,
                questions: draftQuestions.map((text, index) => ({ id: `q-${index + 1}`, text })),
                durationMinutes: minutes,
              },
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not save flow"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save flow");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_FLOWS_PATH}/${encodeURIComponent(flow.id)}?kind=${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(errorMessageFromBody(payload, "Could not remove flow"));
      }
      router.push(`/dashboard?tab=${kind}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove flow");
      setBusy(false);
    }
  }

  const description =
    kind === "calibration"
      ? "Goal, countdown, and sounding questions."
      : kind === "solve"
        ? "The topic learners work on in the Solve canvas."
        : "Topic, starting questions, and the public run link.";

  return (
    <ProductSurface
      label={`${productLabel} flow`}
      activeTab={dashboardTabForProductSurface(kind)}
    >
      <div
        className="mx-auto w-full max-w-3xl space-y-6"
        data-product-flow-page={kind}
        data-verification-flows-panel={kind === "verification" ? "" : undefined}
        data-calibration-flows-panel={kind === "calibration" ? "" : undefined}
        data-solve-flows-panel={kind === "solve" ? "" : undefined}
      >
        <FlowFormHeader
          backHref={productFlowDashboardPath(kind)}
          title={name || productLabel}
          description={description}
          extra={
            publicUrl ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <p
                  className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-400"
                  data-verification-flow-public-link={kind === "verification" ? "" : undefined}
                  data-calibration-flow-public-link={kind === "calibration" ? "" : undefined}
                  data-solve-flow-public-link={kind === "solve" ? "" : undefined}
                >
                  {publicUrl}
                </p>
                <CopyFlowUrlButton url={publicUrl} />
              </div>
            ) : null
          }
        />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <FlowFormCard>
          <FlowField label="Flow name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Flow name"
              data-flow-name=""
              className={FLOW_FORM_INPUT}
            />
          </FlowField>

          {kind === "verification" ? (
            <section className="space-y-5" data-verification-flow-editor>
              <FlowField label="Topic">
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Topic"
                  data-verification-flow-topic
                  className={FLOW_FORM_INPUT}
                />
              </FlowField>
              <div className="space-y-3" data-verification-flow-pool>
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                  Starting questions
                </p>
                {draftQuestions.map((value, index) => (
                  <input
                    key={index}
                    value={value}
                    onChange={(event) => {
                      const next = draftQuestions.slice();
                      next[index] = event.target.value;
                      setDraftQuestions(next);
                    }}
                    placeholder={`Starting question ${index + 1}`}
                    data-verification-flow-question
                    className={FLOW_FORM_INPUT}
                  />
                ))}
                <button
                  type="button"
                  data-verification-flow-add-question
                  className={FLOW_GHOST_BTN}
                  onClick={() => setDraftQuestions([...draftQuestions, ""])}
                >
                  Add question
                </button>
              </div>
            </section>
          ) : kind === "solve" ? (
            <section className="space-y-5" data-solve-flow-editor>
              <FlowField label="Topic">
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Topic"
                  data-solve-flow-topic
                  className={FLOW_FORM_INPUT}
                />
              </FlowField>
            </section>
          ) : (
            <section className="space-y-5" data-calibration-flow-editor>
              <FlowField label="Goal">
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Goal"
                  data-calibration-flow-goal
                  rows={3}
                  className={FLOW_FORM_TEXTAREA}
                />
              </FlowField>
              <FlowField label="Countdown">
                <select
                  value={minutes}
                  data-calibration-flow-minutes
                  onChange={(event) => setMinutes(flowCountdownMinutes(event.target.value))}
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
                {draftQuestions.map((value, index) => (
                  <textarea
                    key={index}
                    value={value}
                    onChange={(event) => {
                      const next = draftQuestions.slice();
                      next[index] = event.target.value;
                      setDraftQuestions(next);
                    }}
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
                  onClick={() => setDraftQuestions([...draftQuestions, ""])}
                >
                  Add question
                </button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className={FLOW_PRIMARY_BTN}
            >
              Save flow
            </button>
            {kind === "verification" && flow ? (
              <button
                type="button"
                data-verification-flow-skill
                className={FLOW_GHOST_BTN}
                onClick={() => {
                  const skill = buildVerificationFlowSkillMarkdown({
                    workspaceId: flow.workspaceId,
                    flowId: flow.id,
                    topic: topic || name,
                    questions: draftQuestions
                      .map((text) => text.trim())
                      .filter(Boolean)
                      .map((text, index) => ({ id: `q-${index + 1}`, text })),
                    publicToken: flow.publicToken,
                    baseUrl: window.location.origin,
                  });
                  downloadText(
                    verificationFlowSkillFilename(topic || name),
                    skill,
                    "text/markdown;charset=utf-8",
                  );
                }}
              >
                Generate skill
              </button>
            ) : null}
            <button
              type="button"
              data-verification-flow-remove={kind === "verification" ? "" : undefined}
              data-calibration-flow-remove={kind === "calibration" ? "" : undefined}
              data-solve-flow-remove={kind === "solve" ? "" : undefined}
              className={FLOW_DANGER_BTN}
              onClick={() => void remove()}
            >
              Remove
            </button>
          </div>
        </FlowFormCard>
      </div>
    </ProductSurface>
  );
}
