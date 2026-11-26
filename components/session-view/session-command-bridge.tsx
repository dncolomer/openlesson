"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { IleWorkCanvasCommandId } from "@/lib/learn-work-canvas-commands";

export type SessionCanvasDictate = {
  transcript: string;
  getLiveTranscript?: () => string;
  write: (text: string, commit: boolean) => void;
  /** Stop recording and run Do/run on the dictate note. */
  run: (text: string) => void;
  onActive?: (active: boolean) => void;
};

export type SessionCanvasCommands = {
  selectionActive: boolean;
  run: (id: IleWorkCanvasCommandId) => void;
  dictate: SessionCanvasDictate | null;
  /** Laser pointer mode. Click on, click again off. */
  pointer: { active: boolean; toggle: () => void } | null;
  /** Craft insight is unmounted. Always empty. */
  craft: { open: () => void } | null;
  autoLayout: { enabled: boolean; toggle: () => void } | null;
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
