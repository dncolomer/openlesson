"use client";

import { useCallback, useEffect, useState } from "react";
import { ContextGenerationPool } from "@/components/ContextGenerationPool";
import type { CalibrateQuestion } from "@/lib/calibrate-session";
import { FLOW_COUNTDOWN_MINUTES, flowCountdownMinutes } from "@/lib/flow-countdown";

type FlowRecord = {
  id: string;
  goal: string;
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
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [draftQuestions, setDraftQuestions] = useState<string[]>([""]);
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

  function questionsFromDraft(): CalibrateQuestion[] {
    return draftQuestions
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: `q-${index + 1}`, text }));
  }

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
          goal,
          questions: questionsFromDraft(),
          durationMinutes: minutes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not save calibration flow");
        return;
      }
      setGoal("");
      setDraftQuestions([""]);
      setMinutes(15);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function generateFromGoal() {
    const text = goal.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/context-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ayclToken,
          kind: "calibration_from_goal",
          goal: text,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not generate questions from the goal");
        return;
      }
      const questions = Array.isArray(payload.questions) ? payload.questions : [];
      if (questions.length) setDraftQuestions(questions.map((item: unknown) => String(item)));
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
          A calibration flow is a goal and a pool of questions. The learner sorts three they
          could answer and two they could not, then writes both responses on the canvas.
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
          setDraftQuestions(draft.questions.length ? draft.questions : [""]);
        }}
      />

      <section className="space-y-3 border border-neutral-800 p-4" data-calibration-flow-editor>
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Goal"
          data-calibration-flow-goal
          rows={3}
          className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <button
          type="button"
          disabled={busy || !goal.trim()}
          onClick={() => void generateFromGoal()}
          data-calibration-generate-from-goal
          className="border border-white/80 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
        >
          Generate questions from this goal
        </button>
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
        <div className="space-y-2" data-calibration-flow-pool>
          {draftQuestions.map((value, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                value={value}
                onChange={(event) => {
                  const next = draftQuestions.slice();
                  next[index] = event.target.value;
                  setDraftQuestions(next);
                }}
                placeholder={`Question ${index + 1}`}
                data-calibration-flow-question
                rows={2}
                className="min-w-0 flex-1 border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                className="border border-neutral-700 px-2 text-[11px] text-neutral-300"
                onClick={() => setDraftQuestions(draftQuestions.filter((_, item) => item !== index))}
              >
                Remove
              </button>
            </div>
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
                <p className="text-sm text-white">{flow.goal}</p>
                <p className="text-[11px] text-neutral-500">
                  {flow.questions.length} question{flow.questions.length === 1 ? "" : "s"}
                  {" · "}
                  {flowCountdownMinutes(flow.durationMinutes)} min
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-neutral-300 underline"
                  onClick={() => {
                    setEditingId(flow.id);
                    setGoal(flow.goal);
                    setMinutes(flowCountdownMinutes(flow.durationMinutes));
                    setDraftQuestions(
                      flow.questions.length ? flow.questions.map((question) => question.text) : [""],
                    );
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
            <p className="break-all font-mono text-[11px] text-neutral-300" data-calibration-flow-public-link>
              {flow.publicUrl}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
