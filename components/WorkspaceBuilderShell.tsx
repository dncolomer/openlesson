"use client";

import type { ReactNode } from "react";
import { PublicWorkspaceForkPanel } from "@/components/PublicWorkspaceForkPanel";

interface WorkspaceBuilderShellProps {
  needsFork: boolean;
  isLoggedIn: boolean;
  publicLoginHref: string;
  onFork: () => void;
  children: ReactNode;
}

export function WorkspaceBuilderShell({
  needsFork,
  isLoggedIn,
  publicLoginHref,
  onFork,
  children,
}: WorkspaceBuilderShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800/60 bg-neutral-900/50 shadow-lg shadow-black/10">
      <div className="min-h-0 flex-1 overflow-hidden">
        {needsFork ? (
          <PublicWorkspaceForkPanel
            variant="inline"
            isLoggedIn={isLoggedIn}
            loginHref={publicLoginHref}
            onFork={onFork}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}