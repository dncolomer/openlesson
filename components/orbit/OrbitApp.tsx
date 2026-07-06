"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Command,
  Filter,
  Inbox,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  User,
} from "lucide-react";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import { SmartCoachOverlay } from "@/components/orbit/SmartCoachOverlay";
import {
  createSeedOrbitState,
  getVisibleIssues,
  loadOrbitAppState,
  nextIssueIdentifier,
  saveOrbitAppState,
  type OrbitAppState,
  type OrbitIssue,
  type OrbitIssueStatus,
  type OrbitPriority,
} from "@/lib/evidence-api-demo/orbit-app-model";
import {
  emitOrbitAction,
  fetchOrbitScorecard,
  initOrbitBridge,
  loadOrbitBridge,
  parseOrbitLaunchParams,
  type OrbitEvidenceBridge,
} from "@/lib/evidence-api-demo/orbit-bridge";

const STATUS_OPTIONS: { value: OrbitIssueStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: OrbitPriority; label: string }[] = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

function statusActionFor(next: OrbitIssueStatus): string | null {
  if (next === "in_progress") return "change_status_in_progress";
  if (next === "done") return "change_status_done";
  return null;
}

function priorityActionFor(next: OrbitPriority, prev: OrbitPriority): string | null {
  if (next === "urgent" && prev !== "urgent") return "set_priority_urgent";
  if (next !== "urgent" && prev === "urgent") return "set_priority_normal";
  return null;
}

export function OrbitApp() {
  const [appState, setAppState] = useState<OrbitAppState | null>(null);
  const [bridge, setBridge] = useState<OrbitEvidenceBridge | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEmitting, setIsEmitting] = useState(false);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [dismissedCoachStep, setDismissedCoachStep] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    const params = parseOrbitLaunchParams(window.location.search);
    const existingBridge = loadOrbitBridge();

    if (!params && !existingBridge) {
      setBootError("Launch Orbit from the openLesson demo hub to connect Evidence API.");
      setAppState(createSeedOrbitState());
      return;
    }

    const launch = params ?? {
      planId: existingBridge!.planId,
      sessionId: existingBridge!.sessionId,
      demoId: existingBridge!.demoId,
    };

    const nextBridge = initOrbitBridge(launch, existingBridge?.blocks ?? []);
    setBridge(nextBridge);
    setAppState(loadOrbitAppState());

    if (params) {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const persistApp = useCallback((next: OrbitAppState) => {
    setAppState(next);
    saveOrbitAppState(next);
  }, []);

  const runEvidenceAction = useCallback(
    async (actionId: string, reflection?: string) => {
      if (!bridge || isEmitting) return;
      setIsEmitting(true);
      setActionError(null);
      setDismissedCoachStep(null);
      try {
        const result = await emitOrbitAction(bridge, actionId, { reflection });
        setBridge(result.bridge);
        if (result.shouldScore) {
          setIsReporting(true);
          const nextReport = await fetchOrbitScorecard(result.bridge);
          setReport(nextReport);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Evidence upload failed");
      } finally {
        setIsEmitting(false);
        setIsReporting(false);
      }
    },
    [bridge, isEmitting]
  );

  const selectedIssue = useMemo(() => {
    if (!appState?.ui.selectedIssueId) return null;
    return appState.issues.find((issue) => issue.id === appState.ui.selectedIssueId) ?? null;
  }, [appState]);

  const visibleIssues = appState ? getVisibleIssues(appState) : [];

  const updateIssue = (issueId: string, patch: Partial<OrbitIssue>, actionId?: string | null) => {
    if (!appState) return;
    const nextIssues = appState.issues.map((issue) =>
      issue.id === issueId ? { ...issue, ...patch } : issue
    );
    persistApp({ ...appState, issues: nextIssues });
    if (actionId) void runEvidenceAction(actionId);
  };

  const handleSelectView = (view: OrbitAppState["ui"]["view"]) => {
    if (!appState) return;
    persistApp({
      ...appState,
      ui: { ...appState.ui, view, assigneeFilter: view === "my_issues" ? "You" : null },
    });
    if (view === "inbox") void runEvidenceAction("open_inbox");
    if (view === "my_issues") void runEvidenceAction("filter_by_assignee");
  };

  const handleTriage = (issue: OrbitIssue) => {
    updateIssue(issue.id, { unread: false }, "triage_issue");
    persistApp({
      ...appState!,
      ui: { ...appState!.ui, selectedIssueId: issue.id },
      issues: appState!.issues.map((entry) =>
        entry.id === issue.id ? { ...entry, unread: false } : entry
      ),
    });
  };

  const handleCreateIssue = () => {
    if (!appState || !newIssueTitle.trim()) return;
    const projectId = appState.ui.selectedProjectId ?? appState.projects[0]?.id ?? "proj-sprint-12";
    const issue: OrbitIssue = {
      id: `issue-${crypto.randomUUID()}`,
      identifier: nextIssueIdentifier(appState.issues),
      title: newIssueTitle.trim(),
      description: "",
      status: "todo",
      priority: "normal",
      assignee: null,
      labels: [],
      projectId,
      unread: false,
      createdAt: new Date().toISOString(),
    };
    persistApp({
      ...appState,
      issues: [issue, ...appState.issues],
      ui: { ...appState.ui, selectedIssueId: issue.id, view: "project" },
    });
    setNewIssueTitle("");
    setNewIssueOpen(false);
    void runEvidenceAction("create_issue");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        void runEvidenceAction("open_command_palette");
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setNewIssueOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runEvidenceAction]);

  if (!appState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-[#9b9bb8]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0d0d0d] text-[#e8e8f0]">
      <aside className={`flex shrink-0 flex-col border-r border-[#1f1f28] bg-[#111118] ${appState.ui.sidebarCollapsed ? "w-14" : "w-56"}`}>
        <div className="flex h-12 items-center gap-2 border-b border-[#1f1f28] px-4">
          <div className="flex size-6 items-center justify-center rounded bg-[#5e6ad2] text-[10px] font-bold text-white">OR</div>
          {!appState.ui.sidebarCollapsed ? <span className="text-sm font-medium">{appState.workspaceName}</span> : null}
        </div>
        <nav className="flex-1 space-y-1 p-2 text-sm">
          <SidebarItem
            icon={<Inbox className="size-4" />}
            label="Inbox"
            active={appState.ui.view === "inbox"}
            collapsed={appState.ui.sidebarCollapsed}
            coachKey="inbox"
            onClick={() => handleSelectView("inbox")}
          />
          <SidebarItem
            icon={<User className="size-4" />}
            label="My issues"
            active={appState.ui.view === "my_issues"}
            collapsed={appState.ui.sidebarCollapsed}
            coachKey="filter"
            onClick={() => handleSelectView("my_issues")}
          />
          {!appState.ui.sidebarCollapsed ? (
            <div className="px-2 pt-4 pb-1 text-[10px] font-medium uppercase tracking-wider text-[#5c5c70]">Projects</div>
          ) : null}
          {appState.projects.map((project) => (
            <SidebarItem
              key={project.id}
              icon={<span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />}
              label={project.name}
              active={appState.ui.view === "project" && appState.ui.selectedProjectId === project.id}
              collapsed={appState.ui.sidebarCollapsed}
              coachKey="project"
              onClick={() => {
                persistApp({
                  ...appState,
                  ui: { ...appState.ui, view: "project", selectedProjectId: project.id },
                });
                void runEvidenceAction("move_to_project");
              }}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-[#1f1f28] px-4">
          <div className="flex items-center gap-2 text-sm text-[#9b9bb8]">
            <LayoutGrid className="size-4" />
            {appState.ui.view === "inbox" ? "Inbox" : appState.ui.view === "my_issues" ? "My issues" : "Project"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-coach="command-palette"
              onClick={() => {
                setPaletteOpen(true);
                void runEvidenceAction("open_command_palette");
              }}
              className="inline-flex items-center gap-1 rounded border border-[#2a2a36] px-2 py-1 text-xs text-[#9b9bb8] transition hover:border-[#5e6ad2]/50 hover:text-white"
            >
              <Command className="size-3.5" />K
            </button>
            <button
              type="button"
              data-coach="create-issue"
              onClick={() => setNewIssueOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-[#5e6ad2] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#6f7be0]"
            >
              <Plus className="size-3.5" />
              New issue
            </button>
          </div>
        </header>

        {bootError ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">{bootError}</div>
        ) : null}
        {actionError ? (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-100">{actionError}</div>
        ) : null}

        {!appState.ui.tourDismissed ? (
          <div className="flex items-center justify-between gap-3 border-b border-[#5e6ad2]/20 bg-[#5e6ad2]/10 px-4 py-2 text-xs text-[#c4c9ff]">
            <span>Welcome to Orbit — learn by doing. Triage the inbox, prioritize ORB-12, and ship Sprint 12.</span>
            <button
              type="button"
              onClick={() => {
                persistApp({ ...appState, ui: { ...appState.ui, tourDismissed: true } });
                void runEvidenceAction("skip_product_tour");
              }}
              className="shrink-0 rounded border border-[#5e6ad2]/40 px-2 py-1 transition hover:bg-[#5e6ad2]/20"
            >
              Skip tour
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <section className="min-w-0 flex-1 overflow-auto">
            <div className="flex items-center gap-2 border-b border-[#1f1f28] px-4 py-2 text-xs text-[#6b6b80]">
              <Filter className="size-3.5" />
              <button
                type="button"
                data-coach="filter"
                onClick={() => {
                  persistApp({
                    ...appState,
                    ui: { ...appState.ui, assigneeFilter: "You", view: "my_issues" },
                  });
                  void runEvidenceAction("filter_by_assignee");
                }}
                className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-white"
              >
                Assignee: You
              </button>
              <button
                type="button"
                data-coach="priority"
                onClick={() => void runEvidenceAction("set_priority_urgent")}
                className="rounded px-2 py-1 transition hover:bg-white/5 hover:text-white"
              >
                Priority: Urgent
              </button>
            </div>

            <ul className="divide-y divide-[#1a1a24]">
              {visibleIssues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (issue.unread) handleTriage(issue);
                      persistApp({
                        ...appState,
                        ui: { ...appState.ui, selectedIssueId: issue.id },
                      });
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                      appState.ui.selectedIssueId === issue.id ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <span className="w-16 shrink-0 font-mono text-xs text-[#6b6b80]">{issue.identifier}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
                    {issue.unread ? (
                      <span
                        data-coach="triage"
                        className="rounded bg-[#5e6ad2]/20 px-2 py-0.5 text-[10px] text-[#aeb4ff]"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleTriage(issue);
                        }}
                      >
                        Triage
                      </span>
                    ) : null}
                    <span className="text-[10px] uppercase text-[#6b6b80]">{issue.status.replace("_", " ")}</span>
                    <ChevronRight className="size-4 text-[#4f4f62]" />
                  </button>
                </li>
              ))}
              {visibleIssues.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-[#6b6b80]">No issues in this view.</li>
              ) : null}
            </ul>
          </section>

          {selectedIssue ? (
            <aside className="w-[min(24rem,40vw)] shrink-0 border-l border-[#1f1f28] bg-[#111118]/60 p-4">
              <div className="font-mono text-xs text-[#6b6b80]">{selectedIssue.identifier}</div>
              <h2 className="mt-2 text-lg font-medium text-white">{selectedIssue.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#9b9bb8]">{selectedIssue.description || "No description yet."}</p>

              <div className="mt-5 space-y-3 text-sm">
                <Field label="Status">
                  <select
                    data-coach="status"
                    value={selectedIssue.status}
                    onChange={(event) => {
                      const next = event.target.value as OrbitIssueStatus;
                      const actionId = statusActionFor(next);
                      updateIssue(selectedIssue.id, { status: next }, actionId);
                      if (next === "done") void runEvidenceAction("close_issue");
                    }}
                    className="w-full rounded border border-[#2a2a36] bg-[#0d0d0d] px-2 py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    data-coach="priority"
                    value={selectedIssue.priority}
                    onChange={(event) => {
                      const next = event.target.value as OrbitPriority;
                      const actionId = priorityActionFor(next, selectedIssue.priority);
                      updateIssue(selectedIssue.id, { priority: next }, actionId);
                    }}
                    className="w-full rounded border border-[#2a2a36] bg-[#0d0d0d] px-2 py-1.5 text-sm"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Assignee">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-coach="assign"
                      onClick={() => updateIssue(selectedIssue.id, { assignee: "You" }, "assign_to_self")}
                      className="flex-1 rounded border border-[#2a2a36] px-2 py-1.5 transition hover:border-[#5e6ad2]/50"
                    >
                      Assign to me
                    </button>
                    <button
                      type="button"
                      onClick={() => updateIssue(selectedIssue.id, { assignee: "Alex" }, "assign_teammate")}
                      className="flex-1 rounded border border-[#2a2a36] px-2 py-1.5 transition hover:border-[#5e6ad2]/50"
                    >
                      Assign Alex
                    </button>
                  </div>
                </Field>

                <Field label="Labels">
                  <div className="flex flex-wrap gap-2" data-coach="labels">
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedIssue.labels.includes("bug")) {
                          updateIssue(
                            selectedIssue.id,
                            { labels: [...selectedIssue.labels, "bug"] },
                            "add_label_bug"
                          );
                        }
                      }}
                      className="rounded border border-[#2a2a36] px-2 py-1 text-xs transition hover:border-red-400/50"
                    >
                      + Bug
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedIssue.labels.includes("feature")) {
                          updateIssue(
                            selectedIssue.id,
                            { labels: [...selectedIssue.labels, "feature"] },
                            "add_label_feature"
                          );
                        }
                      }}
                      className="rounded border border-[#2a2a36] px-2 py-1 text-xs transition hover:border-emerald-400/50"
                    >
                      + Feature
                    </button>
                  </div>
                </Field>

                <Field label="Comment">
                  <textarea
                    data-coach="comment"
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    rows={3}
                    placeholder="Add context for the team…"
                    className="w-full resize-y rounded border border-[#2a2a36] bg-[#0d0d0d] px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!commentDraft.trim()) return;
                      setCommentDraft("");
                      void runEvidenceAction("add_comment");
                    }}
                    className="mt-2 rounded border border-[#2a2a36] px-2 py-1 text-xs transition hover:border-[#5e6ad2]/50"
                  >
                    Post comment
                  </button>
                </Field>
              </div>
            </aside>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-[#1f1f28] px-4 py-2 text-[10px] text-[#5c5c70]">
          <span>{isEmitting ? "Streaming evidence…" : bridge ? `Connected · ${bridge.evidenceCount} events` : "Offline demo"}</span>
          <span className="inline-flex items-center gap-1"><Search className="size-3" /> Cmd+K quick actions</span>
        </footer>
      </div>

      <SmartCoachOverlay
        report={report}
        isReporting={isReporting}
        dismissedStep={dismissedCoachStep}
        onDismiss={setDismissedCoachStep}
      />

      {paletteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 pt-[15vh]">
          <div className="w-[min(32rem,92vw)] rounded-lg border border-[#2a2a36] bg-[#14141a] shadow-2xl">
            <div className="border-b border-[#1f1f28] px-4 py-3 text-sm text-[#9b9bb8]">Command palette</div>
            <div className="space-y-1 p-2">
              {[
                { label: "Start cycle", action: "start_cycle" },
                { label: "Create project", action: "create_project" },
                { label: "Fix mis-prioritization", action: "misprioritize_then_fix" },
              ].map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    setPaletteOpen(false);
                    void runEvidenceAction(item.action);
                  }}
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition hover:bg-white/5"
                >
                  {item.label}
                  <Check className="size-3.5 text-[#5e6ad2]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {newIssueOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#2a2a36] bg-[#14141a] p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white">New issue</h3>
            <input
              value={newIssueTitle}
              onChange={(event) => setNewIssueTitle(event.target.value)}
              placeholder="Issue title"
              className="mt-3 w-full rounded border border-[#2a2a36] bg-[#0d0d0d] px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNewIssueOpen(false)} className="rounded px-3 py-1.5 text-xs text-[#9b9bb8]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateIssue}
                className="rounded bg-[#5e6ad2] px-3 py-1.5 text-xs font-medium text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  collapsed,
  coachKey,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  coachKey?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-coach={coachKey}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left transition ${
        active ? "bg-white/10 text-white" : "text-[#9b9bb8] hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#5c5c70]">{label}</div>
      {children}
    </div>
  );
}