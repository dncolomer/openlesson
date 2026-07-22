"use client";

import type { ReactNode } from "react";

interface WorkspaceBuilderShellProps {
  /** @deprecated Public workspaces no longer require fork-to-edit. Kept for call-site compat. */
  needsFork?: boolean;
  isLoggedIn?: boolean;
  publicLoginHref?: string;
  onFork?: () => void;
  children: ReactNode;
}

/**
 * Workspace builder chrome. Public workspaces are browseable without fork gates.
 */
export function WorkspaceBuilderShell({ children }: WorkspaceBuilderShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800/60 bg-neutral-900/50 shadow-lg shadow-black/10">
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
