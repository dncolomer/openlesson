"use client";

import { WorkspaceNotesFilesPanel } from "@/components/WorkspaceNotesFilesPanel";

/**
 * Context section: map notes on `workspaces.notes`. Files and Dantes
 * resources were removed from the product model.
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
  return (
    <div
      data-workspace-context-panel
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
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
        showFiles={false}
      />
    </div>
  );
}
