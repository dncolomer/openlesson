"use client";

import { useCallback, useEffect, useState } from "react";
import { ContextGenerationPool } from "@/components/ContextGenerationPool";
import type { CalibrateQuestion } from "@/lib/calibrate-session";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";
import { CopyFlowUrlButton } from "@/components/product-flow/copy-flow-url-button";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";
import { parseFlowArtifacts, type FlowArtifact } from "@/lib/flow-artifacts";

type FlowRecord = {
  id: string;
  name?: string;
  goal: string;
  topic?: string;
  artifacts?: FlowArtifact[];
  questions: CalibrateQuestion[];
  durationMinutes?: number;
  publicToken: string;
  publicUrl: string;
};

export function CalibrationFlowsPanel({
  workspaceId,
  ayclToken,
}: {
  workspaceId: string;
  ayclToken?: string;
}) {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [artifacts, setArtifacts] = useState<FlowArtifact[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ workspaceId });
    if (ayclToken) params.set("ayclToken", ayclToken);
    const response = await fetch(`/api/workspace/calibration-flows?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message || "Could not load calibration flows");
      return;
    }
    setFlows(Array.isArray(payload.flows) ? payload.flows : []);
  }, [workspaceId, ayclToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/calibration-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ayclToken,
          action: editingId ? "update" : "create",
          flowId: editingId,
          name,
          goal,
          topic: goal,
          problem: goal,
          artifacts,
          durationMinutes: minutes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not save calibration flow");
        return;
      }
      setName("");
      setGoal("");
      setArtifacts([]);
      setMinutes(15);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(flowId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/calibration-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ayclToken, action: "remove", flowId }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setError(payload?.error?.message || "Could not remove calibration flow");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto" data-calibration-flows-panel>
      <div>
        <h2 className="text-sm font-medium text-white">Calibration Flows</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
          A calibration flow is a name and a Problem. Optional files are stored on xAI and
          used with the Problem to generate the unsys model.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-300" data-calibration-flows-error>
          {error}
        </p>
      ) : null}

      <ContextGenerationPool
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        kind="goals"
        onUseGoal={(text) => setGoal(text)}
      />

      <ContextGenerationPool
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        kind="calibration_flow"
        onUseFlow={(draft) => {
          setEditingId(null);
          setGoal(draft.topic);
        }}
      />

      <section
        className="space-y-3 border border-neutral-800 p-4"
        data-calibration-flow-editor
        data-flow-problem=""
        data-calibration-flow-goal=""
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Flow name"
          data-flow-name=""
          className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <FlowProblemFields
          problem={goal}
          onProblemChange={setGoal}
          artifacts={artifacts}
          onArtifactsChange={setArtifacts}
          workspaceId={workspaceId}
          topicHook="calibration"
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
        <button
          type="button"
          disabled={busy || !goal.trim()}
          onClick={() => void save()}
          data-calibration-flow-save
          className="bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
        >
          {editingId ? "Save flow" : "Create calibration flow"}
        </button>
      </section>

      <ul className="space-y-3" data-calibration-flows-list>
        {flows.map((flow) => (
          <li key={flow.id} className="space-y-2 border border-neutral-800 p-4" data-calibration-flow-card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white" data-flow-name>{flow.name || flow.goal}</p>
                <p className="text-[11px] text-neutral-500">
                  {flowCountdownMinutes(flow.durationMinutes)} min
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-neutral-300 underline"
                  onClick={() => {
                    setEditingId(flow.id);
                    setName(flow.name || flow.goal);
                    setGoal(flow.goal || flow.topic || "");
                    setArtifacts(parseFlowArtifacts(flow.artifacts));
                    setMinutes(flowCountdownMinutes(flow.durationMinutes));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-calibration-flow-remove
                  className="text-[11px] text-red-300 underline"
                  onClick={() => void remove(flow.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-300" data-calibration-flow-public-link>
                {flow.publicUrl}
              </p>
              <CopyFlowUrlButton url={flow.publicUrl} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
