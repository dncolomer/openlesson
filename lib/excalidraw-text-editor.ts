/**
 * Excalidraw's text editor unsubscribes from the scene with an empty Error
 * once the scene has already been destroyed. Committing the editor first
 * lets that unsubscribe run while the scene is still alive.
 */
export function commitOpenExcalidrawTextEditor(
  doc: { querySelector(selector: string): Element | null } | null | undefined = globalThis.document,
): void {
  const editor = doc?.querySelector?.("textarea.excalidraw-wysiwyg");
  if (!editor || typeof (editor as HTMLTextAreaElement).dispatchEvent !== "function") return;
  const field = editor as HTMLTextAreaElement;
  if (typeof KeyboardEvent === "function") {
    field.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  if (field.isConnected && typeof field.blur === "function") field.blur();
}
