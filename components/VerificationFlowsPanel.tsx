"use client";

import { useCallback, useEffect, useState } from "react";
import { ContextGenerationPool } from "@/components/ContextGenerationPool";
import { type VerificationQuestion } from "@/lib/verification-flow";
import { CopyFlowUrlButton } from "@/components/product-flow/copy-flow-url-button";
import { FlowProblemFields } from "@/components/product-flow/flow-problem-fields";
import { parseFlowArtifacts, type FlowArtifact } from "@/lib/flow-artifacts";

type FlowRecord = {
  id: string;
  name?: string;
  topic: string;
  artifacts?: FlowArtifact[];
  questions: VerificationQuestion[];
  publicToken: string;
  publicUrl: string;
  skillMd: string;
};


export function VerificationFlowsPanel({
  workspaceId,
  ayclToken,
}: {
  workspaceId: string;
  ayclToken?: string;
}) {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [artifacts, setArtifacts] = useState<FlowArtifact[]>([]);
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
          name,
          topic,
          problem: topic,
          artifacts,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message || "Could not save verification flow");
        return;
      }
      setName("");
      setTopic("");
      setArtifacts([]);
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
          A verification flow is a name and a Problem. Optional files are stored on xAI and
          used with the Problem to generate the unsys model.
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
        }}
      />

      <section
        className="space-y-3 border border-neutral-800 p-4"
        data-verification-flow-editor
        data-flow-problem=""
        data-verification-flow-topic=""
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Flow name"
          data-flow-name=""
          className="w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
        />
        <FlowProblemFields
          problem={topic}
          onProblemChange={setTopic}
          artifacts={artifacts}
          onArtifactsChange={setArtifacts}
          workspaceId={workspaceId}
          topicHook="verification"
        />
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
                <p className="text-sm text-white" data-flow-name>{flow.name || flow.topic}</p>
                <p className="text-[11px] text-neutral-500">
                  Problem
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-neutral-300 underline"
                  onClick={() => {
                    setEditingId(flow.id);
                    setName(flow.name || flow.topic);
                    setTopic(flow.topic);
                    setArtifacts(parseFlowArtifacts(flow.artifacts));
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-300" data-verification-flow-public-link>
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
