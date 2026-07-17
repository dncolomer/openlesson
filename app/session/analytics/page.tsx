"use client";

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  getSessionScreenshots,
  getAllTranscripts,
  getAllEEGData,
  getAllFacialData,
  getAllToolEvents,
  getAllAudioChunks,
  type Session,
  type SessionScreenshot,
  type RecentTranscript,
  type RecentToolEvent,
  type RecentAudioChunk,
  type RecentFacialData,
  type FacialDataPoint,
} from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { useI18n } from "@/lib/i18n";

// ---- Types ----

interface EEGDataWithPowers {
  id: string;
  sessionId: string;
  timestamp: number;
  xaiFileId: string;
  chunkIndex: number;
  bandPowers?: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
}

interface FacialChunkData {
  timestamp: number;
  data: FacialDataPoint[];
}

type TabId = "transcripts" | "probes" | "screenshots" | "eeg" | "facial" | "tools" | "audio";

// ---- Helpers ----

function formatOffset(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-blue-900/30 text-blue-400",
    paused: "bg-yellow-900/30 text-yellow-400",
    completed: "bg-green-900/30 text-green-400",
    ended_by_tutor: "bg-red-900/30 text-red-400",
    planning: "bg-purple-900/30 text-purple-400",
    ready: "bg-cyan-900/30 text-cyan-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-neutral-700 text-neutral-400"}`}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function GapScoreBar({ score }: { score: number }) {
  const color = score < 0.4 ? "bg-green-500" : score < 0.7 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score * 100)}%` }} />
      </div>
      <span className="text-xs text-neutral-400">{score.toFixed(2)}</span>
    </div>
  );
}

// ---- Timeline Range Slider ----
// Dual-handle range slider that lets user drag to select a time window

function TimelineSlider({
  totalDurationMs,
  rangeStart,
  rangeEnd,
  onChange,
  dataDensity,
}: {
  totalDurationMs: number;
  rangeStart: number; // 0..1
  rangeEnd: number; // 0..1
  onChange: (start: number, end: number) => void;
  dataDensity: number[]; // array of 100 normalized density values for the sparkline
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "range" | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartValuesRef = useRef({ start: 0, end: 0 });

  const getPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: "start" | "end" | "range") => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = handle;
      dragStartXRef.current = e.clientX;
      dragStartValuesRef.current = { start: rangeStart, end: rangeEnd };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rangeStart, rangeEnd]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !trackRef.current) return;
      const pos = getPosition(e.clientX);

      if (draggingRef.current === "start") {
        onChange(Math.min(pos, rangeEnd - 0.01), rangeEnd);
      } else if (draggingRef.current === "end") {
        onChange(rangeStart, Math.max(pos, rangeStart + 0.01));
      } else if (draggingRef.current === "range") {
        const rect = trackRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStartXRef.current;
        const deltaPct = deltaX / rect.width;
        const width = dragStartValuesRef.current.end - dragStartValuesRef.current.start;
        let newStart = dragStartValuesRef.current.start + deltaPct;
        let newEnd = dragStartValuesRef.current.end + deltaPct;
        if (newStart < 0) {
          newStart = 0;
          newEnd = width;
        }
        if (newEnd > 1) {
          newEnd = 1;
          newStart = 1 - width;
        }
        onChange(newStart, newEnd);
      }
    },
    [getPosition, onChange, rangeStart, rangeEnd]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-neutral-600 font-mono">
        <span>{formatOffset(rangeStart * totalDurationMs)}</span>
        <span className="text-neutral-500">
          {formatOffset(rangeStart * totalDurationMs)} - {formatOffset(rangeEnd * totalDurationMs)}
        </span>
        <span>{formatOffset(totalDurationMs)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-10 select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Data density sparkline background */}
        <div className="absolute inset-x-0 bottom-0 h-6 flex items-end gap-px">
          {dataDensity.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-neutral-800 rounded-t-sm"
              style={{ height: `${Math.max(2, v * 100)}%` }}
            />
          ))}
        </div>

        {/* Inactive regions (dimmed) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/50 rounded-l pointer-events-none"
          style={{ width: `${rangeStart * 100}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/50 rounded-r pointer-events-none"
          style={{ width: `${(1 - rangeEnd) * 100}%` }}
        />

        {/* Active range (draggable) */}
        <div
          className="absolute top-0 bottom-0 border-y border-blue-500/40 bg-blue-500/5 cursor-grab active:cursor-grabbing"
          style={{ left: `${rangeStart * 100}%`, right: `${(1 - rangeEnd) * 100}%` }}
          onPointerDown={(e) => handlePointerDown(e, "range")}
        />

        {/* Start handle */}
        <div
          className="absolute top-0 bottom-0 w-2 -ml-1 bg-blue-500/80 hover:bg-blue-400 rounded cursor-col-resize z-10"
          style={{ left: `${rangeStart * 100}%` }}
          onPointerDown={(e) => handlePointerDown(e, "start")}
        />

        {/* End handle */}
        <div
          className="absolute top-0 bottom-0 w-2 -ml-1 bg-blue-500/80 hover:bg-blue-400 rounded cursor-col-resize z-10"
          style={{ left: `${rangeEnd * 100}%` }}
          onPointerDown={(e) => handlePointerDown(e, "end")}
        />
      </div>
    </div>
  );
}

// ---- Main Component ----

function AnalyticsContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("transcripts");

  // Raw data
  const [transcripts, setTranscripts] = useState<RecentTranscript[]>([]);
  const [screenshots, setScreenshots] = useState<SessionScreenshot[]>([]);
  const [eegData, setEegData] = useState<EEGDataWithPowers[]>([]);
  const [facialData, setFacialData] = useState<RecentFacialData[]>([]);
  const [facialChunks, setFacialChunks] = useState<FacialChunkData[]>([]);
  const [toolEvents, setToolEvents] = useState<RecentToolEvent[]>([]);
  const [audioChunks, setAudioChunks] = useState<RecentAudioChunk[]>([]);

  // Signed URLs
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [screenshotThumbUrls, setScreenshotThumbUrls] = useState<Record<string, string>>({});
  const [screenshotFullUrls, setScreenshotFullUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [screenshotLoadCount, setScreenshotLoadCount] = useState(10);
  // Transcript text (loaded lazily from xAI)
  const [transcriptTexts, setTranscriptTexts] = useState<Record<string, string>>({});

  // Timeline range (0..1 normalized)
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(1);

  const sessionStartMs = session ? new Date(session.startedAt).getTime() : 0;
  const totalDurationMs = session ? Math.max(session.durationMs, 1000) : 1000;

  // ---- Data loading ----

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const loadAll = async () => {
      const s = await getSession(sessionId);
      setSession(s);
      if (!s) {
        setLoading(false);
        return;
      }
      const [tr, sc, eeg, facial, tools, audio] = await Promise.all([
        getAllTranscripts(sessionId),
        getSessionScreenshots(sessionId),
        getAllEEGData(sessionId) as Promise<EEGDataWithPowers[]>,
        getAllFacialData(sessionId),
        getAllToolEvents(sessionId),
        getAllAudioChunks(sessionId),
      ]);
      setTranscripts(tr);
      setScreenshots(sc);
      setEegData(eeg);
      setFacialData(facial);
      setToolEvents(tools);
      setAudioChunks(audio);
      setLoading(false);
    };
    loadAll();
  }, [sessionId]);

  // Sign audio URLs
  useEffect(() => {
    if (audioChunks.length === 0) return;
    const load = async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const urls: Record<string, string> = {};
      for (let i = 0; i < audioChunks.length; i += 10) {
        const batch = audioChunks.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(async (c) => {
            const { data } = await supabase.storage.from("session-audio").createSignedUrl(c.storagePath, 3600);
            return { id: c.id, url: data?.signedUrl || "" };
          })
        );
        results.forEach((r) => { if (r.url) urls[r.id] = r.url; });
      }
      setAudioUrls(urls);
    };
    load();
  }, [audioChunks]);

  // Load facial JSON blobs (now stored on xAI; fetched via our proxy)
  useEffect(() => {
    if (facialData.length === 0) return;
    const load = async () => {
      const chunks: FacialChunkData[] = [];
      const toLoad = facialData.slice(0, 50);
      for (const fd of toLoad) {
        if (!fd.xaiFileId) continue;
        try {
          const res = await fetch(`/api/session-files/download?fileId=${encodeURIComponent(fd.xaiFileId)}`);
          if (!res.ok) continue;
          const parsed = JSON.parse(await res.text());
          chunks.push({ timestamp: fd.timestamp, data: parsed.data || [] });
        } catch { /* skip */ }
      }
      setFacialChunks(chunks);
    };
    load();
  }, [facialData]);

  // ---- Filtering by timeline range ----

  const rangeStartMs = sessionStartMs + rangeStart * totalDurationMs;
  const rangeEndMs = sessionStartMs + rangeEnd * totalDurationMs;

  const inRange = useCallback(
    (timestampMs: number) => timestampMs >= rangeStartMs && timestampMs <= rangeEndMs,
    [rangeStartMs, rangeEndMs]
  );

  const filteredTranscripts = useMemo(() => transcripts.filter((t) => inRange(t.timestamp)), [transcripts, inRange]);
  const filteredProbes = useMemo(() => session?.probes.filter((p) => inRange(p.timestamp)) || [], [session, inRange]);
  const filteredScreenshots = useMemo(() => screenshots.filter((s) => inRange(s.timestamp)), [screenshots, inRange]);
  const filteredEeg = useMemo(() => eegData.filter((e) => inRange(e.timestamp)), [eegData, inRange]);
  const filteredFacialData = useMemo(() => facialData.filter((f) => inRange(f.timestamp)), [facialData, inRange]);
  const filteredFacialChunks = useMemo(
    () => facialChunks.filter((c) => inRange(c.timestamp)),
    [facialChunks, inRange]
  );
  const filteredTools = useMemo(() => toolEvents.filter((t) => inRange(t.timestamp)), [toolEvents, inRange]);
  const filteredAudio = useMemo(() => audioChunks.filter((a) => inRange(a.timestamp)), [audioChunks, inRange]);

  // Load transcript text on demand (xAI proxy)
  useEffect(() => {
    if (filteredTranscripts.length === 0) return;
    const toLoad = filteredTranscripts.filter((t) => !transcriptTexts[t.id]).slice(0, 100);
    if (toLoad.length === 0) return;
    let cancelled = false;
    (async () => {
      const loaded: Record<string, string> = {};
      for (const tr of toLoad) {
        if (!tr.xaiFileId) continue;
        try {
          const res = await fetch(`/api/session-files/download?fileId=${encodeURIComponent(tr.xaiFileId)}`);
          if (res.ok) loaded[tr.id] = await res.text();
        } catch { /* skip */ }
      }
      if (!cancelled && Object.keys(loaded).length > 0) {
        setTranscriptTexts((prev) => ({ ...prev, ...loaded }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTranscripts]);

  // Screenshots: lazy loading with thumbnails, max 10 at a time
  const visibleScreenshots = useMemo(
    () => filteredScreenshots.slice(0, screenshotLoadCount),
    [filteredScreenshots, screenshotLoadCount]
  );

  useEffect(() => {
    if (visibleScreenshots.length === 0) return;
    const toSign = visibleScreenshots.filter((ss) => !screenshotThumbUrls[ss.id]);
    if (toSign.length === 0) return;
    // xAI Files don't expose image transforms — use the full image URL.
    const newUrls: Record<string, string> = {};
    for (const ss of toSign) {
      if (ss.xaiFileId) {
        newUrls[ss.id] = `/api/session-files/download?fileId=${encodeURIComponent(ss.xaiFileId)}`;
      }
    }
    if (Object.keys(newUrls).length > 0) {
      setScreenshotThumbUrls((prev) => ({ ...prev, ...newUrls }));
    }
  }, [visibleScreenshots, screenshotThumbUrls]);

  const openScreenshotLightbox = useCallback(async (ss: SessionScreenshot) => {
    if (screenshotFullUrls[ss.id]) {
      setLightboxUrl(screenshotFullUrls[ss.id]);
      return;
    }
    if (!ss.xaiFileId) return;
    const url = `/api/session-files/download?fileId=${encodeURIComponent(ss.xaiFileId)}`;
    setScreenshotFullUrls((prev) => ({ ...prev, [ss.id]: url }));
    setLightboxUrl(url);
  }, [screenshotFullUrls]);

  // ---- Data density for sparkline ----
  // Compute how many data points fall in each of 100 buckets

  const dataDensity = useMemo(() => {
    const buckets = new Array(100).fill(0);
    const allTimestamps: number[] = [
      ...transcripts.map((t) => t.timestamp),
      ...(session?.probes.map((p) => p.timestamp) || []),
      ...screenshots.map((s) => s.timestamp),
      ...eegData.map((e) => e.timestamp),
      ...facialData.map((f) => f.timestamp),
      ...toolEvents.map((t) => t.timestamp),
      ...audioChunks.map((a) => a.timestamp),
    ];
    for (const ts of allTimestamps) {
      const offset = ts - sessionStartMs;
      const bucket = Math.min(99, Math.max(0, Math.floor((offset / totalDurationMs) * 100)));
      buckets[bucket]++;
    }
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => v / max);
  }, [transcripts, session, screenshots, eegData, facialData, toolEvents, audioChunks, sessionStartMs, totalDurationMs]);

  // ---- Tab definitions ----

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "transcripts", label: t("analytics.transcripts"), count: filteredTranscripts.length },
    { id: "probes", label: t("analytics.probes"), count: filteredProbes.length },
    { id: "screenshots", label: t("analytics.screenshots"), count: filteredScreenshots.length },
    { id: "eeg", label: t("analytics.eegReadings"), count: filteredEeg.length },
    { id: "facial", label: t("analytics.facialData"), count: filteredFacialData.length },
    { id: "tools", label: t("analytics.toolEvents"), count: filteredTools.length },
    { id: "audio", label: t("analytics.audioChunks"), count: filteredAudio.length },
  ];

  const handleRangeChange = useCallback((start: number, end: number) => {
    setRangeStart(start);
    setRangeEnd(end);
    setScreenshotLoadCount(10);
  }, []);

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <LoadingStatusMessage message={t("analytics.loading")} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a]">
        <h1 className="text-2xl font-bold text-white mb-4">{t("analytics.notFound")}</h1>
        <p className="text-neutral-500 mb-8 text-sm">{t("analytics.notFoundDesc")}</p>
        <Link href="/dashboard" className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors">
          {t("analytics.backToDashboard")}
        </Link>
      </div>
    );
  }

  const durationMin = Math.floor(session.durationMs / 60000);
  const durationSec = Math.floor((session.durationMs % 60000) / 1000);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar breadcrumbs={[{ label: t("analytics.breadcrumb") }]} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-5xl max-h-[90vh]">
            <button onClick={() => setLightboxUrl(null)} className="absolute -top-10 right-0 text-neutral-400 hover:text-white text-sm">
              {t("analytics.closeScreenshot")}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxUrl} alt="Screenshot" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        {/* Session Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white mb-1">{session.problem}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <StatusBadge status={session.status} />
              <span>{formatDateTime(session.startedAt)}</span>
              <span>
                {durationMin > 0 ? `${durationMin}m` : ""} {durationSec > 0 ? `${durationSec}s` : ""}
              </span>
              {session.workspaceTitle && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-400">
                  {session.workspaceTitle}
                </span>
              )}
            </div>
          </div>
          <Link href="/dashboard" className="shrink-0 px-3 py-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-800 rounded-lg transition-colors">
            {t("analytics.backToDashboard")}
          </Link>
        </div>

        {/* Timeline Range Slider */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <TimelineSlider
            totalDurationMs={totalDurationMs}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChange={handleRangeChange}
            dataDensity={dataDensity}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-800 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.id ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-600"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 min-h-[400px]">
          {/* Transcripts */}
          {activeTab === "transcripts" && (
            <div className="p-4">
              {filteredTranscripts.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredTranscripts.map((tr) => (
                    <div key={tr.id} className="flex gap-3 text-xs">
                      <span className="text-neutral-600 font-mono shrink-0 w-14 text-right">
                        {formatOffset(tr.timestamp - sessionStartMs)}
                      </span>
                      <p className="text-neutral-300 leading-relaxed">{transcriptTexts[tr.id] || "…"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Probes */}
          {activeTab === "probes" && (
            <div className="p-4">
              {filteredProbes.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredProbes.map((probe) => (
                    <div key={probe.id} className="rounded-lg border border-neutral-800 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-600 font-mono text-xs">
                            {formatOffset(probe.timestamp - sessionStartMs)}
                          </span>
                          {probe.requestType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              {probe.requestType}
                            </span>
                          )}
                          {probe.starred && <span className="text-yellow-500 text-xs">&#9733;</span>}
                        </div>
                        <GapScoreBar score={probe.gapScore} />
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">{probe.text}</p>
                      {probe.expandedText && (
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{probe.expandedText}</p>
                      )}
                      {probe.signals && probe.signals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {probe.signals.map((sig, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400">
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Screenshots */}
          {activeTab === "screenshots" && (
            <div className="p-4">
              {filteredScreenshots.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
                    {visibleScreenshots.map((ss) => {
                      const thumbUrl = screenshotThumbUrls[ss.id];
                      return (
                        <div key={ss.id}>
                          {thumbUrl ? (
                            <button
                              onClick={() => openScreenshotLightbox(ss)}
                              className="w-full aspect-video bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 hover:border-neutral-500 transition-colors"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={thumbUrl}
                                alt={t("analytics.viewScreenshot")}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="w-full aspect-video bg-neutral-800 rounded-lg animate-pulse" />
                          )}
                          <p className="text-[10px] text-neutral-600 mt-1 text-center font-mono">
                            {formatOffset(ss.timestamp - sessionStartMs)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {filteredScreenshots.length > screenshotLoadCount && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setScreenshotLoadCount((c) => c + 10)}
                        className="px-4 py-2 text-xs text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
                      >
                        {t('analytics.loadMore', { n: String(filteredScreenshots.length - screenshotLoadCount) })}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* EEG */}
          {activeTab === "eeg" && (
            <div className="p-4">
              {filteredEeg.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-900">
                      <tr className="text-neutral-500 border-b border-neutral-800">
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.timestamp")}</th>
                        <th className="text-left py-2 pr-3 font-medium">#</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.delta")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.theta")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.alpha")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.beta")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.gamma")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEeg.map((eeg) => (
                        <tr key={eeg.id} className="border-b border-neutral-800/50 text-neutral-300">
                          <td className="py-1.5 pr-3 font-mono text-neutral-500">
                            {formatOffset(eeg.timestamp - sessionStartMs)}
                          </td>
                          <td className="py-1.5 pr-3">{eeg.chunkIndex}</td>
                          <td className="py-1.5 pr-3">
                            <BandPowerCell value={eeg.bandPowers?.delta} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <BandPowerCell value={eeg.bandPowers?.theta} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <BandPowerCell value={eeg.bandPowers?.alpha} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <BandPowerCell value={eeg.bandPowers?.beta} />
                          </td>
                          <td className="py-1.5 pr-3">
                            <BandPowerCell value={eeg.bandPowers?.gamma} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Facial */}
          {activeTab === "facial" && (
            <div className="p-4">
              {filteredFacialData.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : filteredFacialChunks.length === 0 ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-xs text-neutral-500">{t('analytics.loadingFacialData')}</span>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-900">
                      <tr className="text-neutral-500 border-b border-neutral-800">
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.timestamp")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.emotion")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.attention")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.engagement")}</th>
                        <th className="text-left py-2 pr-3 font-medium">{t("analytics.confusion")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFacialChunks.flatMap((chunk) =>
                        chunk.data.length > 0
                          ? [chunk.data[0], ...(chunk.data.length > 1 ? [chunk.data[chunk.data.length - 1]] : [])].map(
                              (dp, i) => (
                                <tr key={`${chunk.timestamp}-${i}`} className="border-b border-neutral-800/50 text-neutral-300">
                                  <td className="py-1.5 pr-3 font-mono text-neutral-500">
                                    {formatOffset((dp.timestamp || chunk.timestamp) - sessionStartMs)}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <EmotionBadge emotion={dp.emotion} />
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <AttentionBadge level={dp.attentionLevel} />
                                  </td>
                                  <td className="py-1.5 pr-3">{dp.engagementScore?.toFixed(2) ?? "-"}</td>
                                  <td className="py-1.5 pr-3">{dp.confusionScore?.toFixed(2) ?? "-"}</td>
                                </tr>
                              )
                            )
                          : []
                      )}
                    </tbody>
                  </table>
                  {facialData.length > 50 && (
                    <p className="text-[10px] text-neutral-600 mt-2">
                      {t('analytics.showingFirstChunks', { total: String(facialData.length) })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tool Events */}
          {activeTab === "tools" && (
            <div className="p-4">
              {filteredTools.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                  {filteredTools.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 text-xs py-1">
                      <span className="text-neutral-600 font-mono shrink-0 w-14 text-right">
                        {formatOffset(ev.timestamp - sessionStartMs)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]">
                        {ev.toolName}
                      </span>
                      <span className="text-neutral-500">{ev.toolAction}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audio */}
          {activeTab === "audio" && (
            <div className="p-4">
              {filteredAudio.length === 0 ? (
                <EmptyState label={t("analytics.noData")} />
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredAudio.map((chunk) => (
                    <div key={chunk.id} className="flex items-center gap-3 text-xs">
                      <span className="text-neutral-600 font-mono shrink-0 w-14 text-right">
                        {formatOffset(chunk.timestamp - sessionStartMs)}
                      </span>
                      <span className="text-neutral-500 shrink-0">#{chunk.chunkIndex}</span>
                      {audioUrls[chunk.id] ? (
                        <audio controls preload="none" className="h-8 flex-1 max-w-md" src={audioUrls[chunk.id]} />
                      ) : (
                        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

// ---- Small UI components ----

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-neutral-600 text-xs">
      {label}
    </div>
  );
}

function BandPowerCell({ value }: { value?: number }) {
  if (value == null) return <span className="text-neutral-700">-</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-8 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span>{value.toFixed(2)}</span>
    </div>
  );
}

function EmotionBadge({ emotion }: { emotion?: string }) {
  const colors: Record<string, string> = {
    happy: "bg-green-900/30 text-green-400",
    confused: "bg-yellow-900/30 text-yellow-400",
    frustrated: "bg-red-900/30 text-red-400",
    thinking: "bg-blue-900/30 text-blue-400",
    surprised: "bg-purple-900/30 text-purple-400",
    bored: "bg-orange-900/30 text-orange-400",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors[emotion || ""] || "bg-neutral-800 text-neutral-400"}`}>
      {emotion || "unknown"}
    </span>
  );
}

function AttentionBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-red-400",
  };
  return <span className={`text-[10px] ${colors[level || ""] || "text-neutral-500"}`}>{level || "-"}</span>;
}

// ---- Page wrapper ----

export default function SessionAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <LoadingStatusMessage message="Loading" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
