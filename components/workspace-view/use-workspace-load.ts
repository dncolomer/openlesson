"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createClient } from "@/lib/supabase/client";
import {
  mapWorkspaceNodes,
  type Block,
  type HeliosMapOverlay,
  type InjectHeliosOverlay,
  type Workspace,
} from "@/components/workspace-view/types";
import {
  aestheticImageForId,
  fetchAestheticPackages,
  selectSurfaceAestheticImages,
} from "@/lib/aesthetics";
import {
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import {
  parseBlockLocalContext,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
import {
  normalizeWorkspaceDags,
  type WorkspaceDagRecord,
} from "@/lib/workspace-dags";
import {
  normalizeWorkspaceMapTypes,
  type WorkspaceMapTypesState,
} from "@/lib/workspace-map-types";
import {
  formatAyclPriceCentsLabel,
  resolveAyclCapabilities,
  type AyclCapabilities,
} from "@/lib/aycl-shared";
import { loadCreatorMapNotes } from "@/lib/learner-map-notes";
import { loadAnnotationLayers } from "@/lib/map-annotation-layers";

export function useWorkspaceLoad(input: {
  initialPlan?: Workspace;
  initialNodes?: Block[];
  ayclToken?: string;
  ayclOwnerUserId?: string;
  ayclAccessTier?: string | null;
  workspaceId: string;
  isAycl: boolean;
  router: AppRouterInstance;
  setAyclUpgradePriceLabel: (label: string) => void;
}) {
  const {
    initialPlan,
    initialNodes,
    ayclToken,
    ayclOwnerUserId,
    ayclAccessTier,
    workspaceId,
    isAycl,
    router,
    setAyclUpgradePriceLabel,
  } = input;

  const [plan, setPlan] = useState<Workspace | null>(initialPlan || null);
  const [nodes, setNodes] = useState<Block[]>(() =>
    ayclToken
      ? mapWorkspaceNodes(initialNodes || [], { ayclClone: true })
      : initialNodes || [],
  );
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => ayclOwnerUserId || null,
  );
  /** Org admin for this workspace's organization (or platform admin). */
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [workspaceImage, setWorkspaceImage] = useState("");
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>([]);
  const [mapOverlay, setMapOverlay] = useState<HeliosMapOverlay>({
    notes: [],
    annotationLayers: [],
  });
  const [injectHeliosOverlay, setInjectHeliosOverlay] =
    useState<InjectHeliosOverlay | null>(null);
  const [workspaceDags, setWorkspaceDags] = useState<WorkspaceDagRecord[]>(() =>
    normalizeWorkspaceDags(initialPlan?.workspace_dags),
  );
  const [workspaceMapTypes, setWorkspaceMapTypes] = useState<WorkspaceMapTypesState>(() =>
    normalizeWorkspaceMapTypes(initialPlan?.workspace_map_types),
  );
  const [workspaceFileItems, setWorkspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  /** AYCL purchase tier capabilities (null = non-AYCL). Seeded from prop. */
  const [ayclCapabilities, setAyclCapabilities] = useState<AyclCapabilities | null>(
    () =>
      ayclToken
        ? resolveAyclCapabilities(ayclAccessTier ?? "full")
        : null,
  );

  const handleMapOverlayChange = useCallback((overlay: HeliosMapOverlay) => {
    setMapOverlay(overlay);
  }, []);
  const handleApplyHeliosOverlay = useCallback((overlay: HeliosMapOverlay) => {
    setMapOverlay(overlay);
    setInjectHeliosOverlay((prev) => ({
      token: (prev?.token || 0) + 1,
      notes: overlay.notes,
      annotationLayers: overlay.annotationLayers,
    }));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setMapOverlay({
      notes: loadCreatorMapNotes({ workspaceId, mapKind: "workspace" }),
      annotationLayers: loadAnnotationLayers({
        workspaceId,
        mapKind: "workspace",
      }),
    });
  }, [workspaceId]);

  const supabase = createClient();

  const refreshAyclWorkspace = useCallback(async () => {
    if (!ayclToken) return;
    const res = await fetch(
      `/api/aycl/workspace?token=${encodeURIComponent(ayclToken)}`,
    );
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.workspace) {
      setPlan((prev) => ({ ...(prev || {}), ...data.workspace }));
      setUnusableCells(
        normalizeUnusableCells(
          (data.workspace as { unusable_cells?: unknown }).unusable_cells,
        ),
      );
      setWorkspaceDags(
        normalizeWorkspaceDags(
          (data.workspace as { workspace_dags?: unknown }).workspace_dags,
        ),
      );
      setWorkspaceMapTypes(
        normalizeWorkspaceMapTypes(
          (data.workspace as { workspace_map_types?: unknown }).workspace_map_types,
        ),
      );
    }
    if (Array.isArray(data.blocks)) {
      setNodes(mapWorkspaceNodes(data.blocks, { ayclClone: true }));
    }
    if (data.capabilities) {
      setAyclCapabilities(
        resolveAyclCapabilities(
          (data.capabilities as AyclCapabilities).tier ?? data.accessTier,
        ),
      );
    } else if (data.accessTier) {
      setAyclCapabilities(resolveAyclCapabilities(data.accessTier));
    }
    if (typeof data.upgradePriceLabel === "string" && data.upgradePriceLabel) {
      setAyclUpgradePriceLabel(data.upgradePriceLabel);
    } else if (
      typeof data.upgradePriceCents === "number" &&
      Number.isFinite(data.upgradePriceCents)
    ) {
      setAyclUpgradePriceLabel(formatAyclPriceCentsLabel(data.upgradePriceCents));
    }
  }, [ayclToken, setAyclUpgradePriceLabel]);

  const refreshNodes = useCallback(() => {
    /* Full-plan load is mount / workspace-id only. */
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        const images = packages.flatMap((pkg) => pkg.images).filter(Boolean);
        const selection = selectSurfaceAestheticImages({
          provided: images,
          fromPackages: images,
        });
        setWorkspaceImage(aestheticImageForId(workspaceId, selection.images));
      })
      .catch(() => {
        if (cancelled) return;
        const selection = selectSurfaceAestheticImages({
          provided: [],
          fromPackages: [],
        });
        setWorkspaceImage(aestheticImageForId(workspaceId, selection.images));
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    async function loadPlan() {
      // Purchased AYCL clone: token API, full owner UI, no login redirect.
      if (isAycl && ayclToken) {
        setCurrentUserId(ayclOwnerUserId || null);
        setIsOrgAdmin(false);
        if (initialPlan) {
          setPlan(initialPlan);
          setUnusableCells(normalizeUnusableCells(initialPlan.unusable_cells));
          setWorkspaceDags(normalizeWorkspaceDags(initialPlan.workspace_dags));
          setWorkspaceMapTypes(
            normalizeWorkspaceMapTypes(initialPlan.workspace_map_types),
          );
        }
        if (initialNodes) {
          setNodes(mapWorkspaceNodes(initialNodes, { ayclClone: true }));
        }
        await refreshAyclWorkspace();
        setLoading(false);
        return;
      }

      let user: { id: string } | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch (error) {
        console.warn("Supabase auth session check failed:", error);
      }
      setCurrentUserId(user?.id || null);

      const { data: planData, error: planError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (planError || !planData) {
        setError("Plan not found");
        setLoading(false);
        return;
      }

      if (!planData.is_public) {
        if (!user) {
          router.push("/login?redirect=/workspace/" + workspaceId);
          return;
        }
        if (planData.user_id !== user.id) {
          setError("Plan not found");
          setLoading(false);
          return;
        }
      }

      // Org admin of the workspace's organization (or platform admin) may open Knowledge/Settings.
      let orgAdminForWorkspace = false;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_org_admin, is_admin, organization_id")
          .eq("id", user.id)
          .maybeSingle();
        const workspaceOrgId =
          typeof planData.organization_id === "string" ? planData.organization_id : null;
        const profileOrgId = profile?.organization_id ?? null;
        orgAdminForWorkspace = Boolean(
          profile?.is_admin === true ||
            (profile?.is_org_admin === true &&
              profileOrgId &&
              workspaceOrgId &&
              profileOrgId === workspaceOrgId),
        );
      }
      setIsOrgAdmin(orgAdminForWorkspace);

      setPlan(planData);
      setUnusableCells(
        normalizeUnusableCells(
          (planData as { unusable_cells?: unknown }).unusable_cells,
        ),
      );
      setWorkspaceDags(
        normalizeWorkspaceDags(
          (planData as { workspace_dags?: unknown }).workspace_dags,
        ),
      );
      setWorkspaceMapTypes(
        normalizeWorkspaceMapTypes(
          (planData as { workspace_map_types?: unknown }).workspace_map_types,
        ),
      );

      const { data: nodesData, error: nodesError } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        let finalNodes: Block[] = (nodesData || []).map(
          (n: Block & { local_context?: unknown }) => ({
            ...n,
            local_context: parseBlockLocalContext(n.local_context),
          }),
        );

        const sessionIds = finalNodes
          .map((n: Block) => n.session_id)
          .filter(Boolean) as string[];

        if (sessionIds.length > 0) {
          const { data: sessions } = await supabase
            .from("sessions")
            .select("id, status")
            .in("id", sessionIds);

          if (sessions) {
            const completedSessionIds = new Set(
              sessions
                .filter((s: { id: string; status: string }) => s.status === "completed" || s.status === "ended_by_tutor")
                .map((s: { id: string }) => s.id)
            );

            finalNodes = finalNodes.map((n: Block) => {
              if (n.session_id && completedSessionIds.has(n.session_id) && n.status !== "completed") {
                return { ...n, status: "completed" };
              }
              return n;
            });
          }
        }

        setNodes(finalNodes);
      }

      // File names for prompt-impact + block local refs (excerpts loaded when available).
      const { data: fileRows } = await supabase
        .from("workspace_files")
        .select("file_name, mime_type")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(24);
      setWorkspaceFileItems(
        (fileRows || [])
          .map((f: { file_name?: string; mime_type?: string | null }) => ({
            name: String(f.file_name || "").trim(),
            mime_type: f.mime_type ?? null,
          }))
          .filter((f: WorkspaceFileContextItem) => f.name),
      );

      setLoading(false);
    }

    loadPlan();
  }, [workspaceId, supabase, router, isAycl, ayclToken, ayclOwnerUserId, initialPlan, initialNodes, refreshAyclWorkspace]);

  return {
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
    setWorkspaceMapTypes,
    workspaceFileItems,
    ayclCapabilities,
    workspaceImage,
    mapOverlay,
    injectHeliosOverlay,
    handleMapOverlayChange,
    handleApplyHeliosOverlay,
    refreshAyclWorkspace,
    refreshNodes,
  };
}
