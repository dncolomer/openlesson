import {
  boardInstructionNoteElements,
  withIleWorkCanvasGridAppState,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export const PROTOCOL_SETTINGS_PREVIEW_NOTE =
  "Draw on this board. Fill, ink, zen, and grid apply here the same way they do on a prepared protocol board.";

/** Seed once. Style changes restyle chrome; they do not wipe drawings. */
export function protocolSettingsPreviewScene(): IleWorkCanvasScene {
  const note = boardInstructionNoteElements({
    text: PROTOCOL_SETTINGS_PREVIEW_NOTE,
    x: 80,
    y: 64,
    textWidth: 360,
    label: "Protocol Settings",
    textId: "protocol-settings-preview-text",
    elementIds: {
      body: "protocol-settings-preview-body",
      header: "protocol-settings-preview-header",
      text: "protocol-settings-preview-text",
      label: "protocol-settings-preview-label",
      group: "protocol-settings-preview-grp",
    },
  });
  return {
    elements: note.elements,
    appState: withIleWorkCanvasGridAppState(
      {},
      { chrome: { zenModeEnabled: false } },
    ),
    files: {},
  };
}
