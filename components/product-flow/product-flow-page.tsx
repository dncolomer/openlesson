"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LearningModelSizePicker } from "@/components/learning-model/LearningModelSizePicker";
import {
  buildVerificationFlowSkillMarkdown,
  verificationFlowSkillFilename,
} from "@/lib/verification-flow";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { DASHBOARD_FLOWS_PATH, type ProductFlowKind } from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { CopyFlowUrlButton } from "@/components/product-flow/copy-flow-url-button";

type LoadedFlow = {
  id: string;
  name: string;
  topic?: string;
  goal?: string;
  questions: Array<{ id?: string; text?: string }>;
  actionCatalog?: number;
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
  const [catalog, setCatalog] = useState<LearningModelSize>(4);
  const [minutes, setMinutes] = useState(15);
  const [draftQuestions, setDraftQuestions] = useState<string[]>([""]);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const productLabel = kind === "calibration" ? "Calibration" : "Verification";

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
    setCatalog(parseLearningModelSize(next.actionCatalog));
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
        body: JSON.stringify({
          action: "update",
          name,
          topic,
          goal,
          questions: draftQuestions.map((text, index) => ({ id: `q-${index + 1}`, text })),
          actionCatalog: catalog,
          durationMinutes: minutes,
        }),
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

  return (
    <ProductSurface
      label={`${productLabel} flow`}
      activeTab={dashboardTabForProductSurface(kind)}
    >
      <div
        className="mx-auto w-full max-w-3xl space-y-4"
        data-product-flow-page={kind}
        data-verification-flows-panel={kind === "verification" ? "" : undefined}
        data-calibration-flows-panel={kind === "calibration" ? "" : undefined}
      >
        <Link href={`/dashboard?tab=${kind}`} className="text-xs text-neutral-400 underline">
          Back to flows
        </Link>
        <h1 className="text-3xl font-medium tracking-[-1.2px] text-white">{name || productLabel}</h1>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Flow name"
          data-flow-name=""
          className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
        />

        {kind === "verification" ? (
          <section className="space-y-3 border border-neutral-800 p-4" data-verification-flow-editor>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Topic"
              data-verification-flow-topic
              className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
            <LearningModelSizePicker
              name="verification-flow-learning-model"
              value={catalog}
              onChange={setCatalog}
              disabled={busy}
            />
            <div className="space-y-2" data-verification-flow-pool>
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
                  className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                />
              ))}
              <button
                type="button"
                data-verification-flow-add-question
                className="text-[11px] text-neutral-300 underline"
                onClick={() => setDraftQuestions([...draftQuestions, ""])}
              >
                Add question
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-3 border border-neutral-800 p-4" data-calibration-flow-editor>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Goal"
              data-calibration-flow-goal
              rows={3}
              className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            />
            <label className="flex items-center gap-3 text-xs text-neutral-300">
              Countdown
              <select
                value={minutes}
                data-calibration-flow-minutes
                onChange={(event) => setMinutes(flowCountdownMinutes(event.target.value))}
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
              onChange={setCatalog}
              disabled={busy}
            />
            <div className="space-y-2" data-calibration-flow-pool>
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
                  className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                />
              ))}
              <button
                type="button"
                data-calibration-flow-add-question
                className="text-[11px] text-neutral-300 underline"
                onClick={() => setDraftQuestions([...draftQuestions, ""])}
              >
                Add question
              </button>
            </div>
          </section>
        )}

        {publicUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-300"
              data-verification-flow-public-link={kind === "verification" ? "" : undefined}
              data-calibration-flow-public-link={kind === "calibration" ? "" : undefined}
            >
              {publicUrl}
            </p>
            <CopyFlowUrlButton url={publicUrl} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
          >
            Save flow
          </button>
          {kind === "verification" && flow ? (
            <button
              type="button"
              data-verification-flow-skill
              className="border border-white/80 px-3 py-1.5 text-[11px] font-medium text-white"
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
            className="text-[11px] text-red-300 underline"
            onClick={() => void remove()}
          >
            Remove
          </button>
        </div>
      </div>
    </ProductSurface>
  );
}
