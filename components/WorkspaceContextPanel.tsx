"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceNotesFilesPanel } from "@/components/WorkspaceNotesFilesPanel";
import { WorkspaceDantesSearch } from "@/components/WorkspaceDantesSearch";
import { WorkspaceExternalAddLinkForm } from "@/components/WorkspaceExternalAddLinkForm";
import {
  normalizeExternalResourceList,
  type ExternalResourceCreateInput,
  type WorkspaceExternalResource,
} from "@/lib/workspace-external-resources";

/**
 * Context section surface: Dantes search + add-link + unified resource list
 * (external sources above notes/files).
 */
export function WorkspaceContextPanel({
  workspaceId,
  isOwner,
  notesContent,
  setNotesContent,
  isEditingNotes,
  setIsEditingNotes,
  savingNotes,
  onSaveNotes,
  onCancelNotes,
  showFiles = true,
  seedQuery,
  ayclToken,
}: {
  workspaceId: string;
  isOwner: boolean;
  notesContent: string;
  setNotesContent: (v: string) => void;
  isEditingNotes: boolean;
  setIsEditingNotes: (v: boolean) => void;
  savingNotes: boolean;
  onSaveNotes: () => void | Promise<void>;
  onCancelNotes: () => void;
  showFiles?: boolean;
  seedQuery?: string | null;
  ayclToken?: string;
}) {
  const [externalResources, setExternalResources] = useState<
    WorkspaceExternalResource[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExternal = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ workspaceId });
      if (ayclToken) qs.set("ayclToken", ayclToken);
      const res = await fetch(`/api/workspace/external-resources?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load external resources");
        return;
      }
      setExternalResources(normalizeExternalResourceList(data.resources || []));
      setError(null);
    } catch {
      setError("Failed to load external resources");
    }
  }, [workspaceId, ayclToken]);

  useEffect(() => {
    void loadExternal();
  }, [loadExternal]);

  const addResource = async (payload: ExternalResourceCreateInput) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/external-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...payload,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add resource");
      await loadExternal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add resource";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const updateResource = async (
    id: string,
    patch: { title?: string; url?: string; description?: string | null },
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/external-resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          resourceId: id,
          ...patch,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      await loadExternal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const deleteResource = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ workspaceId, resourceId: id });
      if (ayclToken) qs.set("ayclToken", ayclToken);
      const res = await fetch(`/api/workspace/external-resources?${qs}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setExternalResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-workspace-context-panel
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden md:flex-row"
    >
      <div className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto md:w-[20rem] lg:w-[22rem]">
        {error ? (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
        <WorkspaceDantesSearch
          canEdit={isOwner}
          onAdd={addResource}
          busy={busy}
          seedQuery={seedQuery}
        />
        <WorkspaceExternalAddLinkForm
          canEdit={isOwner}
          onAdd={addResource}
          busy={busy}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <WorkspaceNotesFilesPanel
          notesContent={notesContent}
          setNotesContent={setNotesContent}
          isEditingNotes={isEditingNotes}
          setIsEditingNotes={setIsEditingNotes}
          savingNotes={savingNotes}
          onSaveNotes={onSaveNotes}
          onCancelNotes={onCancelNotes}
          isOwner={isOwner}
          workspaceId={workspaceId}
          showFiles={showFiles}
          externalResources={externalResources}
          onUpdateExternal={updateResource}
          onDeleteExternal={deleteResource}
          externalBusy={busy}
        />
      </div>
    </div>
  );
}
