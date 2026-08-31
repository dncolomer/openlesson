"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FacialDataPoint } from "@/components/FaceTracker";
import type { TransferHealth } from "@/components/LogsTool";
import type { LogEntry } from "@/components/LogsTool";
import {
  EEG_DISPLAY_MAX_SAMPLES,
  EEG_PERSIST_MAX_SAMPLES,
  EEG_SAMPLE_RATE_HZ,
  capSessionLogs,
  computeBandPowers,
  createEmptyTransferHealth,
} from "@/components/session/sessionViewHelpers";
import type { IlePowCounterArtifact } from "@/lib/ile-pow-counters";
import { appendIlePowCounterArtifact } from "@/lib/ile-pow-counters";
import type { IleProofOfWorkUploadItem } from "@/lib/ile-evidence-buffer";
import {
  uploadIleEvidenceItem,
  uploadIleScreenshot,
} from "@/lib/ile-proof-of-work-client";
import {
  buildIleCanvasUploadItem,
  buildIleEegUploadItem,
  buildIleFacialUploadItem,
  buildIleNotebookUploadItem,
  buildIleToolEventUploadItem,
  hashIlePowContent,
  ILE_POW_DEBOUNCE_MS,
  meetsCanvasUploadThreshold,
  meetsEegUploadThreshold,
  meetsFacialUploadThreshold,
  meetsNotebookUploadThreshold,
  totalIleEegSamples,
} from "@/lib/ile-realtime-pow";
import type { LocalContextBuffer } from "@/lib/local-context";
import type { DeviceStatus } from "@/lib/muse-athena";
import { createScreenCapture } from "@/lib/screen-capture";
import type { IlePowInterruptionHandler } from "@/components/session-view/use-session-idle";
import type { Session, ToolAction, ToolName } from "@/lib/storage";
import { isIleSpeechCaptureEnabled } from "@/lib/useSessionThoughtInterface";

export type SessionRuntimeInput = {
  sessionRef: { current: Session | null };
  sessionId: string | undefined;
  sessionBlockId: string | undefined;
  ileToken?: string;
  entryQueryParams?: Record<string, string | string[]>;
  localInferenceEnabledRef: { current: boolean };
  localContextRef: { current: LocalContextBuffer | null };
  whiteboardData: string | null;
  notebookContent: string;
  activeChapterKey: string;
  isRecording: boolean;
  isPaused: boolean;
  showWelcomePanel: boolean;
  handlePowInterruptionRef: {
    current: IlePowInterruptionHandler;
  };
};

export function useSessionRuntime(input: SessionRuntimeInput) {
  const {
    sessionRef,
    sessionId,
    sessionBlockId,
    ileToken,
    entryQueryParams,
    localInferenceEnabledRef,
    localContextRef,
    whiteboardData,
    notebookContent,
    activeChapterKey,
    isRecording,
    isPaused,
    showWelcomePanel,
    handlePowInterruptionRef,
  } = input;


// Muse EEG
const [museStatus, setMuseStatus] = useState<"disconnected" | "connecting" | "connected" | "streaming">("disconnected");
const [museError, setMuseError] = useState<string | null>(null);
const [museDeviceStatus, setMuseDeviceStatus] = useState<DeviceStatus | null>(null);
const [eegChannelData, setEegChannelData] = useState<Map<string, number[]>>(new Map());
const [bandPowers, setBandPowers] = useState<{ delta: number; theta: number; alpha: number; beta: number; gamma: number } | null>(null);
 
const museClientRef = useRef<any>(null);
const eegIntervalRef = useRef<NodeJS.Timeout | null>(null);
const bandIntervalRef = useRef<NodeJS.Timeout | null>(null);
const eegBufferRef = useRef<Map<string, number[]>>(new Map());
const eegPendingBufferRef = useRef<Map<string, number[]>>(new Map());
const eegPendingStartMsRef = useRef<number | null>(null);
const eegLastSampleMsRef = useRef<number | null>(null);
const museDeviceStatusRef = useRef<DeviceStatus | null>(null);

// Webcam
const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
const [webcamError, setWebcamError] = useState<string | null>(null);
const [latestFacialData, setLatestFacialData] = useState<FacialDataPoint | null>(null);

// Facial Data Tracking
const [facialDataBuffer, setFacialDataBuffer] = useState<FacialDataPoint[]>([]);
const facialBufferRef = useRef<FacialDataPoint[]>([]);

// Logs
const [logs, setLogs] = useState<LogEntry[]>([]);
const logsRef = useRef<LogEntry[]>([]);
const powSessionEnabledRef = useRef(false);
const lastUploadedCanvasHashRef = useRef<string | null>(null);
const lastUploadedNotebookHashRef = useRef<string | null>(null);
const canvasPowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const notebookPowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const bandPowersRef = useRef(bandPowers);
const [transferHealth, setTransferHealth] = useState<TransferHealth>(createEmptyTransferHealth);
const transferHealthRef = useRef<TransferHealth>(createEmptyTransferHealth());
const [sessionPowArtifacts, setSessionPowArtifacts] = useState<IlePowCounterArtifact[]>([]);
const sessionPowArtifactsRef = useRef<IlePowCounterArtifact[]>([]);
const recordSessionPowArtifact = useCallback((artifact: IlePowCounterArtifact) => {
  sessionPowArtifactsRef.current = appendIlePowCounterArtifact(
    sessionPowArtifactsRef.current,
    artifact,
  );
  setSessionPowArtifacts(sessionPowArtifactsRef.current);
}, []);
const whiteboardDataRef = useRef(whiteboardData);
const notebookContentRef = useRef(notebookContent);
const museStatusRef = useRef(museStatus);
const isWebcamEnabledRef = useRef(isWebcamEnabled);

// Screen capture
const screenCaptureRef = useRef<{ captureNow: () => Promise<Blob | null>; start: () => Promise<boolean>; stop: () => void; isCapturing: () => boolean; getStream: () => MediaStream | null } | null>(null);
const [isScreenCapturing, setIsScreenCapturing] = useState(false);
const [screenshotCount, setScreenshotCount] = useState(0);

const tryUploadFacialBatchRef = useRef<(force?: boolean) => void>(() => {});

useEffect(() => { whiteboardDataRef.current = whiteboardData; }, [whiteboardData]);
useEffect(() => { notebookContentRef.current = notebookContent; }, [notebookContent]);
useEffect(() => { bandPowersRef.current = bandPowers; }, [bandPowers]);
useEffect(() => { museStatusRef.current = museStatus; }, [museStatus]);
useEffect(() => { museDeviceStatusRef.current = museDeviceStatus; }, [museDeviceStatus]);
useEffect(() => { isWebcamEnabledRef.current = isWebcamEnabled; }, [isWebcamEnabled]);

const handleFacialData = useCallback((data: FacialDataPoint) => {
  setLatestFacialData(data);
  facialBufferRef.current.push(data);
  if (facialBufferRef.current.length > 120) {
    facialBufferRef.current = facialBufferRef.current.slice(-120);
  }
  if (meetsFacialUploadThreshold(facialBufferRef.current.length)) {
    tryUploadFacialBatchRef.current();
  }
  // Feed into local context buffer if local inference is active
  if (localInferenceEnabledRef.current && localContextRef.current) {
    localContextRef.current.addFacialData({
      confusionScore: data.confusionScore ?? 0,
      frustrationScore: data.frustrationScore ?? 0,
      emotion: data.emotion === "confused" ? 0.8 : data.emotion === "frustrated" ? 0.7 : 0.2,
      attention: data.attentionLevel === "high" ? 0.9 : data.attentionLevel === "medium" ? 0.5 : 0.2,
    });
  }
}, []);

const handleFaceError = useCallback((error: string) => {
  setWebcamError(error);
  const entry: LogEntry = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    level: "error",
    message: error,
    source: "Face Tracker"
  };
  logsRef.current = capSessionLogs([...logsRef.current, entry]);
  setLogs(logsRef.current);
}, []);
const handleConnectMuse = async () => {
  handleDisconnectMuse();
  setMuseStatus("connecting");
  setMuseError(null);
  try {
    const { MuseAthenaClient } = await import("@/lib/muse-athena");
    const muse = new MuseAthenaClient();

    muse.onStatusChange((status: "disconnected" | "connecting" | "connected" | "streaming") => {
      setMuseStatus(status);
    });

    muse.onDeviceStatus((status: DeviceStatus) => {
      setMuseDeviceStatus(status);
    });

    muse.onDisconnected(() => {
      if (eegIntervalRef.current) { clearInterval(eegIntervalRef.current); eegIntervalRef.current = null; }
      if (bandIntervalRef.current) { clearInterval(bandIntervalRef.current); bandIntervalRef.current = null; }
      museClientRef.current = null;
      setMuseStatus("disconnected");
      setMuseError("Muse disconnected. Reconnect it from the Muse tab.");
    });

    muse.onEEG((sample: { channels: Record<string, number[]> }) => {
      const now = Date.now();
      if (eegPendingStartMsRef.current === null) eegPendingStartMsRef.current = now;
      eegLastSampleMsRef.current = now;

      for (const [channelName, samples] of Object.entries(sample.channels)) {
        const existing = eegBufferRef.current.get(channelName) || [];
        existing.push(...samples);
        if (existing.length > EEG_DISPLAY_MAX_SAMPLES) {
          eegBufferRef.current.set(channelName, existing.slice(-EEG_DISPLAY_MAX_SAMPLES));
        } else {
          eegBufferRef.current.set(channelName, existing);
        }

        const pending = eegPendingBufferRef.current.get(channelName) || [];
        pending.push(...samples);
        if (pending.length > EEG_PERSIST_MAX_SAMPLES) {
          eegPendingBufferRef.current.set(channelName, pending.slice(-EEG_PERSIST_MAX_SAMPLES));
        } else {
          eegPendingBufferRef.current.set(channelName, pending);
        }
      }
    });

    await muse.connect();
    museClientRef.current = muse;
    setMuseStatus("connected");

    await muse.startStreaming();
    setMuseStatus("streaming");

    eegIntervalRef.current = setInterval(() => {
      setEegChannelData(new Map(eegBufferRef.current));
    }, 100);

    bandIntervalRef.current = setInterval(() => {
      const af7 = eegBufferRef.current.get("AF7");
      const af8 = eegBufferRef.current.get("AF8");
      if (!af7 || af7.length < 256 || !af8 || af8.length < 256) return;
      const powers = computeBandPowers(af7.slice(-256), af8.slice(-256));
      setBandPowers(powers);
      if (localInferenceEnabledRef.current && localContextRef.current) {
        localContextRef.current.addEEGData(powers);
      }
    }, 1000);
  } catch (err: unknown) {
    setMuseStatus("disconnected");
    const error = err as Error;
    if (error?.name === "NotFoundError" && error?.message?.includes("cancelled")) return;
    setMuseError(error?.message || "Connection failed.");
  }
};

const handleDisconnectMuse = () => {
  if (museClientRef.current) {
    try { museClientRef.current.disconnect(); } catch {}
    museClientRef.current = null;
  }
  if (eegIntervalRef.current) { clearInterval(eegIntervalRef.current); eegIntervalRef.current = null; }
  if (bandIntervalRef.current) { clearInterval(bandIntervalRef.current); bandIntervalRef.current = null; }
  eegBufferRef.current.clear();
  eegPendingBufferRef.current.clear();
  eegPendingStartMsRef.current = null;
  eegLastSampleMsRef.current = null;
  setEegChannelData(new Map());
  setBandPowers(null);
  setMuseDeviceStatus(null);
  setMuseStatus("disconnected");
};
const addSessionLog = useCallback((entry: Omit<LogEntry, "id">) => {
  const logEntry: LogEntry = { ...entry, id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
  logsRef.current = capSessionLogs([...logsRef.current, logEntry]);
  setLogs(logsRef.current);
}, []);

const recordTransferEvent = useCallback(
  (channel: keyof TransferHealth, saved: boolean, error?: string) => {
    transferHealthRef.current[channel].sent++;
    if (saved) transferHealthRef.current[channel].saved++;
    else transferHealthRef.current[channel].failed++;
    setTransferHealth({ ...transferHealthRef.current });
    if (!saved && error) {
      addSessionLog({
        timestamp: Date.now(),
        level: "warning",
        source: channel,
        message: error,
      });
    }
  },
  [addSessionLog],
);

const getWorkspaceId = useCallback(() => {
  const workspaceId = sessionRef.current?.metadata?.workspace_id;
  return typeof workspaceId === "string" && workspaceId ? workspaceId : undefined;
}, []);

const uploadPowItem = useCallback(
  async (item: IleProofOfWorkUploadItem, channel: keyof TransferHealth) => {
    const workspaceId = getWorkspaceId();
    const currentSession = sessionRef.current;
    if (!workspaceId || !currentSession || !powSessionEnabledRef.current) return;

    const result = await uploadIleEvidenceItem(
      workspaceId,
      currentSession.id,
      item,
      ileToken,
      entryQueryParams,
    );
    recordTransferEvent(channel, result.ok, result.error);
    if (result.ok) {
      recordSessionPowArtifact({
        type: item.kind,
        tool_name: item.toolName,
        tool_action: item.toolAction,
      });
      if (result.interruption) {
        handlePowInterruptionRef.current(result.interruption);
      }
    }
  },
  [getWorkspaceId, recordTransferEvent, recordSessionPowArtifact, ileToken, entryQueryParams],
);

const uploadScreenshotPow = useCallback(
  async (blob: Blob, timestampMs: number) => {
    const workspaceId = getWorkspaceId();
    const currentSession = sessionRef.current;
    if (!workspaceId || !currentSession || !powSessionEnabledRef.current) return;

    const result = await uploadIleScreenshot(
      workspaceId,
      currentSession.id,
      { blob, timestampMs },
      ileToken,
      entryQueryParams,
    );
    recordTransferEvent("screenshots", result.ok, result.error);
    if (result.ok) {
      setScreenshotCount((count) => count + 1);
      recordSessionPowArtifact({ type: "screen" });
      if (result.interruption) {
        handlePowInterruptionRef.current(result.interruption);
      }
    }
  },
  [getWorkspaceId, recordTransferEvent, recordSessionPowArtifact, ileToken, entryQueryParams],
);

const tryUploadFacialBatch = useCallback(
  (force = false) => {
    const currentSession = sessionRef.current;
    if (!currentSession || !powSessionEnabledRef.current) return;
    if (!meetsFacialUploadThreshold(facialBufferRef.current.length, force)) return;

    const data = facialBufferRef.current.splice(0);
    const item = buildIleFacialUploadItem(currentSession.id, data);
    void uploadPowItem(item, "facial");
  },
  [uploadPowItem],
);

const consumePendingEegSamples = useCallback(() => {
  const channels: Record<string, number[]> = {};
  for (const [ch, samples] of eegPendingBufferRef.current.entries()) {
    channels[ch] = samples.slice();
  }
  return channels;
}, []);

const clearConsumedEegSamples = useCallback((channels: Record<string, number[]>) => {
  for (const [ch, savedSamples] of Object.entries(channels)) {
    const current = eegPendingBufferRef.current.get(ch) || [];
    const remaining = current.slice(savedSamples.length);
    if (remaining.length > 0) {
      eegPendingBufferRef.current.set(ch, remaining);
    } else {
      eegPendingBufferRef.current.delete(ch);
    }
  }
  if (eegPendingBufferRef.current.size === 0) {
    eegPendingStartMsRef.current = null;
    eegLastSampleMsRef.current = null;
  }
}, []);

const tryUploadPendingEegChunk = useCallback(
  (force = false) => {
    const currentSession = sessionRef.current;
    if (!currentSession || !powSessionEnabledRef.current) return;
    if (museStatusRef.current !== "streaming" || eegPendingBufferRef.current.size === 0) return;

    const channels = consumePendingEegSamples();
    const sampleCount = totalIleEegSamples(channels);
    if (!meetsEegUploadThreshold(sampleCount, force)) return;

    const item = buildIleEegUploadItem(currentSession.id, {
      channels,
      bandPowers: bandPowersRef.current,
      sampleRateHz: EEG_SAMPLE_RATE_HZ,
      startedAtMs: eegPendingStartMsRef.current ?? Date.now(),
      endedAtMs: eegLastSampleMsRef.current ?? Date.now(),
      sampleCounts: Object.fromEntries(
        Object.entries(channels).map(([ch, samples]) => [ch, samples.length]),
      ),
      deviceStatus: museDeviceStatusRef.current as unknown as Record<string, unknown> | null,
      deviceName: museClientRef.current?.deviceName,
      timestampMs: eegLastSampleMsRef.current ?? Date.now(),
    });
    clearConsumedEegSamples(channels);
    void uploadPowItem(item, "eeg");
  },
  [clearConsumedEegSamples, consumePendingEegSamples, uploadPowItem],
);

const uploadCanvasPowNow = useCallback(
  (force = false) => {
    const currentSession = sessionRef.current;
    const data = whiteboardDataRef.current;
    if (!currentSession || !data || !powSessionEnabledRef.current) return;
    if (!meetsCanvasUploadThreshold(data.length, force)) return;

    const hash = hashIlePowContent(data);
    if (hash === lastUploadedCanvasHashRef.current) return;
    lastUploadedCanvasHashRef.current = hash;

    void uploadPowItem(buildIleCanvasUploadItem(currentSession.id, data), "tools");
  },
  [uploadPowItem],
);

const uploadNotebookPowNow = useCallback(
  (force = false) => {
    const currentSession = sessionRef.current;
    const content = notebookContentRef.current?.trim() || "";
    if (!currentSession || !content || !powSessionEnabledRef.current) return;
    if (!meetsNotebookUploadThreshold(content.length, force)) return;

    const hash = hashIlePowContent(content);
    if (hash === lastUploadedNotebookHashRef.current) return;
    lastUploadedNotebookHashRef.current = hash;

    void uploadPowItem(buildIleNotebookUploadItem(currentSession.id, content), "tools");
  },
  [uploadPowItem],
);

const scheduleCanvasPowUpload = useCallback(() => {
  if (canvasPowDebounceRef.current) {
    clearTimeout(canvasPowDebounceRef.current);
  }
  canvasPowDebounceRef.current = setTimeout(() => {
    canvasPowDebounceRef.current = null;
    uploadCanvasPowNow();
  }, ILE_POW_DEBOUNCE_MS);
}, [uploadCanvasPowNow]);

const scheduleNotebookPowUpload = useCallback(() => {
  if (notebookPowDebounceRef.current) {
    clearTimeout(notebookPowDebounceRef.current);
  }
  notebookPowDebounceRef.current = setTimeout(() => {
    notebookPowDebounceRef.current = null;
    uploadNotebookPowNow();
  }, ILE_POW_DEBOUNCE_MS);
}, [uploadNotebookPowNow]);

const flushRemainingIlePow = useCallback(
  async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (canvasPowDebounceRef.current) {
      clearTimeout(canvasPowDebounceRef.current);
      canvasPowDebounceRef.current = null;
    }
    if (notebookPowDebounceRef.current) {
      clearTimeout(notebookPowDebounceRef.current);
      notebookPowDebounceRef.current = null;
    }
    uploadCanvasPowNow(force);
    uploadNotebookPowNow(force);
    tryUploadFacialBatch(force);
    tryUploadPendingEegChunk(force);
  },
  [tryUploadFacialBatch, tryUploadPendingEegChunk, uploadCanvasPowNow, uploadNotebookPowNow],
);

// Speech + PoW uploads arm only while the learner is actively in-session.
// Returning users who skip the welcome panel must still call startRecording
// on entry — otherwise Helios shows "Speech capture off" with no way to arm.
const powSessionEnabled = isIleSpeechCaptureEnabled({
  isRecording,
  isPaused,
  showWelcomePanel,
});

useEffect(() => {
  powSessionEnabledRef.current = powSessionEnabled;
  if (!powSessionEnabled) {
    void flushRemainingIlePow({ force: true });
  }
}, [powSessionEnabled, flushRemainingIlePow]);

useEffect(() => {
  lastUploadedCanvasHashRef.current = null;
  lastUploadedNotebookHashRef.current = null;
}, [sessionId, activeChapterKey]);

useEffect(() => {
  if (!powSessionEnabled) return;
  scheduleCanvasPowUpload();
}, [powSessionEnabled, whiteboardData, scheduleCanvasPowUpload]);

useEffect(() => {
  if (!powSessionEnabled) return;
  scheduleNotebookPowUpload();
}, [powSessionEnabled, notebookContent, scheduleNotebookPowUpload]);

useEffect(() => {
  if (!powSessionEnabled || museStatus !== "streaming") return;
  const interval = window.setInterval(() => {
    tryUploadPendingEegChunk();
  }, 3_000);
  return () => window.clearInterval(interval);
}, [museStatus, powSessionEnabled, tryUploadPendingEegChunk]);
const ilePowContext = useMemo(
  () => ({
    workspaceId: getWorkspaceId() ?? undefined,
    sessionId: sessionId ?? null,
    // Shareable ILE guests authenticate PoW routes with the private link token.
    privateToken: ileToken || undefined,
    blockId: sessionBlockId,
    entryQueryParams,
  }),
  [getWorkspaceId, sessionId, sessionBlockId, ileToken, entryQueryParams],
);
const logToolRef = useRef<
  ((toolName: ToolName, action: ToolAction, metadata?: Record<string, unknown>) => Promise<void>) | null
>(null);

const logTool = useCallback(
  async (
    toolName: ToolName,
    action: ToolAction,
    metadata: Record<string, unknown> = {},
  ) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const now = Date.now();
    const elapsedMs = currentSession.startedAt
      ? now - new Date(currentSession.startedAt).getTime()
      : 0;

    if (powSessionEnabledRef.current) {
      const item = buildIleToolEventUploadItem(currentSession.id, {
        toolName,
        action,
        timestampMs: now,
        metadata,
      });
      void uploadPowItem(item, "tools");
    }

    const metaKeys = Object.keys(metadata);
    let metaStr = "";
    if (metaKeys.length > 0) {
      try {
        const compact: Record<string, unknown> = {};
        for (const k of metaKeys) {
          const v = metadata[k];
          if (typeof v === "string" && v.length > 60) {
            compact[k] = `${v.slice(0, 60)}… (${v.length}c)`;
          } else if (Array.isArray(v)) {
            compact[k] = `Array(${v.length})`;
          } else {
            compact[k] = v;
          }
        }
        metaStr = ` ${JSON.stringify(compact).slice(0, 160)}`;
      } catch {
        metaStr = ` [${metaKeys.join(", ")}]`;
      }
    }

    addSessionLog({
      timestamp: now,
      level: "info",
      source: "tool",
      message: `${toolName}/${action} @${Math.round(elapsedMs / 1000)}s${metaStr}`,
    });
  },
  [addSessionLog, uploadPowItem],
);

useEffect(() => {
  logToolRef.current = logTool;
}, [logTool]);

useEffect(() => {
  tryUploadFacialBatchRef.current = tryUploadFacialBatch;
}, [tryUploadFacialBatch]);
const handleStartScreenCapture = useCallback(async () => {
  if (!screenCaptureRef.current) {
    screenCaptureRef.current = createScreenCapture({
      onScreenshotCaptured: async (blob: Blob, timestamp: number) => {
        await uploadScreenshotPow(blob, timestamp);
      },
      intervalMs: 5000,
      onStatusChange: (capturing: boolean) => {
        setIsScreenCapturing(capturing);
      },
    });
  }
  return screenCaptureRef.current.start();
}, [uploadScreenshotPow]);

const handleStopScreenCapture = useCallback(() => {
  screenCaptureRef.current?.stop();
}, []);


  return {
    museStatus,
    museError,
    museDeviceStatus,
    eegChannelData,
    bandPowers,
    isWebcamEnabled,
    setIsWebcamEnabled,
    webcamError,
    latestFacialData,
    logs,
    setLogs,
    logsRef,
    transferHealth,
    isScreenCapturing,
    setIsScreenCapturing,
    screenshotCount,
    screenCaptureRef,
    museStatusRef,
    isWebcamEnabledRef,
    whiteboardDataRef,
    notebookContentRef,
    handleFacialData,
    handleFaceError,
    handleConnectMuse,
    handleDisconnectMuse,
    addSessionLog,
    recordTransferEvent,
    getWorkspaceId,
    logTool,
    logToolRef,
    flushRemainingIlePow,
    powSessionEnabled,
    powSessionEnabledRef,
    ilePowContext,
    handleStartScreenCapture,
    handleStopScreenCapture,
    sessionPowArtifacts,
    sessionPowArtifactsRef,
    recordSessionPowArtifact,
  };
}
