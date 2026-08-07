"use client";

import { useState, useRef, useEffect } from "react";
import { MuseTemporalChart } from "./MuseTemporalChart";
import { FaceTracker, FacialDataPoint } from "./FaceTracker";
import { useI18n } from "../lib/i18n";
import type { DeviceStatus } from "../lib/muse-athena";

interface DataInputToolProps {
  isRecording: boolean;
  sessionId?: string;
  audioStream?: MediaStream | null;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museError?: string | null;
  museDeviceStatus?: DeviceStatus | null;
  museChannelData: Map<string, number[]>;
  bandPowers?: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
  onConnectMuse: () => void;
  onDisconnectMuse: () => void;
  isWebcamEnabled?: boolean;
  onWebcamToggle?: () => void;
  latestFacialData?: FacialDataPoint | null;
  onFacialData?: (data: FacialDataPoint) => void;
  onFaceError?: (error: string) => void;
  isScreenCapturing?: boolean;
  onStartScreenCapture?: () => void;
  onStopScreenCapture?: () => void;
  screenshotCount?: number;
}

type Tab = "audio" | "muse" | "face" | "screen";

export function DataInputTool({
  isRecording,
  sessionId,
  audioStream,
  museStatus,
  museError,
  museDeviceStatus,
  museChannelData,
  bandPowers,
  onConnectMuse,
  onDisconnectMuse,
  isWebcamEnabled = false,
  onWebcamToggle,
  latestFacialData = null,
  onFacialData,
  onFaceError,
  isScreenCapturing = false,
  onStartScreenCapture,
  onStopScreenCapture,
  screenshotCount = 0,
}: DataInputToolProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("audio");
  const [blinkRate, setBlinkRate] = useState(0);
  const blinkCountRef = useRef<number>(0);
  const lastBlinkResetRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isWebcamEnabled) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsedMinutes = (now - lastBlinkResetRef.current) / 60000;
        if (elapsedMinutes >= 1) {
          setBlinkRate(blinkCountRef.current);
          blinkCountRef.current = 0;
          lastBlinkResetRef.current = now;
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWebcamEnabled]);

  const prevEyeStateRef = useRef<"open" | "closed">("open");
  
  const handleFacialData = (data: FacialDataPoint) => {
    if (latestFacialData && data.facePresent) {
      const prevEye = prevEyeStateRef.current;
      if (prevEye === "closed" && latestFacialData.facePresent) {
        blinkCountRef.current++;
      }
    }
    prevEyeStateRef.current = data.facePresent ? "open" : "open";
    
    if (onFacialData) {
      onFacialData(data);
    }
  };

  const isMuseConnected = museStatus === "connected" || museStatus === "streaming";

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      <div className="flex border-b border-neutral-800">
        {(["audio", "muse", "face", "screen"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-neutral-300 border-b-2 border-white/60 bg-neutral-800/10"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t(`dataInput.tab_${tab}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {activeTab === "audio" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">{t('dataInput.audioDetection')}</span>
              <div className={`flex items-center gap-2 ${isRecording ? "text-green-400" : "text-neutral-500"}`}>
                <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-green-400 animate-pulse" : "bg-neutral-600"}`} />
                <span className="text-xs">{isRecording ? t('dataInput.audioDetected') : t('dataInput.noAudio')}</span>
              </div>
            </div>
            {audioStream && isRecording && (
              <div className="h-24 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800">
                <AudioLevelMeter stream={audioStream} />
              </div>
            )}
            {!audioStream && (
              <div className="h-24 flex items-center justify-center rounded-lg bg-neutral-950 border border-neutral-800">
                <p className="text-neutral-500 text-xs">{t('dataInput.startRecordingMessage')}</p>
              </div>
            )}
            <div className="text-xs text-neutral-500">
              {isRecording ? t('dataInput.micActive') : t('dataInput.micInactive')}
            </div>
          </div>
        )}

        {activeTab === "muse" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">{t('dataInput.museHeadset')}</span>
              <button
                onClick={isMuseConnected ? onDisconnectMuse : onConnectMuse}
                disabled={museStatus === "connecting"}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  isMuseConnected
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-neutral-800/20 text-neutral-300 border border-neutral-600/30 hover:bg-neutral-800/30"
                }`}
              >
                {museStatus === "connecting" ? t('common.connecting') : isMuseConnected ? t('common.disconnect') : t('common.connect')}
              </button>
            </div>

            {museError && (
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400">{museError}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{t('dataInput.status')}:</span>
                <span className={`${
                  museStatus === "streaming" ? "text-green-400" :
                  museStatus === "connected" ? "text-neutral-300" :
                  museStatus === "connecting" ? "text-neutral-300" :
                  "text-neutral-500"
                }`}>
                  {museStatus.charAt(0).toUpperCase() + museStatus.slice(1)}
                </span>
              </div>
              
              {bandPowers && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{t('dataInput.signal')}:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400">{t('dataInput.receivingData')}</span>
                  </div>
                </div>
              )}

              {museDeviceStatus && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-neutral-800/40 p-2">
                    <span className="text-neutral-500">Battery: </span>
                    <span className="text-neutral-300">{museDeviceStatus.battery || 0}%</span>
                  </div>
                  <div className="rounded bg-neutral-800/40 p-2">
                    <span className="text-neutral-500">Quality: </span>
                    <span className={
                      museDeviceStatus.signalQuality === "good" ? "text-green-400" :
                      museDeviceStatus.signalQuality === "fair" ? "text-neutral-300" :
                      "text-red-400"
                    }>{museDeviceStatus.signalQuality}</span>
                  </div>
                </div>
              )}
              
              {!bandPowers && isMuseConnected && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{t('dataInput.signal')}:</span>
                  <span className="text-neutral-300">{t('dataInput.waitingForSignal')}</span>
                </div>
              )}
            </div>

            {bandPowers && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">{t('dataInput.bandPowers')}</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "δ", value: bandPowers.delta, color: "bg-red-500" },
                    { label: "θ", value: bandPowers.theta, color: "bg-orange-500" },
                    { label: "α", value: bandPowers.alpha, color: "bg-white" },
                    { label: "β", value: bandPowers.beta, color: "bg-green-500" },
                    { label: "γ", value: bandPowers.gamma, color: "bg-white" },
                  ].map((band) => {
                    const maxVal = Math.max(bandPowers.delta, bandPowers.theta, bandPowers.alpha, bandPowers.beta, bandPowers.gamma) || 1;
                    const height = Math.max(4, (band.value / maxVal) * 40);
                    return (
                      <div key={band.label} className="flex flex-col items-center">
                        <div className="w-full h-10 bg-neutral-800 rounded-md relative overflow-hidden">
                          <div 
                            className={`absolute bottom-0 w-full ${band.color} transition-all duration-300`}
                            style={{ height: `${height}px` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-1">{band.label}</span>
                        <span className="text-[9px] text-neutral-500">{band.value.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-neutral-500 mb-2">{t('dataInput.eegChannels')}</p>
              <MuseTemporalChart
                channelData={museChannelData}
                isConnected={isMuseConnected}
              />
            </div>

            <p className="text-xs text-neutral-600">
              {t('dataInput.dataCaptureInterval')}
            </p>
          </div>
        )}

        {activeTab === "face" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">{t('dataInput.facialDataTracking')}</span>
              <button
                onClick={() => onWebcamToggle?.()}
                disabled={!onWebcamToggle}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  isWebcamEnabled
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-neutral-800/20 text-neutral-300 border border-neutral-600/30 hover:bg-neutral-800/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isWebcamEnabled ? t('dataInput.disableWebcam') : t('dataInput.enableWebcam')}
              </button>
            </div>

            {isWebcamEnabled && (
              <>
                <FaceTracker
                  isEnabled={isWebcamEnabled}
                  onDataPoint={handleFacialData}
                  onError={onFaceError}
                />

                {latestFacialData && (
                  <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.engagement')}: </span>
                      <span className={latestFacialData.engagementScore >= 70 ? "text-green-400" : latestFacialData.engagementScore >= 40 ? "text-neutral-300" : "text-red-400"}>
                        {Math.round(latestFacialData.engagementScore)}%
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.confusion')}: </span>
                      <span className="text-orange-400">{Math.round(latestFacialData.confusionScore)}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.processing')}: </span>
                      <span className="text-neutral-300">{Math.round(latestFacialData.processingScore)}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.frustration')}: </span>
                      <span className="text-red-400">{Math.round(latestFacialData.frustrationScore)}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.smile')}: </span>
                      <span className="text-neutral-300">{Math.round(latestFacialData.smileScore)}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.emotion')}: </span>
                      <span className="text-neutral-300">{latestFacialData.emotion.toUpperCase()}</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.attention')}: </span>
                      <span className={latestFacialData.attentionLevel === "high" ? "text-green-400" : latestFacialData.attentionLevel === "medium" ? "text-neutral-300" : "text-red-400"}>
                        {latestFacialData.attentionLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.blink')}: </span>
                      <span className="text-neutral-300">{blinkRate}/min</span>
                    </div>
                    <div className="p-1.5 rounded bg-neutral-800/30">
                      <span className="text-neutral-500">{t('dataInput.gaze')}: </span>
                      <span className={latestFacialData.gazeDirection === "at_camera" ? "text-green-400" : latestFacialData.gazeDirection === "away" ? "text-neutral-300" : "text-neutral-400"}>
                        {latestFacialData.gazeDirection.toUpperCase().replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {!isWebcamEnabled && (
              <div className="h-48 flex items-center justify-center rounded-lg bg-neutral-950 border border-neutral-800">
                <p className="text-neutral-500 text-xs">{t('dataInput.enableWebcamMessage')}</p>
              </div>
            )}

            <p className="text-xs text-neutral-600">
              {t('dataInput.facialDataCaptureInterval')}
            </p>
          </div>
        )}

        {activeTab === "screen" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">{t('dataInput.screenCapture')}</span>
              <button
                onClick={isScreenCapturing ? onStopScreenCapture : onStartScreenCapture}
                disabled={!sessionId}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  isScreenCapturing
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-neutral-800/20 text-neutral-300 border border-neutral-600/30 hover:bg-neutral-800/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isScreenCapturing ? t('dataInput.stopCapturing') : t('dataInput.startCapturing')}
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <div className={`w-3 h-3 rounded-full ${isScreenCapturing ? "bg-red-500 animate-pulse" : "bg-neutral-600"}`} />
              <span className="text-xs text-neutral-400">
                {isScreenCapturing ? t('dataInput.capturingScreenshots', { count: String(screenshotCount) }) : t('dataInput.screenCaptureOff')}
              </span>
            </div>

            <p className="text-xs text-neutral-600">
              {t('dataInput.screenshotInterval')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AudioLevelMeter({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, (avg / 128) * 100);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / 20;
      for (let i = 0; i < 20; i++) {
        const barHeight = (dataArray[i * 4] / 255) * canvas.height;
        const hue = 120 - (dataArray[i * 4] / 255) * 120;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(i * barWidth + 1, canvas.height - barHeight, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
