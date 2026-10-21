"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { IleWorkCanvasCommandId } from "@/lib/learn-work-canvas-commands";

export type SessionCanvasDictate = {
  transcript: string;
  write: (text: string, commit: boolean) => void;
  onActive?: (active: boolean) => void;
};

export type SessionCanvasCommands = {
  selectionActive: boolean;
  run: (id: IleWorkCanvasCommandId) => void;
  dictate: SessionCanvasDictate | null;
  /** Learn opens the insight form. Other modes leave this empty. */
  craft: { open: () => void } | null;
};

const CommandContext = createContext<SessionCanvasCommands | null>(null);
const PublishCommandContext = createContext<(next: SessionCanvasCommands | null) => void>(() => {});

export function SessionCommandBridgeProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<SessionCanvasCommands | null>(null);
  return (
    <PublishCommandContext.Provider value={setCommands}>
      <CommandContext.Provider value={commands}>{children}</CommandContext.Provider>
    </PublishCommandContext.Provider>
  );
}

export function useSessionCanvasCommands(): SessionCanvasCommands | null {
  return useContext(CommandContext);
}

export function usePublishSessionCanvasCommands(): (next: SessionCanvasCommands | null) => void {
  return useContext(PublishCommandContext);
}
