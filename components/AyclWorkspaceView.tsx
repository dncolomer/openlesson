"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOrderedSessions, SessionList } from "@/components/SessionList";
import { SessionItem } from "@/components/SessionItem";
import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { WorkspaceMapAuthoringPane } from "@/components/WorkspaceMapAuthoringPane";
import { WorkspaceBlockLocalContextPanel } from "@/components/WorkspaceBlockLocalContextPanel";
import { WorkspaceContextPanel } from "@/components/WorkspaceContextPanel";
import { WorkspaceSimulationPanel } from "@/components/WorkspaceSimulationPanel";
import {
  WorkspaceAddBlockPane,
  type WorkspaceAddBlockSubmitOpts,
} from "@/components/WorkspaceAddBlockPane";
import { WorkspaceGenerateShapePane } from "@/components/WorkspaceGenerateShapePane";
import { aestheticImageForId } from "@/lib/aesthetics";
import { useI18n } from "@/lib/i18n";
import type { Block, Workspace } from "@/components/WorkspaceView";
import {
  availableWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  clearWorkspaceAddTarget,
  clearWorkspaceBlockSelection,
  clearWorkspaceFilledBlockSelection,
  nextWorkspaceBlockSelection,
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
  type EmptySelectionSurface,
  type WorkspaceAddTargetCell,
  WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
  WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
} from "@/lib/workspace-right-pane";
import { WorkspaceCombineBlocksPane } from "@/components/WorkspaceCombineBlocksPane";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import {
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import { buildUpdateBlockPayload } from "@/lib/block-starter-flag";
import {
  applyAddExpandJobProgress,
  createAddExpandJob,
  createAddExpandJobId,
  mergeActiveExpandJobPreviews,
  patchAddExpandJob,
  removeAddExpandJob,
  runAddExpandCreateLoop,
  snapshotAddExpandSlots,
  upsertAddExpandJob,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
import { buildBridgeKnowledgePrompt } from "@/lib/bridge-blocks";
import {
  parseBlockLocalContext,
  type BlockLocalContextInput,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

interface AyclWorkspaceViewProps {
  accessToken: string;
  ownerUserId: string;
  initialPlan: Workspace;
  initialNodes: Block[];
}

export function AyclWorkspaceView({
  accessToken,
  ownerUserId,
  initialPlan,
  initialNodes,
}: AyclWorkspaceViewProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [nodes, setNodes] = useState(initialNodes);
  const [workspaceImage] = useState(() => aestheticImageForId(plan.id));
  const [copied, setCopied] = useState(false);
  // AYCL token holder is owner-equivalent for this purchased workspace.
  const isOwner = true;
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>("workspace");
  const [notesContent, setNotesContent] = useState(initialPlan.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("sessions");
  /** Open block for right-pane detail (double-click). Null → map authoring. */
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [emptySurface, setEmptySurface] = useState<EmptySelectionSurface | null>(null);
  const [selectedFilledBlockIds, setSelectedFilledBlockIds] = useState<string[]>([]);
  const [addExpandPreviewCells, setAddExpandPreviewCells] = useState<
    Array<{ row: number; col: number }> | null
  >(null);
  const [expandJobs, setExpandJobs] = useState<AddExpandJob[]>([]);
  const expandAbortRef = useRef(new Map<string, boolean>());
  const expandJobSeqRef = useRef(0);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>(() =>
    normalizeUnusableCells(initialPlan.unusable_cells),
  );
  const [workspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  const [mapGroundBusy, setMapGroundBusy] = useState(false);

  const handleAbortExpandJob = useCallback((jobId: string) => {
    expandAbortRef.current.set(jobId, true);
    setExpandJobs((prev) => patchAddExpandJob(prev, jobId, { aborted: true }));
  }, []);

  const handleExpandedBlockChange = useCallback((blockId: string | null) => {
    const next = nextWorkspaceBlockSelection(expandedBlockId, blockId);
    setExpandedBlockId(next);
    if (next) {
      setEmptySurface(clearWorkspaceAddTarget());
      setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
      setMobileColumn("workspace");
    }
  }, [expandedBlockId]);

  const handleCloseBlockDetail = useCallback(() => {
    setExpandedBlockId(clearWorkspaceBlockSelection());
  }, []);

  const handleEmptySelectionChange = useCallback(
    (cells: Array<{ row: number; col: number }> | null) => {
      const surface = resolveEmptySelectionSurface({
        selectedEmptyCells: cells || [],
        unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
      });
      setEmptySurface(surface);
      if (surface) {
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        setMobileColumn("workspace");
      }
    },
    [unusableCells],
  );

  const handleSelectedBlockIdsChange = useCallback((ids: string[] | null) => {
    const next = (ids || []).map((id) => String(id).trim()).filter(Boolean);
    setSelectedFilledBlockIds(next);
    if (next.length >= 2) {
      setExpandedBlockId(clearWorkspaceBlockSelection());
      setEmptySurface(clearWorkspaceAddTarget());
      setMobileColumn("workspace");
    }
  }, []);

  const handleCloseEmptyCreate = useCallback(() => {
    setEmptySurface(clearWorkspaceAddTarget());
    setAddExpandPreviewCells(null);
  }, []);

  const handleCloseCombine = useCallback(() => {
    setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
  }, []);

  const handleSubmitAddBlock = useCallback(
    async (
      prompt: string,
      position: WorkspaceAddTargetCell,
      opts?: WorkspaceAddBlockSubmitOpts,
    ) => {
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      const slots: WorkspaceAddTargetCell[] =
        opts?.frozenSlots && opts.frozenSlots.length > 0
          ? opts.frozenSlots.map((c) => ({ row: c.row, col: c.col }))
          : snapshotAddExpandSlots({
              center: position,
              selected: [
                position,
                ...((opts?.expandCells || []).filter(
                  (c) => !(c.row === position.row && c.col === position.col),
                )),
              ],
            });
      if (slots.length === 0) return;

      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: prompt,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      setEmptySurface(clearWorkspaceAddTarget());
      // Do NOT set isAddingBlock — map stays interactive during multi-create.

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt =
                i === 0
                  ? prompt
                  : `${prompt}\n\n(Place a distinct neighboring 1×1 block at row ${slot.row}, col ${slot.col} — different subtopic, same overall theme.)`;
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId: plan.id,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  ayclToken: accessToken,
                  ...(opts?.contextSourceKeys?.length
                    ? { contextSourceKeys: opts.contextSourceKeys }
                    : {}),
                  is_start: Boolean(opts?.isStart),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.error ||
                    `Failed to add block at (${slot.row}, ${slot.col})`,
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to add blocks";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [accessToken, locale, plan.id, router],
  );

  const handleGenerateBridge = useCallback(
    async (input: {
      blockIds: string[];
      density: number;
      userPrompt?: string;
      frozenSlots: Array<{ row: number; col: number }>;
      blockTitles: string[];
    }) => {
      const slots = (input.frozenSlots || []).map((c) => ({
        row: c.row,
        col: c.col,
      }));
      if (slots.length === 0) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;

      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `bridge-${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: `Bridge: ${(input.blockTitles || []).slice(0, 2).join(" ↔ ") || "topics"}`,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt = buildBridgeKnowledgePrompt({
                blockTitles: input.blockTitles,
                userGuidance: input.userPrompt,
                slotIndex: i,
                totalSlots: slots.length,
                cell: slot,
              });
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId: plan.id,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  ayclToken: accessToken,
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.error ||
                    `Failed to add bridge block at (${slot.row}, ${slot.col})`,
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate bridge";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [accessToken, locale, plan.id, router],
  );

  const handleSubmitGenerateShape = useCallback(
    async (payload: {
      prompt: string;
      cells: WorkspaceAddTargetCell[];
      contextSourceKeys?: string[];
      isStart?: boolean;
    }) => {
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { placements } = buildSkillGridLayout(nodes);
      const anchor = payload.cells[0]
        ? { row: payload.cells[0].row, col: payload.cells[0].col }
        : null;
      const weightedNeighbors = anchor
        ? getWeightedNeighborhood(anchor, placements, nodesById)
        : [];
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            op: "generate_shape",
            prompt: payload.prompt,
            cells: payload.cells,
            weightedNeighbors,
            model,
            locale,
            ayclToken: accessToken,
            ...(payload.contextSourceKeys?.length
              ? { contextSourceKeys: payload.contextSourceKeys }
              : {}),
            is_start: Boolean(payload.isStart),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to generate block");
        }
        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setEmptySurface(clearWorkspaceAddTarget());
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [accessToken, locale, nodes, plan.id, router],
  );

  const rightPane = resolveWorkspaceRightPane(
    expandedBlockId,
    emptySurface,
    selectedFilledBlockIds,
  );
  const addTargetCell =
    emptySurface?.kind === "add_block" ? emptySurface.cell : null;
  const generateShapeCells =
    emptySurface?.kind === "generate_shape" ? emptySurface.cells : null;
  const combineBlockIds =
    rightPane === "combine_blocks" ? selectedFilledBlockIds : [];
  const orderedBlocks = getOrderedSessions(nodes as Parameters<typeof getOrderedSessions>[0]);
  const detailBlock =
    expandedBlockId != null
      ? orderedBlocks.find((n) => n.id === expandedBlockId) ?? null
      : null;
  const detailIndex = detailBlock
    ? orderedBlocks.findIndex((n) => n.id === detailBlock.id)
    : -1;

  const handleCombineBlocks = useCallback(
    async (input: { blockIds: string[]; prompt?: string }) => {
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            ayclToken: accessToken,
            op: "merge",
            blockIds: input.blockIds,
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to combine blocks");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        setExpandedBlockId(clearWorkspaceBlockSelection());
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [accessToken, locale, plan.id, router],
  );

  const handleSplitBlock = useCallback(
    async (input: { blockId: string; prompt?: string }) => {
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            ayclToken: accessToken,
            op: "split",
            blockIds: [input.blockId],
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to split block");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [accessToken, locale, plan.id, router],
  );

  const refreshWorkspace = useCallback(async () => {
    const res = await fetch(`/api/aycl/workspace?token=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    if (res.ok && data.workspace) {
      setPlan(data.workspace);
      setUnusableCells(normalizeUnusableCells(data.workspace.unusable_cells));
      setNodes(
        (data.blocks || []).map((n: Block & { local_context?: unknown }) => ({
          ...n,
          local_context: parseBlockLocalContext(n.local_context),
        })),
      );
      setNotesContent(data.workspace.notes || "");
    }
  }, [accessToken]);

  const postMapGround = useCallback(
    async (payload: Record<string, unknown>) => {
      setMapGroundBusy(true);
      try {
        const res = await fetch("/api/workspace/map-ground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            ayclToken: accessToken,
            ...payload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Map ground update failed");
        if (Array.isArray(data.unusableCells)) {
          setUnusableCells(normalizeUnusableCells(data.unusableCells));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        return data;
      } finally {
        setMapGroundBusy(false);
      }
    },
    [accessToken, plan.id],
  );

  const handleUpdateBlock = useCallback(
    async (input: {
      blockId: string;
      title: string;
      description: string;
      isStart?: boolean;
    }) => {
      setIsAddingBlock(true);
      try {
        const fields = buildUpdateBlockPayload({
          blockId: input.blockId,
          title: input.title,
          description: input.description,
          isStart: input.isStart,
          includeIsStart: input.isStart !== undefined,
        });
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            ayclToken: accessToken,
            op: "update_block",
            ...fields,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to update block");
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [accessToken, plan.id, router],
  );

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: plan.id,
            ayclToken: accessToken,
            op: "delete_block",
            blockId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to delete block");
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setEmptySurface(clearWorkspaceAddTarget());
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [accessToken, plan.id, router],
  );

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const selectSection = useCallback((section: WorkspaceSectionKey) => {
    setActiveSection(resolveActiveSection(section, { isOwner }));
    if (section === "workspace") {
      setMobileColumn("workspace");
    }
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCustomStart = async (node: Block) => {
    const res = await fetch("/api/aycl/start-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: accessToken,
        blockId: node.id,
        blockTitle: node.title,
        planningPrompt: node.planning_prompt,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start session");
    router.push(`/learn/${accessToken}/session?id=${data.session.id}`);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: plan.id,
          notes: notesContent,
          ayclToken: accessToken,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save notes");
      }
      setPlan({ ...plan, notes: notesContent });
      setIsEditingNotes(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      alert(error instanceof Error ? error.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const sectionLayout = resolveWorkspaceSectionLayout(activeSection);
  const visibleSections = availableWorkspaceSections({ isOwner });

  const sectionConfig = [
    {
      key: "workspace" as const,
      label: t("planView.sectionWorkspace"),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"
          />
        </svg>
      ),
    },
    ...(visibleSections.includes("context")
      ? [
          {
            key: "context" as const,
            label: t("planView.sectionContext"),
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("simulation")
      ? [
          {
            key: "simulation" as const,
            label: t("planView.sectionSimulation"),
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("knowledge")
      ? [
          {
            key: "knowledge" as const,
            label: t("planView.sectionKnowledge"),
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("settings")
      ? [
          {
            key: "settings" as const,
            label: t("planView.sectionSetting"),
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 4.5l-4.5 15"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const detailLockTitles =
    detailBlock?.lock_until_block_ids
      ?.map((id) => nodes.find((n) => n.id === id)?.title || id)
      .filter(Boolean) || [];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800/60 px-4 py-3">
        <div className="min-w-0">
          <Link href="/all-you-can-learn" className="text-xs text-neutral-500 hover:text-neutral-300">
            All-You-Can-Learn
          </Link>
          <h1 className="truncate text-base font-semibold">{plan.title || plan.root_topic}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
              Lifetime access
            </span>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
              Open-ended only
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy access link"}
        </button>
      </header>

      <WorkspaceSectionNav
        sections={sectionConfig}
        activeSection={activeSection}
        onChange={selectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
      />

      {sectionLayout.mountsContextPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <div
            data-workspace-context-section
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceContextPanel
              workspaceId={plan.id}
              isOwner
              notesContent={notesContent}
              setNotesContent={setNotesContent}
              isEditingNotes={isEditingNotes}
              setIsEditingNotes={setIsEditingNotes}
              savingNotes={savingNotes}
              onSaveNotes={saveNotes}
              onCancelNotes={() => {
                setNotesContent(plan.notes || "");
                setIsEditingNotes(false);
              }}
              showFiles={false}
              seedQuery={plan.root_topic || plan.title}
              ayclToken={accessToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.mountsSimulationPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <div
            data-workspace-simulation-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceSimulationPanel
              blocks={nodes}
              workspaceTitle={plan.title || plan.root_topic}
              workspaceGoal={plan.workspace_goal}
              workspaceDescription={plan.description}
              workspaceNotes={notesContent || plan.notes}
              workspaceFileCount={workspaceFileItems.length}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.mountsPerformancePanel && (
        <WorkspaceSectionSurface
          kind="knowledge"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <WorkspacePerformancePanel
              workspaceId={plan.id}
              isOwner
              currentUserId={ownerUserId}
              hideTap
              ayclToken={accessToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.mountsIntegrationPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <WorkspaceIntegrationPanel
            workspaceId={plan.id}
            workspaceTitle={plan.title || plan.root_topic}
            planTopic={plan.root_topic}
            planDescription={plan.description}
            planNotes={plan.notes}
            isOwner
            currentUserId={ownerUserId}
          />
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.showBlockMapChrome && (
        <>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside
              className={`${mobileColumn === "sessions" ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] md:flex md:h-full ${WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS} md:border-b-0 md:border-r`}
            >
              <SessionList
                nodes={nodes}
                onSelect={() => {}}
                onDelete={() => {}}
                onFork={() => {}}
                isOwner
                isGroupPlan={false}
                isLoggedIn={false}
                planTopic={plan.root_topic}
                workspaceId={plan.id}
                onRefresh={refreshWorkspace}
                onNodesUpdate={setNodes}
                hideTap
                onCustomStart={handleCustomStart}
                ayclToken={accessToken}
                expandedNodeId={expandedBlockId}
                onExpandedNodeIdChange={handleExpandedBlockChange}
                onEmptySelectionChange={handleEmptySelectionChange}
                onSelectedBlockIdsChange={handleSelectedBlockIdsChange}
                unusableCells={unusableCells}
                workspaceNotes={notesContent || plan.notes}
                previewEmptyCells={addExpandPreviewCells}
                expandJobs={expandJobs}
                onAbortExpandJob={handleAbortExpandJob}
                onMapGround={async (payload) => {
                  if (payload.op === "set_lock_until" && payload.blockId) {
                    await postMapGround({
                      op: "set_lock_until",
                      blockId: payload.blockId,
                      prerequisiteIds: payload.prerequisiteIds || [],
                    });
                    return;
                  }
                  if (payload.op === "set_unusable_cells") {
                    await postMapGround({
                      op: "set_unusable_cells",
                      unusableCells: payload.unusableCells || [],
                    });
                  }
                }}
              />
            </aside>

            <section
              className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080808] md:flex ${WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS} md:flex-none`}
            >
              {workspaceImage ? (
                <img
                  src={workspaceImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

              <div className="relative z-20 hidden shrink-0 px-3 pt-3 pb-1 sm:px-4 md:block">
                <div className="overflow-visible rounded-xl border border-neutral-800/70 bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                  <div className="border-b border-neutral-800/60 px-4 py-3">
                    <p className="text-sm text-neutral-300">{plan.title || plan.root_topic}</p>
                    {plan.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{plan.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <main
                className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-0"
                data-workspace-right-column
                data-workspace-right-pane={rightPane}
              >
                {rightPane === "combine_blocks" && combineBlockIds.length >= 2 ? (
                  <WorkspaceCombineBlocksPane
                    key={`combine-${combineBlockIds.join(",")}`}
                    blockIds={combineBlockIds}
                    nodes={nodes}
                    busy={isAddingBlock}
                    unusableCells={unusableCells}
                    onCombine={handleCombineBlocks}
                    onGenerateBridge={handleGenerateBridge}
                    onBridgePreviewChange={setAddExpandPreviewCells}
                    onCancel={handleCloseCombine}
                    labels={{
                      combine: t("sessionList.gridMerge") || "Combine into one block",
                      cancel: t("sessionList.gridAddCancel") || "Cancel",
                    }}
                  />
                ) : rightPane === "block_detail" && detailBlock && detailIndex >= 0 ? (
                  <WorkspaceBlockDetailPane
                    key={detailBlock.id}
                    title={detailBlock.title}
                    blockId={detailBlock.id}
                    blockTitle={detailBlock.title}
                    blockDescription={detailBlock.description}
                    planningPrompt={detailBlock.planning_prompt}
                    localContext={detailBlock.local_context}
                    blockStatus={detailBlock.status}
                    isStart={detailBlock.is_start}
                    lockUntilTitles={detailLockTitles}
                    spanW={detailBlock.span_w}
                    spanH={detailBlock.span_h}
                    shapeCells={detailBlock.shape_cells}
                    workspaceId={plan.id}
                    ayclToken={accessToken}
                    locale={locale}
                    canEdit
                    editBusy={isAddingBlock}
                    onUpdateBlock={handleUpdateBlock}
                    onDeleteBlock={handleDeleteBlock}
                    onSplitBlock={handleSplitBlock}
                    localContextPanel={
                      <WorkspaceBlockLocalContextPanel
                        key={detailBlock.id}
                        canEdit
                        blockId={detailBlock.id}
                        blockTitle={detailBlock.title}
                        blockDescription={detailBlock.description}
                        blockStatus={detailBlock.status}
                        lockUntilTitles={detailLockTitles}
                        localContext={detailBlock.local_context}
                        workspaceFiles={workspaceFileItems}
                        onSaveLocalContext={async (blockId, localContext) => {
                          await postMapGround({
                            op: "set_local_context",
                            blockId,
                            localContext,
                          });
                        }}
                        busy={mapGroundBusy}
                      />
                    }
                  >
                    <SessionItem
                      node={detailBlock}
                      index={detailIndex}
                      onSelect={() => {}}
                      onDelete={() => {}}
                      onFork={() => {}}
                      isExpanded
                      isOwner
                      isLoggedIn={false}
                      planTopic={plan.root_topic}
                      workspaceId={plan.id}
                      variant="detail"
                      detailLayout="inline"
                      hideTap
                      onCustomStart={handleCustomStart}
                    />
                  </WorkspaceBlockDetailPane>
                ) : rightPane === "add_block" && addTargetCell ? (
                  <WorkspaceAddBlockPane
                    key={`add-${addTargetCell.row}-${addTargetCell.col}`}
                    cell={addTargetCell}
                    nodes={nodes}
                    workspaceId={plan.id}
                    ayclToken={accessToken}
                    locale={locale}
                    busy={false}
                    workspaceNotes={notesContent || plan.notes}
                    unusableCells={unusableCells}
                    onSubmit={handleSubmitAddBlock}
                    onCancel={handleCloseEmptyCreate}
                    onExpandPreviewChange={setAddExpandPreviewCells}
                    labels={{
                      addTitle: t("sessionList.gridAddTitle"),
                      addPlaceholder: t("sessionList.gridAddPlaceholder"),
                      addSubmit: t("sessionList.gridAddSubmit"),
                      addCancel: t("sessionList.gridAddCancel"),
                      suggestTopics: t("sessionList.gridSuggestTopics"),
                      suggesting: t("sessionList.gridSuggesting"),
                      suggestError: t("sessionList.gridSuggestError"),
                    }}
                  />
                ) : rightPane === "generate_shape" && generateShapeCells ? (
                  <WorkspaceGenerateShapePane
                    key={`shape-${generateShapeCells.map((c) => `${c.row}:${c.col}`).join(",")}`}
                    cells={generateShapeCells}
                    nodes={nodes}
                    workspaceId={plan.id}
                    ayclToken={accessToken}
                    locale={locale}
                    busy={isAddingBlock}
                    workspaceNotes={notesContent || plan.notes}
                    onSubmit={handleSubmitGenerateShape}
                    onCancel={handleCloseEmptyCreate}
                    labels={{
                      generateShape: t("sessionList.gridGenerateShape"),
                      addPlaceholder: t("sessionList.gridAddPlaceholder"),
                      addSubmit: t("sessionList.gridAddSubmit"),
                      addCancel: t("sessionList.gridAddCancel"),
                      suggestTopics: t("sessionList.gridSuggestTopics"),
                      suggesting: t("sessionList.gridSuggesting"),
                      suggestError: t("sessionList.gridSuggestError"),
                    }}
                  />
                ) : (
                  <WorkspaceMapAuthoringPane canEdit />
                )}
              </main>
            </section>
          </div>

          <div className="shrink-0 border-t border-neutral-800/70 bg-[#0b0b0b] px-3 py-2 md:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-800 bg-neutral-950/70 p-1">
              {[
                { key: "sessions" as const, label: "Map" },
                { key: "workspace" as const, label: "Tools" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileColumn(key)}
                  className={`rounded px-2 py-2 text-xs font-medium transition-colors ${
                    mobileColumn === key
                      ? "bg-neutral-700/80 text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
