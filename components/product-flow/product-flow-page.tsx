"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  DASHBOARD_PROTOCOLS_PATH,
  PROTOCOL_CHALLENGE_LABEL,
  PROTOCOL_LABEL,
  productFlowDashboardPath,
  protocolChallengeFromUnknown,
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
import { FlowOpeningCanvasHost } from "@/components/product-flow/flow-opening-canvas-host";
import { FlowUnsysModelStep } from "@/components/product-flow/flow-unsys-model-step";
import {
  flowOpeningCanvasHasContent,
  flowShowsOpeningCanvas,
  parseFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import type { AuthorUnsysModelSeed } from "@/lib/author-unsys-model";
import { FlowChannelsFields } from "@/components/product-flow/flow-channels-fields";
import {
  parseFlowEnforcedChannels,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  flowAuthorShowsCanvasCapture,
  parseFlowCanvasCapture,
  type FlowCanvasCapture,
} from "@/lib/flow-canvas-capture";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { FlowPublicLinks } from "@/components/product-flow/copy-flow-url-button";

type LoadedFlow = {
  id: string;
  name: string;
  challenge?: string;
  topic?: string;
  goal?: string;
  artifacts?: FlowArtifact[];
  exactProblemOnCanvas?: boolean;
  openingCanvasScene?: IleWorkCanvasScene | null;
  generateProblemOnOpen?: boolean;
  questions: Array<{ id?: string; text?: string }>;
  durationMinutes?: number;
  publicToken: string;
  workspaceId: string;
  answersModelSeed?: AuthorUnsysModelSeed | null;
  enforcedChannels?: FlowEnforcedChannels;
  canvasCapture?: FlowCanvasCapture;
};

export function ProductFlowPage({ flowId }: { flowId: string }) {
  const router = useRouter();
  const [flow, setFlow] = useState<LoadedFlow | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [artifacts, setArtifacts] = useState<FlowArtifact[]>([]);
  const [exactProblemOnCanvas, setExactProblemOnCanvas] = useState(false);
  const [openingCanvasScene, setOpeningCanvasScene] = useState<IleWorkCanvasScene | null>(null);
  const [generateProblemOnOpen, setGenerateProblemOnOpen] = useState(false);
  const [authoringCanvas, setAuthoringCanvas] = useState(false);
  const [answersModelSeed, setAnswersModelSeed] = useState<AuthorUnsysModelSeed | null>(null);
  const [enforcedChannels, setEnforcedChannels] = useState<FlowEnforcedChannels>(
    () => parseFlowEnforcedChannels(null),
  );
  const [canvasCapture, setCanvasCapture] = useState<FlowCanvasCapture>(() =>
    parseFlowCanvasCapture(null),
  );
  const [minutes, setMinutes] = useState(15);
  const [publicUrl, setPublicUrl] = useState("");
  const [links, setLinks] = useState<Array<{ id: string; label: string | null; url: string }>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`${DASHBOARD_PROTOCOLS_PATH}/${encodeURIComponent(flowId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(errorMessageFromBody(payload, "Could not load protocol"));
      return;
    }
    const next = payload.protocol as LoadedFlow;
    setFlow(next);
    setName(String(next.name || payload.name || ""));
    setProblem(protocolChallengeFromUnknown(next));
    setArtifacts(parseFlowArtifacts(next.artifacts));
    setExactProblemOnCanvas(Boolean(next.exactProblemOnCanvas));
    setOpeningCanvasScene(parseFlowOpeningCanvasScene(next.openingCanvasScene));
    setGenerateProblemOnOpen(Boolean(next.generateProblemOnOpen));
    setAnswersModelSeed(parseFlowUnsysSeed(next.answersModelSeed));
    setEnforcedChannels(parseFlowEnforcedChannels(next.enforcedChannels));
    setCanvasCapture(parseFlowCanvasCapture(next.canvasCapture));
    setMinutes(flowCountdownMinutes(next.durationMinutes));
    setPublicUrl(String(payload.publicUrl || ""));
    const extra = Array.isArray(payload.links) ? payload.links : [];
    setLinks(
      extra
        .map((row: { id?: unknown; label?: unknown; publicUrl?: unknown; publicPath?: unknown }) => ({
          id: String(row.id || "").trim(),
          label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : null,
          url: String(row.publicUrl || row.publicPath || "").trim(),
        }))
        .filter((row: { id: string; url: string }) => row.id && row.url),
    );
  }, [flowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_PROTOCOLS_PATH}/${encodeURIComponent(flow.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name,
          artifacts,
          exactProblemOnCanvas,
          openingCanvasScene,
          generateProblemOnOpen,
          durationMinutes: minutes,
          answersModelSeed,
          enforcedChannels,
          canvasCapture: flowAuthorShowsCanvasCapture() ? canvasCapture : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not save protocol"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save protocol");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_PROTOCOLS_PATH}/${encodeURIComponent(flow.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(errorMessageFromBody(payload, "Could not remove protocol"));
      }
      router.push(productFlowDashboardPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove protocol");
      setBusy(false);
    }
  }

  async function addLink(label: string) {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_PROTOCOLS_PATH}/${encodeURIComponent(flow.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addLink", label }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not add link"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add link");
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(linkId: string) {
    if (!flow) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${DASHBOARD_PROTOCOLS_PATH}/${encodeURIComponent(flow.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeLink", linkId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not remove link"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductSurface label={PROTOCOL_LABEL} activeTab={dashboardTabForProductSurface()}>
      <div className="mx-auto w-full max-w-[96rem] space-y-6" data-product-flow-page="">
        <FlowFormHeader
          backHref={productFlowDashboardPath()}
          title={name || PROTOCOL_LABEL}
          description={`${PROTOCOL_CHALLENGE_LABEL} is fixed. Name, files, countdown, and Exact problem on canvas can still change.`}
          extra={
            publicUrl ? (
              <div className="mt-6 max-w-xl">
                <FlowPublicLinks
                  defaultUrl={publicUrl}
                  links={links}
                  busy={busy}
                  onAdd={(label) => void addLink(label)}
                  onRemove={(linkId) => void removeLink(linkId)}
                />
              </div>
            ) : null
          }
        />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {authoringCanvas ? (
          <div className="flex min-h-[70vh] flex-col">
            <FlowOpeningCanvasHost
              scene={openingCanvasScene}
              onSave={(next) => {
                setOpeningCanvasScene(next);
                setAuthoringCanvas(false);
              }}
              onCancel={() => setAuthoringCanvas(false)}
            />
          </div>
        ) : (
        <FlowFormCard>
          <FlowField label="Protocol name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Protocol name"
              data-flow-name=""
              className={FLOW_FORM_INPUT}
            />
          </FlowField>

          <section className="space-y-5" data-flow-problem="">
            <FlowProblemFields
              layout="split"
              problem={problem}
              onProblemChange={setProblem}
              artifacts={artifacts}
              onArtifactsChange={setArtifacts}
              workspaceId={flow?.workspaceId}
              exactProblemOnCanvas={exactProblemOnCanvas}
              onExactProblemOnCanvasChange={setExactProblemOnCanvas}
              openingCanvasPrepared={flowOpeningCanvasHasContent(openingCanvasScene)}
              openingCanvasScene={openingCanvasScene}
              onPrepareOpeningCanvas={
                flowShowsOpeningCanvas() ? () => setAuthoringCanvas(true) : undefined
              }
              onClearOpeningCanvas={() => setOpeningCanvasScene(null)}
              generateProblemOnOpen={generateProblemOnOpen}
              onGenerateProblemOnOpenChange={setGenerateProblemOnOpen}
              flowName={name}
              problemReadOnly
              aside={
                <FlowField label="Countdown">
                  <select
                    value={minutes}
                    data-flow-countdown=""
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
              }
            />
          </section>

          <section className="space-y-3" data-flow-unsys-editor="">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              Unsys model
            </p>
            <FlowUnsysModelStep
              name={name}
              problem={problem}
              artifacts={artifacts}
              openingCanvasScene={openingCanvasScene}
              seed={answersModelSeed}
              onChange={setAnswersModelSeed}
              onBusyChange={setModelBusy}
            />
          </section>

          <section className="space-y-3" data-flow-channels-editor="">
            <FlowChannelsFields
              value={enforcedChannels}
              onChange={setEnforcedChannels}
              canvasCapture={flowAuthorShowsCanvasCapture() ? canvasCapture : undefined}
              onCanvasCaptureChange={
                flowAuthorShowsCanvasCapture() ? setCanvasCapture : undefined
              }
            />
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={busy || modelBusy}
              onClick={() => void save()}
              className={FLOW_PRIMARY_BTN}
            >
              Save protocol
            </button>
            <button
              type="button"
              className={FLOW_DANGER_BTN}
              disabled={busy || modelBusy}
              onClick={() => void remove()}
            >
              Remove
            </button>
          </div>
        </FlowFormCard>
        )}
      </div>
    </ProductSurface>
  );
}
