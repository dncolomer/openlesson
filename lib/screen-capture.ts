// ============================================
// SCREEN CAPTURE UTILITIES
// Handles full screen capture via getDisplayMedia
// and periodic screenshot capture for session recording
// ============================================

export interface ScreenCaptureOptions {
  onScreenshotCaptured?: (blob: Blob, timestamp: number) => Promise<void>;
  intervalMs?: number; // Default 60000 (1 minute)
  onError?: (error: Error) => void;
  onStatusChange?: (isCapturing: boolean) => void;
}

export interface ScreenCaptureInstance {
  start: () => Promise<boolean>;
  stop: () => void;
  captureNow: () => Promise<Blob | null>;
  isCapturing: () => boolean;
  getStream: () => MediaStream | null;
  getStreamOwner: () => ScreenCaptureMediaSource;
}

/** User closed the picker or denied display-media — not an application failure. */
export function isScreenCaptureUserDenied(error: unknown): boolean {
  const err = error instanceof Error ? error : null;
  const name = err?.name || "";
  const message = String(err?.message || error || "").toLowerCase();
  if (name === "NotAllowedError" || name === "AbortError") return true;
  return (
    message.includes("permission denied") ||
    message.includes("notallowederror") ||
    message.includes("not allowed")
  );
}

/** Hidden / inactive document — getDisplayMedia throws InvalidStateError (spec). */
export function isScreenCaptureInvalidState(error: unknown): boolean {
  const err = error instanceof Error ? error : null;
  if (err?.name === "InvalidStateError") return true;
  return String(err?.message || error || "").toLowerCase().includes("invalid state");
}

export function isScreenCaptureStartQuietFailure(error: unknown): boolean {
  return isScreenCaptureUserDenied(error) || isScreenCaptureInvalidState(error);
}

export type ScreenCaptureMediaDevices = {
  getDisplayMedia: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
};

export type ScreenCaptureMediaHost = {
  closed?: boolean;
  document?: { visibilityState?: string };
  navigator?: { mediaDevices?: Partial<ScreenCaptureMediaDevices> | null };
  documentPictureInPicture?: { window?: ScreenCaptureMediaHost | null };
};

export type ScreenCaptureMediaSource = "pip" | "opener" | "none";

/**
 * Clone a display-media stream so the opener can own tracks independently of
 * the Document PiP browsing context that may have called getDisplayMedia.
 */
export function adoptScreenCaptureStreamOnOpener(stream: MediaStream): MediaStream {
  if (typeof stream.clone === "function") {
    return stream.clone();
  }
  const adopted = new MediaStream();
  for (const track of stream.getTracks()) {
    adopted.addTrack(typeof track.clone === "function" ? track.clone() : track);
  }
  return adopted;
}

/**
 * Closing a PiP host must not stop an opener-held stream. PiP-owned streams
 * still end with the host.
 */
export function screenCaptureShouldStopOnHostClose(input: {
  streamOwner: ScreenCaptureMediaSource | string | null | undefined;
  hostClosed: boolean;
  host?: "pip" | "opener";
}): boolean {
  if (!input.hostClosed) return false;
  const host = input.host ?? "pip";
  if (input.streamOwner === "opener") return false;
  return host === "pip" || host === "opener";
}

function hostHasGetDisplayMedia(
  host: ScreenCaptureMediaHost | null | undefined,
): host is ScreenCaptureMediaHost & { navigator: { mediaDevices: ScreenCaptureMediaDevices } } {
  return typeof host?.navigator?.mediaDevices?.getDisplayMedia === "function";
}

function hostIsUsableForDisplayMedia(host: ScreenCaptureMediaHost | null | undefined): boolean {
  if (!host || host.closed === true) return false;
  if (!hostHasGetDisplayMedia(host)) return false;
  return host.document?.visibilityState !== "hidden";
}

/**
 * getDisplayMedia must run on a visible, fully-active document.
 * Mini-mode Document PiP is visible while the ILE tab is hidden — use the PiP window.
 */
export function resolveScreenCaptureMediaDevices(
  opener: ScreenCaptureMediaHost | null | undefined = typeof window === "undefined" ? null : window,
): { mediaDevices: ScreenCaptureMediaDevices | null; source: ScreenCaptureMediaSource } {
  const pip = opener?.documentPictureInPicture?.window ?? null;
  if (hostIsUsableForDisplayMedia(pip)) {
    return { mediaDevices: pip!.navigator!.mediaDevices as ScreenCaptureMediaDevices, source: "pip" };
  }
  if (hostIsUsableForDisplayMedia(opener)) {
    return { mediaDevices: opener!.navigator!.mediaDevices as ScreenCaptureMediaDevices, source: "opener" };
  }
  if (hostHasGetDisplayMedia(opener)) {
    return { mediaDevices: opener.navigator.mediaDevices, source: "opener" };
  }
  return { mediaDevices: null, source: "none" };
}

// Create a screen capture instance
export function createScreenCapture(options: ScreenCaptureOptions = {}): ScreenCaptureInstance {
  const {
    onScreenshotCaptured,
    intervalMs = 60000, // 1 minute default
    onError,
    onStatusChange,
  } = options;

  let stream: MediaStream | null = null;
  let streamOwner: ScreenCaptureMediaSource = "none";
  let videoElement: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isActive = false;

  // Initialize video element and canvas for capturing frames
  const initializeCapture = () => {
    videoElement = document.createElement("video");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;

    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d");
  };

  // Capture a single frame from the video stream
  const captureFrame = async (): Promise<Blob | null> => {
    if (!videoElement || !canvas || !ctx || !stream) {
      return null;
    }

    // Make sure video is playing
    if (videoElement.readyState < 2) {
      return null;
    }

    // Set canvas size to video dimensions
    const { videoWidth, videoHeight } = videoElement;
    if (videoWidth === 0 || videoHeight === 0) {
      return null;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Draw current frame to canvas
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    // Convert to blob
    return new Promise((resolve) => {
      canvas!.toBlob(
        (blob) => resolve(blob),
        "image/png",
        0.9
      );
    });
  };

  // Take screenshot and notify callback
  const takeScreenshot = async () => {
    try {
      const blob = await captureFrame();
      if (blob && onScreenshotCaptured) {
        const timestamp = Date.now();
        await onScreenshotCaptured(blob, timestamp);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Start screen capture
  const start = async (): Promise<boolean> => {
    console.log("[ScreenCapture] start() called, isActive:", isActive);
    
    if (isActive) {
      console.log("[ScreenCapture] Already active, returning true");
      return true;
    }

    try {
      const resolved = resolveScreenCaptureMediaDevices();
      if (!resolved.mediaDevices) {
        return false;
      }
      console.log("[ScreenCapture] Requesting getDisplayMedia...", resolved.source);
      // Request screen capture permission from a visible document (PiP when the ILE tab is hidden).
      const pipStream = await resolved.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor", // Prefer full screen
          frameRate: 1, // Low framerate since we only need screenshots
        },
        audio: false,
      });
      // Own tracks on the opener so closing Document PiP does not end capture.
      stream =
        resolved.source === "pip"
          ? adoptScreenCaptureStreamOnOpener(pipStream)
          : pipStream;
      streamOwner = "opener";
      console.log("[ScreenCapture] Got stream:", stream, "owner:", streamOwner);

      // Handle stream ending (user clicked "Stop sharing")
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stop();
      });

      // Initialize capture elements
      initializeCapture();

      // Connect stream to video element
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
      }

      isActive = true;
      console.log("[ScreenCapture] Capture started successfully, calling onStatusChange(true)");
      onStatusChange?.(true);

      // Start interval for periodic screenshots
      if (onScreenshotCaptured) {
        console.log("[ScreenCapture] Setting up screenshot interval");
        // Take first screenshot after a short delay to ensure video is ready
        setTimeout(takeScreenshot, 1000);

        // Then take screenshots at regular intervals
        intervalId = setInterval(takeScreenshot, intervalMs);
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isScreenCaptureStartQuietFailure(err)) {
        return false;
      }
      console.error("[ScreenCapture] Error starting capture:", err.name, err.message);
      onError?.(err);
      return false;
    }
  };

  // Stop screen capture
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    if (videoElement) {
      videoElement.srcObject = null;
      videoElement = null;
    }

    canvas = null;
    ctx = null;

    if (isActive) {
      isActive = false;
      onStatusChange?.(false);
    }
  };

  // Capture screenshot immediately (manual trigger)
  const captureNow = async (): Promise<Blob | null> => {
    if (!isActive) {
      return null;
    }
    return captureFrame();
  };

  return {
    start,
    stop,
    captureNow,
    isCapturing: () => isActive,
    getStream: () => stream,
    getStreamOwner: () => streamOwner,
  };
}

// Check if screen capture is supported
export function isScreenCaptureSupported(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    "getDisplayMedia" in navigator.mediaDevices
  );
}
