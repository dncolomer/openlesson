"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  DASHBOARD_FLOWS_PATH,
  productFlowDashboardPath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import { parseFlowArtifacts, type FlowArtifact } from "@/lib/flow-artifacts";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_DANGER_BTN,
  FLOW_FORM_INPUT,
  FLOW_PRIMARY_BTN,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
} from "@/components/product-flow/product-flow-form";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { CopyFlowUrlButton } from "@/components/product-flow/copy-flow-url-button";

type LoadedFlow = {
  id: string;
  name: string;
  topic?: string;
  goal?: string;
  artifacts?: FlowArtifact[];
  questions: Array<{ id?: string; text?: string }>;
  durationMinutes?: number;
  publicToken: string;
  workspaceId: string;
};


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
  const [problem, setProblem] = useState("");
  const [artifacts, setArtifacts] = useState<FlowArtifact[]>([]);
  const [minutes, setMinutes] = useState(15);
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
    setProblem(String(next.topic || next.goal || ""));
    setArtifacts(parseFlowArtifacts(next.artifacts));
    setMinutes(flowCountdownMinutes(next.durationMinutes));
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
          topic: problem,
          goal: problem,
          problem,
          artifacts,
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

  const description =
    kind === "calibration"
      ? "Problem, optional files, and countdown."
      : "The problem learners work on, and optional files used to generate the unsys model.";

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

          <section
            className="space-y-5"
            data-flow-problem=""
            data-verification-flow-editor={kind === "verification" ? "" : undefined}
            data-solve-flow-editor={kind === "solve" ? "" : undefined}
            data-calibration-flow-editor={kind === "calibration" ? "" : undefined}
          >
            <FlowProblemFields
              problem={problem}
              onProblemChange={setProblem}
              artifacts={artifacts}
              onArtifactsChange={setArtifacts}
              workspaceId={flow?.workspaceId}
              topicHook={kind}
            />
            {kind === "calibration" ? (
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
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className={FLOW_PRIMARY_BTN}
            >
              Save flow
            </button>
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
