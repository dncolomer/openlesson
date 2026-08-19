"use client";

import type { SnapshotAllProgressState } from "@/lib/pow-api/snapshot-all-progress";
import type {
  GoalCatalogItem,
  KnowledgeGoalMode,
  SnapshotEligibility,
} from "@/components/knowledge-panel/types";

export function LwmSnapshotModal({
  snapshotModalMode,
  closeSnapshotModal,
  snapshotLoading,
  snapshotAllRunning,
  goalMode,
  setGoalMode,
  adhocGoal,
  setAdhocGoal,
  selectedGoalIds,
  setSelectedGoalIds,
  goalCatalog,
  snapshotEligibility,
  snapshotAllProgress,
  snapshotAllProgressText,
  snapshotError,
  generateSnapshot,
  generateSnapshotAll,
}: {
  snapshotModalMode: "single" | "all";
  closeSnapshotModal: () => void;
  snapshotLoading: boolean;
  snapshotAllRunning: boolean;
  goalMode: KnowledgeGoalMode;
  setGoalMode: (mode: KnowledgeGoalMode) => void;
  adhocGoal: string;
  setAdhocGoal: (value: string) => void;
  selectedGoalIds: string[];
  setSelectedGoalIds: (updater: (prev: string[]) => string[]) => void;
  goalCatalog: GoalCatalogItem[];
  snapshotEligibility: SnapshotEligibility | null;
  snapshotAllProgress: SnapshotAllProgressState;
  snapshotAllProgressText: string;
  snapshotError: string | null;
  generateSnapshot: () => Promise<void>;
  generateSnapshotAll: () => Promise<void>;
}) {
  return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lwm-snapshot-modal-title"
              data-lwm-snapshot-modal
              data-lwm-snapshot-modal-mode={snapshotModalMode}
            >
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={() => {
                  if (!snapshotLoading && !snapshotAllRunning) closeSnapshotModal();
                }}
              />
              <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
                <div className="border-b border-neutral-800/70 px-5 pb-4 pt-5">
                  <h3
                    id="lwm-snapshot-modal-title"
                    className="text-base font-semibold text-white"
                  >
                    {snapshotModalMode === "all"
                      ? "Snapshot all users"
                      : "Generate snapshot"}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                    {snapshotModalMode === "all"
                      ? "Pick the goal for this batch, then run a Learning World Model Snapshot for every subject in this workspace."
                      : "Pick the goal for this run, then generate a snapshot for the selected user."}
                  </p>

                  <div
                    className="mt-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3"
                    data-lwm-goal-selection
                  >
                    <p className="text-[11px] font-medium text-neutral-300">
                      Goal for this snapshot
                      {snapshotModalMode === "all" ? (
                        <span className="font-normal text-neutral-500">
                          {" "}
                          (applied to every user)
                        </span>
                      ) : null}
                    </p>
                    <div
                      className="flex flex-wrap gap-1"
                      role="group"
                      aria-label="Goal selection mode"
                    >
                      {(
                        [
                          { id: "default" as const, label: "Default" },
                          { id: "adhoc" as const, label: "Adhoc" },
                          { id: "selected" as const, label: "Custom" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          data-lwm-goal-mode={m.id}
                          data-active={goalMode === m.id ? "true" : "false"}
                          disabled={snapshotLoading || snapshotAllRunning}
                          onClick={() => setGoalMode(m.id)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                            goalMode === m.id
                              ? "bg-white text-black"
                              : "border border-neutral-700 text-neutral-400 hover:text-neutral-200"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {goalMode === "default" ? (
                      <p
                        className="text-[11px] leading-snug text-neutral-500"
                        data-lwm-goal-default-hint
                      >
                        All workspace goals + goals of blocks linked by PoW
                        {snapshotModalMode === "all"
                          ? " (resolved per subject)."
                          : "."}
                      </p>
                    ) : null}
                    {goalMode === "adhoc" ? (
                      <input
                        type="text"
                        value={adhocGoal}
                        onChange={(e) => setAdhocGoal(e.target.value)}
                        disabled={snapshotLoading || snapshotAllRunning}
                        placeholder="Adhoc goal for this run…"
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:border-neutral-400 focus:outline-none disabled:opacity-50"
                        data-lwm-adhoc-goal
                      />
                    ) : null}
                    {goalMode === "selected" ? (
                      <div
                        className="max-h-36 space-y-1 overflow-y-auto"
                        data-lwm-goal-picker
                      >
                        {goalCatalog.length === 0 ? (
                          <p className="text-[11px] text-neutral-500">
                            No catalog goals yet. Add them on the Goals tab.
                          </p>
                        ) : (
                          goalCatalog.map((g) => {
                            const checked = selectedGoalIds.includes(g.id);
                            return (
                              <label
                                key={g.id}
                                className="flex cursor-pointer items-start gap-2 text-[11px] text-neutral-300"
                                data-lwm-goal-option={g.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={snapshotLoading || snapshotAllRunning}
                                  onChange={() =>
                                    setSelectedGoalIds((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== g.id)
                                        : [...prev, g.id],
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <span className="line-clamp-2">
                                  [{g.scope}] {g.text}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                    {snapshotModalMode === "single" &&
                    snapshotEligibility?.allowed === false ? (
                      <p
                        className="text-[11px] text-neutral-300/90"
                        data-lwm-snapshot-gate
                      >
                        {snapshotEligibility.message ||
                          "No new PoW since last snapshot for this goal selection."}
                      </p>
                    ) : null}
                  </div>

                  {/* Progress */}
                  <div
                    className="mt-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-3"
                    data-lwm-snapshot-progress
                    data-lwm-snapshot-all-progress={
                      snapshotModalMode === "all" ? "true" : undefined
                    }
                    data-lwm-snapshot-all-phase={
                      snapshotModalMode === "all"
                        ? snapshotAllProgress.phase
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-neutral-300">
                        Progress
                      </span>
                      {snapshotModalMode === "all" &&
                      snapshotAllProgress.phase !== "idle" ? (
                        <span
                          className="font-mono text-[10px] tabular-nums text-neutral-300"
                          data-lwm-snapshot-all-counts
                        >
                          {snapshotAllProgress.completed}/
                          {snapshotAllProgress.total || "…"}
                        </span>
                      ) : snapshotLoading ? (
                        <span className="text-[10px] text-neutral-400">Running…</span>
                      ) : (
                        <span className="text-[10px] text-neutral-500">Ready</span>
                      )}
                    </div>

                    {snapshotModalMode === "all" &&
                    snapshotAllProgress.total > 0 ? (
                      <div
                        className="h-2 overflow-hidden rounded-full bg-neutral-800"
                        data-lwm-snapshot-all-bar
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={snapshotAllProgress.total}
                        aria-valuenow={snapshotAllProgress.completed}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            snapshotAllProgress.phase === "error"
                              ? "bg-red-500"
                              : snapshotAllProgress.phase === "complete"
                                ? "bg-white"
                                : "bg-neutral-300"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (snapshotAllProgress.completed /
                                Math.max(1, snapshotAllProgress.total)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    ) : snapshotLoading || snapshotAllRunning ? (
                      <div
                        className="h-2 overflow-hidden rounded-full bg-neutral-800"
                        data-lwm-snapshot-progress-bar
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext="In progress"
                      >
                        <div className="h-full w-1/3 animate-pulse rounded-full bg-neutral-400" />
                      </div>
                    ) : (
                      <div className="h-2 rounded-full bg-neutral-800/80" />
                    )}

                    <p
                      className={`text-[11px] leading-snug ${
                        snapshotError || snapshotAllProgress.phase === "error"
                          ? "text-red-400"
                          : snapshotAllProgress.phase === "complete"
                            ? "text-neutral-200"
                            : "text-neutral-400"
                      }`}
                      {...(snapshotModalMode === "all"
                        ? { "data-lwm-snapshot-all-status": true }
                        : {})}
                      data-lwm-snapshot-progress-status
                    >
                      {snapshotModalMode === "all"
                        ? snapshotAllProgress.phase === "idle"
                          ? "Press start to snapshot every user."
                          : snapshotAllProgressText
                        : snapshotLoading
                          ? "Generating Learning World Model Snapshot…"
                          : "Press generate when the goal looks right."}
                    </p>
                    {snapshotError ? (
                      <p className="text-[11px] text-red-400" data-lwm-snapshot-error>
                        {snapshotError}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-2 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeSnapshotModal}
                    className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 px-4 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
                  >
                    {snapshotLoading || snapshotAllRunning ? "Hide" : "Cancel"}
                  </button>
                  {snapshotModalMode === "single" ? (
                    <button
                      type="button"
                      onClick={() => void generateSnapshot()}
                      disabled={
                        snapshotLoading ||
                        snapshotAllRunning ||
                        snapshotEligibility?.allowed === false ||
                        (goalMode === "adhoc" && !adhocGoal.trim()) ||
                        (goalMode === "selected" && selectedGoalIds.length === 0)
                      }
                      className="flex-1 rounded-xl bg-white py-2.5 px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                      data-lwm-snapshot-modal-confirm
                    >
                      {snapshotLoading ? "Generating…" : "Generate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void generateSnapshotAll()}
                      disabled={
                        snapshotLoading ||
                        snapshotAllRunning ||
                        snapshotAllProgress.phase === "complete" ||
                        (goalMode === "adhoc" && !adhocGoal.trim()) ||
                        (goalMode === "selected" && selectedGoalIds.length === 0)
                      }
                      className="flex-1 rounded-xl bg-white py-2.5 px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                      data-lwm-snapshot-modal-confirm-all
                    >
                      {snapshotAllRunning
                        ? "Running…"
                        : snapshotAllProgress.phase === "complete"
                          ? "Done"
                          : snapshotAllProgress.phase === "error"
                            ? "Retry"
                            : "Start"}
                    </button>
                  )}
                </div>
              </div>
            </div>
  );
}
