"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  organizationIdJsonBody,
  withOrganizationId,
} from "@/lib/organization/active-organization-client";
import {
  acceptProtocolPublish,
  DASHBOARD_FLOWS_PATH,
  emptyProtocolDraft,
  nextProductFlowWizardStep,
  previousProductFlowWizardStep,
  PROTOCOL_CHALLENGE_LABEL,
  PROTOCOL_LABEL,
  productFlowDashboardPath,
  productFlowProblem,
  productFlowWizardCanAdvance,
  productFlowWizardSteps,
  type ProtocolDraft,
  type ProductFlowWizardStep,
} from "@/lib/product-flow";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_COMPACT_GHOST_BTN,
  FLOW_COMPACT_PRIMARY_BTN,
  FLOW_FORM_INPUT,
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
  PRODUCT_CREATE_SHELL,
  PRODUCT_CREATE_SHELL_FILL,
  FlowField,
  FlowFormCard,
  FlowFormHeader,
  FlowWizardSteps,
} from "@/components/product-flow/product-flow-form";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";
import { FlowOpeningCanvasHost } from "@/components/product-flow/flow-opening-canvas-host";
import { FlowUnsysModelStep } from "@/components/product-flow/flow-unsys-model-step";
import { FlowPublishReview } from "@/components/product-flow/flow-publish-review";
import {
  flowOpeningCanvasHasContent,
  flowShowsOpeningCanvas,
} from "@/lib/flow-opening-canvas";
import { FlowChannelsFields } from "@/components/product-flow/flow-channels-fields";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import { ProtocolSettingSelect } from "@/components/product-flow/protocol-setting-select";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

function wizardDescription(step: ProductFlowWizardStep): string {
  if (step === "name") return "A short name for the dashboard list and the public run.";
  if (step === "model") {
    return "Hidden states and priced edges for this protocol. Prompt, attach files, or add a branch by hand.";
  }
  if (step === "channels") {
    return "Audio, Muse (EEG), video, and screenshots this run requires. A required channel with no data flowing invalidates the session.";
  }
  if (step === "publish") {
    return "Review the name, author source, model, and channels, then publish. The public run asks for identification first.";
  }
  return `Choose one: write ${PROTOCOL_CHALLENGE_LABEL.toLowerCase()}, attach files (a problem is written when a learner opens), or prepare the board, and set the countdown.`;
}

export function ProductFlowWizard() {
  const router = useRouter();
  const [step, setStep] = useState<ProductFlowWizardStep>("name");
  const [draft, setDraft] = useState<ProtocolDraft>(() => emptyProtocolDraft());
  const [busy, setBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [authoringCanvas, setAuthoringCanvas] = useState(false);
  const [protocolStyle, setProtocolStyle] = useState<SessionSidebarStyle>(
    EMPTY_SESSION_SIDEBAR_STYLE,
  );
  const [error, setError] = useState("");
  const canAdvance = productFlowWizardCanAdvance(step, draft);
  const problem = productFlowProblem(draft);

  const heading = useMemo(() => {
    if (step === "name") return `Name this ${PROTOCOL_LABEL.toLowerCase()}`;
    if (step === "author") return `Author the ${PROTOCOL_LABEL.toLowerCase()}`;
    if (step === "model") return "Adapt the unsys model";
    if (step === "channels") return "Choose enforced channels";
    return `Publish ${draft.name.trim() || "this protocol"}`;
  }, [draft.name, step]);

  function patch(next: Partial<ProtocolDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function publish() {
    const accepted = acceptProtocolPublish(draft);
    if (!accepted.ok) {
      setError(accepted.reason);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(withOrganizationId(DASHBOARD_FLOWS_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          organizationIdJsonBody({
            name: accepted.name,
            challenge: accepted.challenge,
            artifacts: accepted.artifacts,
            exactProblemOnCanvas: accepted.exactProblemOnCanvas,
            openingCanvasScene: accepted.openingCanvasScene,
            generateProblemOnOpen: accepted.generateProblemOnOpen,
            actionCatalog: accepted.actionCatalog,
            durationMinutes: accepted.durationMinutes,
            answersModelSeed: accepted.answersModelSeed,
            enforcedChannels: accepted.enforcedChannels,
            canvasCapture: accepted.canvasCapture,
            protocolSettingId: accepted.protocolSettingId,
          }),
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not publish protocol"));
      }
      router.push(productFlowDashboardPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish protocol");
    } finally {
      setBusy(false);
    }
  }

  const fillViewport = step === "model" || authoringCanvas;
  const compactActions = step === "model";
  const backBtnClass = compactActions ? FLOW_COMPACT_GHOST_BTN : FLOW_SECONDARY_BTN;
  const nextBtnClass = compactActions ? FLOW_COMPACT_PRIMARY_BTN : FLOW_PRIMARY_BTN;
  const actions = (
    <div className={`flex flex-wrap ${compactActions ? "gap-1.5" : "gap-3 pt-2"}`}>
      {step !== "name" ? (
        <button
          type="button"
          className={backBtnClass}
          disabled={modelBusy}
          onClick={() => setStep(previousProductFlowWizardStep(step))}
        >
          Back
        </button>
      ) : (
        <button
          type="button"
          className={backBtnClass}
          onClick={() => router.push(productFlowDashboardPath())}
        >
          Cancel
        </button>
      )}
      {step === "publish" ? (
        <button
          type="button"
          disabled={busy || modelBusy || !canAdvance}
          onClick={() => void publish()}
          data-flow-publish=""
          className={nextBtnClass}
        >
          Publish
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || modelBusy || !canAdvance}
          onClick={() => setStep(nextProductFlowWizardStep(step))}
          className={nextBtnClass}
        >
          Continue
        </button>
      )}
    </div>
  );

  return (
    <ProductSurface label={PROTOCOL_LABEL} activeTab={dashboardTabForProductSurface()}>
      <div
        className={fillViewport ? PRODUCT_CREATE_SHELL_FILL : PRODUCT_CREATE_SHELL}
        data-flow-wizard=""
        data-flow-wizard-step={step}
      >
        {authoringCanvas ? null : (
          <FlowFormHeader
            kicker={<FlowWizardSteps steps={productFlowWizardSteps()} current={step} />}
            title={heading}
            description={step === "model" ? undefined : wizardDescription(step)}
            compact={step === "model"}
          />
        )}

        {error && !authoringCanvas ? <p className="text-sm text-red-300">{error}</p> : null}

        {authoringCanvas ? (
          <FlowOpeningCanvasHost
            scene={draft.openingCanvasScene}
            sidebarStyle={protocolStyle}
            onSave={(openingCanvasScene) => {
              patch({ openingCanvasScene });
              setAuthoringCanvas(false);
            }}
            onCancel={() => setAuthoringCanvas(false)}
          />
        ) : null}

        {!authoringCanvas && step === "name" ? (
          <FlowFormCard>
            <FlowField label="Protocol name">
              <input
                value={draft.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Protocol name"
                data-flow-name=""
                className={FLOW_FORM_INPUT}
              />
            </FlowField>
            <ProtocolSettingSelect
              value={draft.protocolSettingId}
              onChange={(protocolSettingId) => patch({ protocolSettingId })}
              onStyleChange={setProtocolStyle}
              disabled={busy}
            />
            {actions}
          </FlowFormCard>
        ) : null}

        {!authoringCanvas && step === "author" ? (
          <FlowFormCard data-flow-problem="">
            <FlowProblemFields
              layout="split"
              problem={problem}
              onProblemChange={(challenge) => patch({ challenge })}
              artifacts={draft.artifacts}
              onArtifactsChange={(artifacts) => patch({ artifacts })}
              exactProblemOnCanvas={draft.exactProblemOnCanvas}
              onExactProblemOnCanvasChange={(exactProblemOnCanvas) =>
                patch({ exactProblemOnCanvas })
              }
              openingCanvasPrepared={flowOpeningCanvasHasContent(draft.openingCanvasScene)}
              openingCanvasScene={draft.openingCanvasScene}
              onPrepareOpeningCanvas={
                flowShowsOpeningCanvas() ? () => setAuthoringCanvas(true) : undefined
              }
              onClearOpeningCanvas={() => patch({ openingCanvasScene: null })}
              generateProblemOnOpen={draft.generateProblemOnOpen}
              onGenerateProblemOnOpenChange={(generateProblemOnOpen) =>
                patch({ generateProblemOnOpen })
              }
              flowName={draft.name}
              aside={
                <FlowField label="Countdown">
                  <select
                    value={draft.durationMinutes}
                    data-flow-countdown=""
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
              }
            />
            {actions}
          </FlowFormCard>
        ) : null}

        {!authoringCanvas && step === "model" ? (
          <FlowFormCard
            data-flow-unsys-step=""
            className="flex min-h-0 flex-1 flex-col space-y-0 overflow-hidden px-0 py-0 sm:px-0 sm:py-0"
          >
            <FlowUnsysModelStep
              name={draft.name}
              problem={problem}
              artifacts={draft.artifacts}
              openingCanvasScene={draft.openingCanvasScene}
              seed={draft.answersModelSeed}
              onChange={(answersModelSeed) => patch({ answersModelSeed })}
              onBusyChange={setModelBusy}
              actions={actions}
              fillViewport
            />
          </FlowFormCard>
        ) : null}

        {!authoringCanvas && step === "channels" ? (
          <FlowFormCard data-flow-channels-step="">
            <FlowChannelsFields
              value={draft.enforcedChannels}
              onChange={(enforcedChannels) => patch({ enforcedChannels })}
              canvasCapture={draft.canvasCapture}
              onCanvasCaptureChange={(canvasCapture) => patch({ canvasCapture })}
            />
            {actions}
          </FlowFormCard>
        ) : null}

        {!authoringCanvas && step === "publish" ? (
          <FlowPublishReview draft={draft} problem={problem} actions={actions} />
        ) : null}
      </div>
    </ProductSurface>
  );
}
