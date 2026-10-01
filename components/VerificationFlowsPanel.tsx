"use client";

import { useCallback, useEffect, useState } from "react";
import { ContextGenerationPool } from "@/components/ContextGenerationPool";
import {
  buildVerificationFlowSkillMarkdown,
  verificationFlowSkillFilename,
  type VerificationQuestion,
} from "@/lib/verification-flow";

type FlowRecord = {
  id: string;
  topic: string;
  questions: VerificationQuestion[];
  publicToken: string;
  publicUrl: string;
  skillMd: string;
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

export function VerificationFlowsPanel({
  workspaceId,
  ayclToken,
}: {
  workspaceId: string;
  ayclToken?: string;
}) {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [topic, setTopic] = useState("");
  const [draftQuestions, setDraftQuestions] = useState<string[]>([""]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ workspaceId });
    if (ayclToken) params.set("ayclToken", ayclToken);
    const response = await fetch(`/api/workspace/verification-flows?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error?.message || "Could not load verification flows");
      return;
    }
    setFlows(Array.isArray(payload.flows) ? payload.flows : []);
  }, [workspaceId, ayclToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function questionsFromDraft(): VerificationQuestion[] {
    return draftQuestions
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: `q-${index + 1}`, text }));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/verification-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ayclToken,
          action: editingId ? "update" : "create",
          flowId: editingId,
          topic,
          questions: questionsFromDraft(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not save verification flow");
        return;
      }
      setTopic("");
      setDraftQuestions([""]);
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
      const response = await fetch("/api/workspace/verification-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ayclToken, action: "remove", flowId }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setError(payload?.error?.message || "Could not remove verification flow");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto" data-verification-flows-panel>
      <div>
        <h2 className="text-sm font-medium text-white">Verification Flows</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
          A verification flow is one topic. Its question pool, public link, agent skill, and
          proof-of-work results stay on the flow.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-300" data-verification-flows-error>
          {error}
        </p>
      ) : null}

      <ContextGenerationPool
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        kind="verification_flow"
        onUseFlow={(draft) => {
          setEditingId(null);
          setTopic(draft.topic);
          setDraftQuestions(draft.questions.length ? draft.questions : [""]);
        }}
      />

      <section className="space-y-3 border border-neutral-800 p-4" data-verification-flow-editor>
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic"
          data-verification-flow-topic
          className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <div className="space-y-2" data-verification-flow-pool>
          {draftQuestions.map((value, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={value}
                onChange={(event) => {
                  const next = draftQuestions.slice();
                  next[index] = event.target.value;
                  setDraftQuestions(next);
                }}
                placeholder={`Starting question ${index + 1}`}
                data-verification-flow-question
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
            data-verification-flow-add-question
            className="text-[11px] text-neutral-300 underline"
            onClick={() => setDraftQuestions([...draftQuestions, ""])}
          >
            Add question
          </button>
        </div>
        <button
          type="button"
          disabled={busy || !topic.trim()}
          onClick={() => void save()}
          data-verification-flow-save
          className="bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
        >
          {editingId ? "Save flow" : "Create verification flow"}
        </button>
      </section>

      <ul className="space-y-3" data-verification-flows-list>
        {flows.map((flow) => (
          <li key={flow.id} className="space-y-2 border border-neutral-800 p-4" data-verification-flow-card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white">{flow.topic}</p>
                <p className="text-[11px] text-neutral-500">
                  {flow.questions.length} starting question{flow.questions.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-neutral-300 underline"
                  onClick={() => {
                    setEditingId(flow.id);
                    setTopic(flow.topic);
                    setDraftQuestions(
                      flow.questions.length ? flow.questions.map((question) => question.text) : [""],
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-verification-flow-remove
                  className="text-[11px] text-red-300 underline"
                  onClick={() => void remove(flow.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="break-all font-mono text-[11px] text-neutral-300" data-verification-flow-public-link>
              {flow.publicUrl}
            </p>
            <button
              type="button"
              data-verification-flow-skill
              className="border border-white/80 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/10"
              onClick={() => {
                const skill = buildVerificationFlowSkillMarkdown({
                  workspaceId,
                  flowId: flow.id,
                  topic: flow.topic,
                  questions: flow.questions,
                  publicToken: flow.publicToken,
                  baseUrl: window.location.origin,
                });
                downloadText(
                  verificationFlowSkillFilename(flow.topic),
                  skill,
                  "text/markdown;charset=utf-8",
                );
              }}
            >
              Generate skill
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
