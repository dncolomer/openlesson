"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  mapWorkspaceNodes,
  type Block,
  type Workspace,
  type WorkspaceViewProps,
  planShareSlug,
  parseSectionParam,
} from "@/components/workspace-view/types";
import {
  WorkspaceLoadError,
  WorkspaceLoading,
  WorkspaceViewChrome,
} from "@/components/workspace-view/workspace-chrome";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { WorkspaceSectionHosts } from "@/components/workspace-view/workspace-section-hosts";
import { useWorkspaceLearner } from "@/components/workspace-view/use-workspace-learner";
import { useWorkspaceMapSelection } from "@/components/workspace-view/use-workspace-map-selection";
import { useWorkspaceAuthoring } from "@/components/workspace-view/use-workspace-authoring";
import { useWorkspaceExpandJobs } from "@/components/workspace-view/use-workspace-expand-jobs";
import { useWorkspaceChrome } from "@/components/workspace-view/use-workspace-chrome";
import { useWorkspaceLoad } from "@/components/workspace-view/use-workspace-load";
import { buildWorkspaceSectionNavItems } from "@/components/workspace-view/workspace-section-nav-items";
import { WorkspaceMobilePlanAside } from "@/components/workspace-view/workspace-mobile-plan-aside";
import { WorkspaceMobileTabBar } from "@/components/workspace-view/workspace-mobile-tab-bar";
import { WorkspaceMapColumn } from "@/components/workspace-view/workspace-map-column";
import { WorkspaceRightDrawers } from "@/components/workspace-view/workspace-right-drawers";
import { WorkspaceUnsysSeedStudio } from "@/components/WorkspaceUnsysSeedStudio";
import {
  canAccessPrivilegedWorkspaceSections,
  defaultWorkspaceSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  workspaceIdlePaneShowsExplore,
  workspaceShell,
  workspaceSurfaceShowsAuthoring,
} from "@/lib/workspace-mode";
import { parseWorkspaceKind } from "@/lib/workspace-kind";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  generatorTargetHighlightCells,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  isPlayCopyWorkspace,
  playCopyBlockSidebar,
  playCopyStartSessionLabel,
  playCopyStartSessionTarget,
} from "@/lib/workspace-play-copy";
import { WorkspacePlaySidebar } from "@/components/workspace-view/workspace-play-sidebar";

export type { Block, Workspace, WorkspaceViewProps };

export function WorkspaceView({
  initialPlan,
  initialNodes,
  ayclToken,
  ayclOwnerUserId,
  ayclAccessTier: ayclAccessTierProp,
  workspaceIdOverride,
  hideNavbar: _hideNavbar = false,
  accessBanner,
}: WorkspaceViewProps) {
  const { t, locale } = useI18n();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId =
    (workspaceIdOverride || (params?.id as string | undefined) || "").trim() ||
    String(initialPlan?.id || "");
  const isAycl = Boolean(ayclToken);
  const sectionFromUrl = parseSectionParam(searchParams.get("section"));
  const knowledgeSubviewFromUrl = searchParams.get("subview");

  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>(
    () =>
      sectionFromUrl ??
      defaultWorkspaceSection(parseWorkspaceKind(initialPlan?.workspace_kind)),
  );
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("plan");
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [generateMapPreviewCells, setGenerateMapPreviewCells] = useState<
    Array<{ row: number; col: number }> | null
  >(null);
  const [, setMapGroundBusy] = useState(false);
  const [learnerDrawerRequest, setLearnerDrawerRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [playStartBusy, setPlayStartBusy] = useState(false);
  const [unsysStudioBlockId, setUnsysStudioBlockId] = useState<string | null>(null);

  const {
    ayclUpgradeBusy,
    ayclUpgradePriceLabel,
    setAyclUpgradePriceLabel,
    startAyclUpgradeCheckout,
  } = useWorkspaceChrome({
    ayclToken,
    workspaceId,
  });

  const {
    supabase,
    plan,
    setPlan,
    nodes,
    setNodes,
    loading,
    error,
    currentUserId,
    isOrgAdmin,
    unusableCells,
    setUnusableCells,
    workspaceDags,
    setWorkspaceDags,
    workspaceMapTypes,
    workspaceFileItems,
    ayclCapabilities,
    workspaceImage,
    mapOverlay,
    injectHeliosOverlay,
    handleMapOverlayChange,
    handleApplyHeliosOverlay,
    refreshAyclWorkspace,
    refreshNodes,
  } = useWorkspaceLoad({
    initialPlan,
    initialNodes,
    ayclToken,
    ayclOwnerUserId,
    ayclAccessTier: ayclAccessTierProp,
    workspaceId,
    isAycl,
    router,
    setAyclUpgradePriceLabel,
  });

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // AYCL: one workspace mode — authoring follows canAuthor (always on).
  const isOwner = isAycl
    ? Boolean(ayclCapabilities?.canAuthor)
    : currentUserId
      ? plan?.user_id === currentUserId
      : false;
  const playCopy = isPlayCopyWorkspace(plan);
  const authoringOnMap = workspaceSurfaceShowsAuthoring({
    isOwner,
    isOrgAdmin,
    allowAuthoring: playCopy
      ? false
      : ayclCapabilities
        ? ayclCapabilities.allowCreatorModeToggle
        : undefined,
    workspaceKind: parseWorkspaceKind(plan?.workspace_kind),
  });
  const {
    generatorTargetPreviewCells,
    setGeneratorTargetPreviewCells,
    generatorPickActive,
    setGeneratorPickActiveSafe,
    registerGeneratorEmptyToggle,
    handleGeneratorEmptyToggle,
    dynamicPickActive,
    setDynamicPickActiveSafe,
    dynamicUnlockPreviewIds,
    setDynamicUnlockPreviewIds,
    registerDynamicBlockToggle,
    handleDynamicBlockToggle,
    mapSelection,
    applyMapSelectionResult,
    handleMapSelectionChange,
    selectiveExplanationActive,
    setSelectiveExplanationActive,
    selectiveExplanationPolygon,
    setSelectiveExplanationPolygon,
    injectMapNote,
    addExpandPreviewCells,
    setAddExpandPreviewCells,
    expandJobs,
    setExpandJobs,
    clusterMapJob,
    setClusterMapJob,
    expandAbortRef,
    expandJobSeqRef,
    cloneArm,
    setCloneArm,
    handleAbortExpandJob,
    expandedBlockId,
    selectedFilledBlockIds,
    emptySurface,
    handleExpandedBlockChange,
    handleCloseBlockDetail,
    handleCloneArm,
    handleCloneCancel,
    handleEmptyMapSearchBlocks,
    handleEmptyMapSuggestCells,
    handleSelectiveExplanationComplete,
    handleCreateNoteFromSummary,
    handleCloseEmptyCreate,
    handleCloseCombine,
    rightPane,
    addTargetCell,
    generateShapeCells,
    combineBlockIds,
    detailBlock,
    detailIndex,
  } = useWorkspaceMapSelection({
    authoring: authoringOnMap,
    unusableCells,
    nodes,
    setMobileColumn,
  });

  const canAccessPrivilegedSections = canAccessPrivilegedWorkspaceSections({
    isOwner,
    isOrgAdmin,
  });

  const {
    handleClonePaste,
    handleCombineBlocks,
    handleSplitBlock,
    handleSubmitGenerateShape,
    handleUpdateBlock,
    handleSaveCreatorEffects,
    handleSaveAnswersModelSeed,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleClusterBlocks,
    handleClusterProgress,
    handleApplyDag,
    handleDeleteDag,
    handleMapGround,
  } = useWorkspaceAuthoring({
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodes,
    setNodes,
    applyMapSelectionResult,
    setCloneArm,
    setIsAddingBlock,
    setClusterMapJob,
    setUnusableCells,
    setWorkspaceDags,
    setMapGroundBusy,
    refreshNodes,
  });

  const {
    handleExpandFromSourceBlock,
    handleSubmitAddBlock,
    handleGenerateBridge,
  } = useWorkspaceExpandJobs({
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodesRef,
    setNodes,
    setExpandJobs,
    setAddExpandPreviewCells,
    expandAbortRef,
    expandJobSeqRef,
    applyMapSelectionResult,
    setCloneArm,
    refreshNodes,
  });

  const handleGenerateMap = useCallback(
    async (input: {
      anchorRow: number;
      anchorCol: number;
      modifier: string;
      mapTypeId: string;
    }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/generate-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            anchorRow: input.anchorRow,
            anchorCol: input.anchorCol,
            modifier: input.modifier,
            mapTypeId: input.mapTypeId,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to generate map"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            mapWorkspaceNodes(data.updatedNodes, {
              ayclClone: Boolean(ayclToken),
            }),
          );
        }
        if (data.unusable_cells) {
          setUnusableCells(normalizeUnusableCells(data.unusable_cells));
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to generate map");
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, workspaceId],
  );

  const handleNodesUpdate = (newNodes: Block[]) => {
    setNodes(newNodes);
  };

  const handleShare = () => {
    const slug = planShareSlug(plan!);
    const url = `${window.location.origin}/p/${plan!.id}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (plan?.notes !== undefined) {
      setNotesContent(plan.notes || "");
    }
  }, [plan?.notes]);

  /**
   * AYCL clones are not isOwner, but Learner mode still needs Knowledge
   * (embeddings). Always resolve sections through the mode-aware helper —
   * never owner-only resolveActiveSection alone (that snaps Knowledge → Workspace).
   */
  const workspaceKind = parseWorkspaceKind(plan?.workspace_kind);
  const practiceOnlyAycl = Boolean(
    isAycl && ayclCapabilities && !ayclCapabilities.allowCreatorModeToggle,
  );
  const shell = useMemo(
    () =>
      workspaceShell({
        kind: workspaceKind,
        authoring: authoringOnMap,
        practiceOnly: practiceOnlyAycl,
        isOwner,
        isOrgAdmin,
        isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
        playCopy: playCopy,
      }),
    [
      authoringOnMap,
      ayclToken,
      currentUserId,
      isOrgAdmin,
      isOwner,
      playCopy,
      practiceOnlyAycl,
      workspaceKind,
    ],
  );

  useEffect(() => {
    setActiveSection((current) =>
      shell.sections.includes(current)
        ? current
        : (shell.sections[0] ?? defaultWorkspaceSection(workspaceKind)),
    );
  }, [shell.sections, workspaceKind]);

  const selectSection = useCallback(
    (section: WorkspaceSectionKey) => {
      setActiveSection(
        shell.sections.includes(section)
          ? section
          : (shell.sections[0] ?? defaultWorkspaceSection(workspaceKind)),
      );
      if (section === "workspace") {
        setMobileColumn("workspace");
      }
    },
    [shell.sections, workspaceKind],
  );

  const saveNotes = async () => {
    if (!plan) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: plan.id, notes: notesContent, ...(ayclToken ? { ayclToken } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, notes: notesContent });
        setIsEditingNotes(false);
      } else {
        alert(errorMessageFromBody(data, "Failed to save notes"));
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const {
    dynamicGeneratedIds,
    handleBlocksUpdated,
    handleLaunchIntent,
  } = useWorkspaceLearner({
    workspaceId,
    ayclToken,
    currentUserId,
    locale,
    learnerActivity: shell.learnerActivity,
    nodes,
    setNodes,
    router,
  });

  useEffect(() => {
    if (shell.learnerSurface || !isOwner) {
      setUnsysStudioBlockId(null);
    }
  }, [isOwner, shell.learnerSurface]);

  useEffect(() => {
    if (
      unsysStudioBlockId &&
      !nodes.some((node) => node.id === unsysStudioBlockId)
    ) {
      setUnsysStudioBlockId(null);
    }
  }, [nodes, unsysStudioBlockId]);

  if (loading) {
    return <WorkspaceLoading message={t("planView.loading")} />;
  }

  if (error || !plan) {
    return (
      <WorkspaceLoadError
        error={error}
        fallback={t("planView.planNotFound")}
        homeLabel={t("planView.goBackHome")}
      />
    );
  }

  const resolvedSection = shell.sections.includes(activeSection)
    ? activeSection
    : (shell.sections[0] ?? defaultWorkspaceSection(workspaceKind));
  const sectionLayout = resolveWorkspaceSectionLayout(resolvedSection);
  // One surface: the map plus authoring sections for people who can design.
  // No-map kinds have no WorkspaceView sections. Play-only stays on the map.
  const visibleSections = shell.sections;
  const idleExplore = workspaceIdlePaneShowsExplore({
    allowExplore:
      workspaceKind === "knowledge_region"
        ? false
        : ayclCapabilities
          ? ayclCapabilities.allowExplore
          : isOwner || isOrgAdmin,
  });
  const isLearnerMode = shell.learnerSurface;
  const unsysStudioBlock =
    isOwner && !isLearnerMode && unsysStudioBlockId
      ? nodes.find((node) => node.id === unsysStudioBlockId) ?? null
      : null;
  const showCreatorDrawers = shell.authoringDrawers;

  const sectionConfig = buildWorkspaceSectionNavItems({
    t,
    isLearnerMode,
    isOwner,
    visibleSections,
  });

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden border border-white/40 bg-black text-white"
      data-console-frame=""
      data-workspace-shell=""
      data-aycl-shell={isAycl ? "true" : undefined}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden">
      <WorkspaceViewChrome
        isAycl={isAycl}
        accessBanner={shell.playView ? undefined : accessBanner}
        ayclCapabilities={ayclCapabilities}
        ayclUpgradePriceLabel={ayclUpgradePriceLabel}
        ayclUpgradeBusy={ayclUpgradeBusy}
        onUpgrade={startAyclUpgradeCheckout}
        sections={sectionConfig}
        activeSection={resolvedSection}
        onSelectSection={selectSection}
        plan={plan}
        playView={shell.playView}
      />

      {unsysStudioBlock && !shell.playView ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkspaceUnsysSeedStudio
            blockId={unsysStudioBlock.id}
            blockTitle={unsysStudioBlock.title}
            blockDescription={unsysStudioBlock.description}
            seed={unsysStudioBlock.answers_model_seed}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            busy={isAddingBlock}
            onClose={() => {
              setUnsysStudioBlockId(null);
            }}
            onSaveSeed={handleSaveAnswersModelSeed}
          />
        </div>
      ) : (
      <>
      {shell.playView ? null : <WorkspaceSectionHosts
        isLearnerMode={isLearnerMode}
        isOwner={isOwner}
        canAccessPrivilegedSections={canAccessPrivilegedSections}
        sectionLayout={sectionLayout}
        visibleSections={visibleSections}
        workspaceImage={workspaceImage}
        plan={plan}
        workspaceId={workspaceId}
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
        isAycl={isAycl}
        ayclToken={ayclToken}
        nodes={nodes}
        workspaceDags={workspaceDags}
        workspaceMapTypes={workspaceMapTypes}
        isAddingBlock={isAddingBlock}
        onSaveDagEdit={handleApplyDag}
        onDeleteDag={handleDeleteDag}
        onOpenUnsysStudio={
          isOwner && !isLearnerMode
            ? ({ blockId }) => {
                setUnsysStudioBlockId(blockId);
              }
            : undefined
        }
        onSaveAnswersModelSeed={
          isOwner ? handleSaveAnswersModelSeed : undefined
        }
        currentUserId={currentUserId}
        knowledgeLwmEmbeddingsOnly={shell.knowledgeLwmEmbeddingsOnly}
        knowledgeSubviewFromUrl={knowledgeSubviewFromUrl}
        onPlanUpdate={setPlan}
        t={t}
      />}

      {sectionLayout.showBlockMapChrome && visibleSections.includes("workspace") && (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {shell.playView ? null : (
        <WorkspaceMobilePlanAside
          mobileColumn={mobileColumn}
          plan={plan}
          isOwner={isOwner}
          copied={copied}
          selectSection={selectSection}
          onOpenSessions={() => {
            selectSection("workspace");
            setMobileColumn("sessions");
          }}
          onShare={handleShare}
        />
        )}

        <WorkspaceMapColumn
          mobileColumn={mobileColumn}
          nodes={nodes}
          isOwner={isOwner}
          isLearnerMode={isLearnerMode}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          isAycl={isAycl}
          cloneArmed={cloneArm.armed}
          cloneSourceBlockId={cloneArm.armed ? cloneArm.sourceBlockId : null}
          onCloneArm={isOwner && !isLearnerMode ? handleCloneArm : undefined}
          onCloneCancel={handleCloneCancel}
          onClonePaste={
            isOwner && !isLearnerMode
              ? (sourceBlockId, target) => {
                  void handleClonePaste(sourceBlockId, target);
                }
              : undefined
          }
          supabase={supabase}
          plan={plan}
          workspaceId={workspaceId}
          onRefresh={isAycl ? () => void refreshAyclWorkspace() : refreshNodes}
          onNodesUpdate={handleNodesUpdate}
          expandedBlockId={expandedBlockId}
          onExpandedNodeIdChange={(blockId) => {
            setLearnerDrawerRequest(null);
            handleExpandedBlockChange(blockId);
          }}
          onMapSelectionChange={(selection) => {
            setLearnerDrawerRequest(null);
            handleMapSelectionChange(selection);
          }}
          mapSelection={mapSelection}
          selectiveExplanationActive={selectiveExplanationActive}
          selectiveExplanationPolygon={selectiveExplanationPolygon}
          onSelectiveExplanationComplete={handleSelectiveExplanationComplete}
          injectMapNote={injectMapNote}
          injectHeliosOverlay={injectHeliosOverlay}
          onMapOverlayChange={handleMapOverlayChange}
          unusableCells={unusableCells}
          onMapGround={
            isOwner && !isLearnerMode ? handleMapGround : undefined
          }
          workspaceNotes={notesContent || plan.notes || ""}
          previewEmptyCells={
            isLearnerMode
              ? null
              : generateMapPreviewCells && generateMapPreviewCells.length > 0
                ? generateMapPreviewCells
                : addExpandPreviewCells
          }
          generatorTargetPreviewCells={
            generatorTargetPreviewCells ??
            (detailBlock
              ? generatorTargetHighlightCells(
                  parseBlockCreatorEffects(detailBlock.creator_effects, {
                    selfBlockId: detailBlock.id,
                  }),
                )
              : null)
          }
          generatorPickActive={!isLearnerMode && generatorPickActive}
          onGeneratorEmptyToggle={
            !isLearnerMode ? handleGeneratorEmptyToggle : undefined
          }
          dynamicPickActive={!isLearnerMode && dynamicPickActive}
          onDynamicBlockToggle={
            !isLearnerMode ? handleDynamicBlockToggle : undefined
          }
          dynamicUnlockPreviewIds={
            dynamicUnlockPreviewIds ??
            (detailBlock
              ? (() => {
                  const e = parseBlockCreatorEffects(
                    detailBlock.creator_effects,
                    { selfBlockId: detailBlock.id },
                  );
                  return e.dynamic.enabled
                    ? e.dynamic.unlockAfterBlockIds
                    : null;
                })()
              : null)
          }
          dynamicContentGeneratedIds={dynamicGeneratedIds}
          expandJobs={isLearnerMode ? [] : expandJobs}
          clusterMapJob={isLearnerMode ? null : clusterMapJob}
          onAbortExpandJob={handleAbortExpandJob}
          playView={shell.playView}
        />

        {shell.playView ? (
          playCopyBlockSidebar(detailBlock) ? (
            <WorkspacePlaySidebar
              title={playCopyBlockSidebar(detailBlock)!.title}
              description={playCopyBlockSidebar(detailBlock)!.description}
              startLabel={playCopyStartSessionLabel()}
              busy={playStartBusy}
              onClose={handleCloseBlockDetail}
              onStart={() => {
                if (!detailBlock || playStartBusy) return;
                setPlayStartBusy(true);
                void handleLaunchIntent(detailBlock, playCopyStartSessionTarget())
                  .catch((err) => {
                    alert(err instanceof Error ? err.message : "Could not start session");
                  })
                  .finally(() => setPlayStartBusy(false));
              }}
            />
          ) : null
        ) : (
        <WorkspaceRightDrawers
          mobileColumn={mobileColumn}
          workspaceImage={workspaceImage}
          idleExplore={idleExplore}
          rightPane={rightPane}
          isOwner={isOwner}
          showCreatorDrawers={showCreatorDrawers}
          learnerNotes={shell.learnerActivity}
          workspaceId={workspaceId}
          ayclToken={ayclToken}
          locale={locale}
          nodes={nodes}
          mapSelection={mapSelection}
          workspaceMapTypes={workspaceMapTypes}
          unusableCells={unusableCells}
          selectiveExplanationPolygon={selectiveExplanationPolygon}
          selectiveExplanationActive={selectiveExplanationActive}
          onSearchSelectBlocks={handleEmptyMapSearchBlocks}
          onSuggestSelectEmptyCells={handleEmptyMapSuggestCells}
          onStartSelectiveDraw={() => {
            setSelectiveExplanationActive(true);
            setSelectiveExplanationPolygon(null);
          }}
          onClearSelectiveOverlay={() => {
            setSelectiveExplanationActive(false);
            setSelectiveExplanationPolygon(null);
          }}
          onCreateNoteFromSummary={handleCreateNoteFromSummary}
          detailBlock={detailBlock}
          detailIndex={detailIndex}
          onBlocksUpdated={handleBlocksUpdated}
          combineBlockIds={combineBlockIds}
          isAddingBlock={isAddingBlock}
          onCombine={handleCombineBlocks}
          onGenerateBridge={handleGenerateBridge}
          onApplyDag={handleApplyDag}
          onClusterBlocks={handleClusterBlocks}
          onClusterProgress={handleClusterProgress}
          onDeleteBlocks={handleDeleteBlocks}
          onBridgePreviewChange={setAddExpandPreviewCells}
          onCancelCombine={handleCloseCombine}
          plan={plan}
          notesContent={notesContent}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
          onSaveCreatorEffects={
            isOwner ? handleSaveCreatorEffects : undefined
          }
          onSaveAnswersModelSeed={
            isOwner ? handleSaveAnswersModelSeed : undefined
          }
          onOpenUnsysStudio={
            isOwner && !isLearnerMode ? setUnsysStudioBlockId : undefined
          }
          onSplitBlock={isOwner ? handleSplitBlock : undefined}
          cloneArmed={cloneArm.armed}
          onCloneArm={isOwner && !isLearnerMode ? handleCloneArm : undefined}
          onCloneCancel={handleCloneCancel}
          onClonePaste={isOwner ? handleClonePaste : undefined}
          onExpandBlock={isOwner ? handleExpandFromSourceBlock : undefined}
          onGenerateMap={isOwner ? handleGenerateMap : undefined}
          onGenerateMapPreviewChange={setGenerateMapPreviewCells}
          onSetUnusableCells={
            isOwner
              ? async (cells) => {
                  await handleMapGround({
                    op: "set_unusable_cells",
                    unusableCells: cells,
                  });
                }
              : undefined
          }
          onPreviewUnusableCells={isOwner ? setUnusableCells : undefined}
          onApplyHeliosOverlay={isOwner ? handleApplyHeliosOverlay : undefined}
          mapOverlay={mapOverlay}
          onExpandPreviewChange={setAddExpandPreviewCells}
          onGeneratorTargetPreviewChange={setGeneratorTargetPreviewCells}
          onGeneratorPickModeChange={setGeneratorPickActiveSafe}
          onRegisterGeneratorEmptyToggle={registerGeneratorEmptyToggle}
          onDynamicUnlockPreviewChange={setDynamicUnlockPreviewIds}
          onDynamicPickModeChange={setDynamicPickActiveSafe}
          onRegisterDynamicBlockToggle={registerDynamicBlockToggle}
          workspaceFileItems={workspaceFileItems}
          addTargetCell={addTargetCell}
          onSubmitAddBlock={handleSubmitAddBlock}
          onCancelEmptyCreate={handleCloseEmptyCreate}
          generateShapeCells={generateShapeCells}
          onSubmitGenerateShape={handleSubmitGenerateShape}
        />
        )}
      </div>
      )}
      </>
      )}

      {sectionLayout.showBlockMapChrome &&
      visibleSections.includes("workspace") &&
      !shell.playView &&
      !unsysStudioBlock ? (
        <WorkspaceMobileTabBar
          mobileColumn={mobileColumn}
          onChange={setMobileColumn}
        />
      ) : null}
      </div>
    </div>
  );
}
