import type { LiveExcalidrawAPI } from "@/components/excalidraw-canvas/excalidraw-api";

export async function exportWorkCanvasPng(api: LiveExcalidrawAPI | null): Promise<string | null> {
  if (!api) return null;
  try {
    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    if (!elements || elements.length === 0) return null;
    const blob = await exportToBlob({
      elements,
      appState: {
        ...appState,
        exportWithDarkMode: true,
        exportBackground: true,
        viewBackgroundColor: "#0a0a0a",
      },
      files,
      mimeType: "image/png",
    });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("[ExcalidrawCanvas] PNG export failed:", err);
    return null;
  }
}
