"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { isMuseSupported, getLabsMuseManager, type LabsStatus } from "@/lib/labs-muse-manager";
import { SignalQualityChecker, type CalibrationResult, type ChannelQuality } from "@/lib/labs-signal-quality";
import { FeatureExtractor } from "@/lib/labs-feature-extractor";
import { MasteryClassifier, type ClassificationResult, type MasteryLevel } from "@/lib/labs-classifier";
import { generateProbes, type Probe } from "@/lib/labs-ai";

type AppState = "idle" | "connecting" | "calibrating" | "ready" | "testing" | "complete";

export function LabsMasteryCheck() {
  const supabase = createClient();
  
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [appState, setAppState] = useState<AppState>("idle");
  const [topic, setTopic] = useState("");
  const [probes, setProbes] = useState<Probe[]>([]);
  const [generatingProbes, setGeneratingProbes] = useState(false);
  
  const [deviceStatus, setDeviceStatus] = useState<string>("");
  const [battery, setBattery] = useState(0);
  const [channelQuality, setChannelQuality] = useState<ChannelQuality[]>([]);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [features, setFeatures] = useState<any>(null);
  const [liveSamples, setLiveSamples] = useState<Record<string, number[]>>({});
  const [debugRawSamples, setDebugRawSamples] = useState<Record<string, number[]>>({});
  
  const museManagerRef = useRef<ReturnType<typeof getLabsMuseManager> | null>(null);
  const signalCheckerRef = useRef<SignalQualityChecker | null>(null);
  const featureExtractorRef = useRef<FeatureExtractor | null>(null);
  const classifierRef = useRef<MasteryClassifier | null>(null);
  const calibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eegUnsubRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (data.user) setUser(data.user);
    });
  }, [supabase]);
  
  const connectMuse = useCallback(async () => {
    if (!isMuseSupported()) {
      setDeviceStatus("Web Bluetooth not supported. Use Chrome on desktop.");
      return;
    }
    
    setAppState("connecting");
    setDeviceStatus("Connecting to Muse...");
    
    museManagerRef.current = getLabsMuseManager();
    
    const unsubStatus = museManagerRef.current.onStatusChange((status: LabsStatus) => {
      setDeviceStatus(status === "connected" ? "Connected to Muse" : `Status: ${status}`);
    });
    
    try {
      await museManagerRef.current.connect();
      setBattery(museManagerRef.current.battery);
      startCalibration();
    } catch (err: any) {
      setDeviceStatus(`Connection failed: ${err.message}`);
      setAppState("idle");
      unsubStatus();
    }
  }, []);
  
  const startCalibration = useCallback(async () => {
    if (!museManagerRef.current) return;
    
    // Clean up previous subscriptions
    if (eegUnsubRef.current) {
      eegUnsubRef.current();
      eegUnsubRef.current = null;
    }
    if (calibrationIntervalRef.current) {
      clearInterval(calibrationIntervalRef.current);
      calibrationIntervalRef.current = null;
    }
    
    setAppState("calibrating");
    setChannelQuality([]);
    setCalibrationResult(null);
    setDeviceStatus("Calibrating - please sit still for 20 seconds...");
    setLiveSamples({});
    signalCheckerRef.current = new SignalQualityChecker();
    
    const unsubEEG = museManagerRef.current.onData((data) => {
      if (data.eeg?.channels) {
        for (const [ch, samples] of Object.entries(data.eeg.channels)) {
          signalCheckerRef.current?.addSample(ch, samples);
          
          // Store live samples for display
          setLiveSamples(prev => {
            const existing = prev[ch] || [];
            const combined = [...existing, ...samples].slice(-64);
            return { ...prev, [ch]: combined };
          });
          
          // DEBUG: Store raw values (first 12 samples of each packet)
          setDebugRawSamples(prev => {
            const existing = prev[ch] || [];
            const newSamples = samples.slice(0, 12); // First 12 from each packet
            return { ...prev, [ch]: newSamples };
          });
        }
        
        const quality = signalCheckerRef.current?.getCurrentQuality();
        if (quality) setChannelQuality(quality);
      }
    });
    
    eegUnsubRef.current = unsubEEG;
    
    await museManagerRef.current.startCalibration();
    
    // Run forever - no 20 second limit
    calibrationIntervalRef.current = setInterval(() => {
      // Update quality display continuously
      const quality = signalCheckerRef.current?.getCurrentQuality();
      if (quality) setChannelQuality(quality);
      
      const goodCount = channelQuality.filter(ch => ch.status === "good").length;
      const fairCount = channelQuality.filter(ch => ch.status === "fair").length;
      setDeviceStatus(`Monitoring signal... ${goodCount} good, ${fairCount} fair, ${7 - goodCount - fairCount} poor`);
    }, 1000);
  }, []);
  
  const startTest = useCallback(async () => {
    if (!topic.trim()) {
      setDeviceStatus("Please enter a topic first.");
      return;
    }
    
    setGeneratingProbes(true);
    setDeviceStatus("Generating probes...");
    
    try {
      const generatedProbes = await generateProbes(topic);
      setProbes(generatedProbes);
      setDeviceStatus("Probes ready. Think about them silently...");
      
      featureExtractorRef.current = new FeatureExtractor(3, 2000);
      classifierRef.current = new MasteryClassifier();
      
      const unsubBandPowers = museManagerRef.current?.onBandPowers((powers) => {
        featureExtractorRef.current?.addBandPowers(powers);
      });
      
      const unsubPPG = museManagerRef.current?.onPPGMetrics((metrics) => {
        featureExtractorRef.current?.addPPGMetrics(metrics);
      });
      
      const unsubIMU = museManagerRef.current?.onIMUMetrics((metrics) => {
        featureExtractorRef.current?.addIMUMetrics(metrics);
      });
      
      const unsubFNIRS = museManagerRef.current?.onFNIRSMetrics((metrics) => {
        featureExtractorRef.current?.addFNIRSMetrics(metrics);
      });
      
      featureExtractorRef.current.start((feats) => {
        setFeatures(feats);
        const result = classifierRef.current?.classify(feats);
        if (result) setClassification(result);
      });
      
      await museManagerRef.current?.startSession();
      
      setAppState("testing");
      setDeviceStatus("Block active - think about the probes...");
    } catch (err: any) {
      setDeviceStatus(`Error: ${err.message}`);
    } finally {
      setGeneratingProbes(false);
    }
  }, [topic]);
  
  const endSession = useCallback(async () => {
    featureExtractorRef.current?.stop();
    
    if (museManagerRef.current) {
      await museManagerRef.current.stopSession();
    }
    
    setAppState("complete");
    setDeviceStatus("Block complete!");
  }, []);
  
  const reset = useCallback(() => {
    // Clean up subscriptions and intervals
    if (eegUnsubRef.current) {
      eegUnsubRef.current();
      eegUnsubRef.current = null;
    }
    if (calibrationIntervalRef.current) {
      clearInterval(calibrationIntervalRef.current);
      calibrationIntervalRef.current = null;
    }
    
    setAppState("idle");
    setTopic("");
    setProbes([]);
    setClassification(null);
    setFeatures(null);
    setCalibrationResult(null);
    setChannelQuality([]);
    setLiveSamples({});
    setDeviceStatus("");
    setChannelQuality([]);
    setDeviceStatus("");
  }, []);
  
  const getMasteryColor = (level: MasteryLevel): string => {
    switch (level) {
      case "MASTER": return "#22c55e";
      case "MID-TIER": return "#eab308";
      case "NOVICE": return "#ef4444";
    }
  };
  
  const getQualityColor = (status: ChannelQuality["status"]): string => {
    switch (status) {
      case "good": return "#22c55e";
      case "fair": return "#eab308";
      case "poor": return "#ef4444";
    }
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-slate-500">Please log in to access Labs.</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Mastery Check</h1>
        <p className="text-slate-400 text-sm">
          Test your understanding of any topic while Muse measures your cognitive state in real-time.
        </p>
      </div>
      
      {appState === "idle" && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h2 className="text-lg font-medium text-white mb-4">Connect Your Muse S Athena</h2>
            <p className="text-sm text-slate-400 mb-4">
              Web Bluetooth required. Use Chrome or Edge on desktop.
            </p>
            <button
              onClick={connectMuse}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {deviceStatus.includes("Connecting") ? "Connecting..." : "Connect Muse Device"}
            </button>
            <p className="text-xs text-slate-500 mt-2">{deviceStatus}</p>
          </div>
          
          {!isMuseSupported() && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">
                Web Bluetooth not supported in this browser. Please use Chrome or Edge on desktop.
              </p>
            </div>
          )}
        </div>
      )}
      
      {appState === "connecting" && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-400">{deviceStatus}</p>
        </div>
      )}
      
      {appState === "calibrating" && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h2 className="text-lg font-medium text-white mb-4">Signal Quality Check</h2>
            <p className="text-sm text-slate-400 mb-4">
              Hold still for 20 seconds while we check electrode contact quality.
            </p>
            
            <div className="grid grid-cols-7 gap-2 mb-4">
              {channelQuality.map((ch, i) => (
                <div key={i} className="text-center">
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-mono"
                    style={{ backgroundColor: getQualityColor(ch.status), color: '#000' }}
                  >
                    {(ch.quality * 100).toFixed(0)}
                  </div>
                  <span className="text-xs text-slate-500">{ch.channel}</span>
                  <div className="text-[10px] text-slate-600">
                    v: {ch.variance.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
            
            {channelQuality.length > 0 && (
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-xs font-mono">
                <div className="grid grid-cols-9 gap-2 text-slate-400 mb-2">
                  <span>CH</span>
                  <span>Var</span>
                  <span>Noise</span>
                  <span>Rails</span>
                  <span>DC Off</span>
                  <span>Qual</span>
                  <span>Status</span>
                </div>
                {channelQuality.map((ch, i) => (
                  <div key={i} className="grid grid-cols-9 gap-2 text-slate-300">
                    <span>{ch.channel}</span>
                    <span>{ch.variance.toFixed(0)}</span>
                    <span>{ch.noiseFloor.toFixed(0)}</span>
                    <span className={ch.railHits > 3 ? "text-red-400" : "text-green-400"}>{ch.railHits}</span>
                    <span className={ch.dcOffset < -75 ? "text-red-400" : ""}>{ch.dcOffset.toFixed(0)}</span>
                    <span>{(ch.quality * 100).toFixed(0)}%</span>
                    <span style={{ color: getQualityColor(ch.status) }}>{ch.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
            
            {Object.keys(liveSamples).length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs text-slate-500 mb-2">Live EEG (last 64 samples)</h4>
                <div className="space-y-2">
                  {["TP9", "AF7", "AF8", "TP10"].map(ch => {
                    const samples = liveSamples[ch] || [];
                    if (samples.length === 0) return null;
                    const min = Math.min(...samples);
                    const max = Math.max(...samples);
                    const range = max - min || 1;
                    
                    return (
                      <div key={ch} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-8">{ch}</span>
                        <div className="flex-1 h-6 bg-slate-900 rounded overflow-hidden">
                          <svg className="w-full h-full" viewBox={`0 0 ${samples.length} 100`} preserveAspectRatio="none">
                            <polyline
                              fill="none"
                              stroke={ch === "AF7" || ch === "AF8" ? "#22c55e" : "#64748b"}
                              strokeWidth="1"
                              points={samples.map((v, i) => `${i},${50 - ((v - min) / range * 80 - 40)}`).join(" ")}
                            />
                          </svg>
                        </div>
                        <span className="text-[10px] text-slate-600 w-16">
                          {min.toFixed(1)} - {max.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* DEBUG: Raw sample values */}
            {Object.keys(debugRawSamples).length > 0 && (
              <div className="mt-4 p-3 bg-cyan-900/20 border border-cyan-800 rounded-lg">
                <h4 className="text-xs text-cyan-400 mb-2">DEBUG: Raw Sample Values (first 12 of latest packet)</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  {Object.entries(debugRawSamples).map(([ch, samples]) => (
                    <div key={ch}>
                      <span className="text-cyan-500">{ch}:</span>
                      <span className="text-cyan-300 ml-2">
                        [{samples.map(v => v.toFixed(1)).join(", ")}]
                      </span>
                      <div className="text-cyan-600 text-[10px]">
                        min: {Math.min(...samples).toFixed(1)} | max: {Math.max(...samples).toFixed(1)} | avg: {(samples.reduce((a,b) => a+b,0)/samples.length).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-sm text-slate-400 mt-4">{deviceStatus}</p>
            
            {/* Stop monitoring and confirm button */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  if (calibrationIntervalRef.current) {
                    clearInterval(calibrationIntervalRef.current);
                    calibrationIntervalRef.current = null;
                  }
                  setAppState("ready");
                  setDeviceStatus("Ready to test your mastery!");
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Confirm & Continue
              </button>
              
              <button
                onClick={() => {
                  if (eegUnsubRef.current) {
                    eegUnsubRef.current();
                    eegUnsubRef.current = null;
                  }
                  if (calibrationIntervalRef.current) {
                    clearInterval(calibrationIntervalRef.current);
                    calibrationIntervalRef.current = null;
                  }
                  setAppState("idle");
                  setChannelQuality([]);
                  setCalibrationResult(null);
                  setLiveSamples({});
                  setDeviceStatus("Monitoring stopped");
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Stop Monitoring
              </button>
            </div>
            
            {(channelQuality.length === 0 || channelQuality.every(ch => ch.status === "poor")) && (
              <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
                <p className="text-sm text-amber-400 mb-2">
                  ⚠️ No signal detected. Make sure:
                </p>
                <ul className="text-xs text-amber-300 list-disc list-inside">
                  <li>Muse is powered on and LEDs are blinking</li>
                  <li>Headband is on your head with electrodes touching skin</li>
                  <li>Remove any hair between electrodes and skin</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {(appState === "ready" || appState === "testing" || appState === "complete") && (
        <div className="space-y-6">
          {calibrationResult && (
            <div className={`p-4 rounded-lg border ${
              calibrationResult.passed ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={calibrationResult.passed ? "text-green-400" : "text-red-400"}>
                  {calibrationResult.passed ? "✓ Signal Quality: Good" : "✗ Signal Quality: Poor"}
                </span>
                {battery > 0 && (
                  <span className="text-xs text-slate-500">Battery: {battery}%</span>
                )}
              </div>
            </div>
          )}
          
          {appState !== "ready" && classification && (
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: getMasteryColor(classification.level), color: "#000" }}
                >
                  {classification.level === "MASTER" ? "M" : classification.level === "MID-TIER" ? "I" : "N"}
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: getMasteryColor(classification.level) }}>
                    {classification.level}
                  </h3>
                  <p className="text-sm text-slate-400">Confidence: {classification.confidence}%</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm">{classification.explanation}</p>
              
              {features && (
                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Gamma/Alpha</span>
                    <p className="text-white">{features.gammaAlphaRatio?.toFixed(2) || "-"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">HRV (RMSSD)</span>
                    <p className="text-white">{features.hrvRMSSD?.toFixed(1) || "-"} ms</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Movement</span>
                    <p className="text-white">{features.movementVariance?.toFixed(2) || "-"}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {appState === "ready" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Topic to test</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Quantum Computing, Machine Learning, World War II..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <button
                onClick={startTest}
                disabled={generatingProbes || !topic.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {generatingProbes ? "Generating Probes..." : "Generate Probes & Start Block"}
              </button>
            </div>
          )}
          
          {probes.length > 0 && (
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
              <h3 className="text-lg font-medium text-white mb-4">Thinking Probes</h3>
              <div className="space-y-3">
                {probes.map((probe) => (
                  <div key={probe.id} className="p-4 bg-slate-900/50 rounded-lg">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      probe.type === "conceptual" ? "bg-purple-900/50 text-purple-400" :
                      probe.type === "application" ? "bg-blue-900/50 text-blue-400" :
                      "bg-orange-900/50 text-orange-400"
                    }`}>
                      {probe.type}
                    </span>
                    <p className="text-slate-300 mt-2">{probe.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Think about these questions silently while the classifier analyzes your cognitive state.
              </p>
            </div>
          )}
          
          {appState === "testing" && (
            <button
              onClick={endSession}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              End Block & View Report
            </button>
          )}
          
          {appState === "complete" && (
            <button
              onClick={reset}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
            >
              Start New Block
            </button>
          )}
          
          {calibrationResult && !calibrationResult.passed && (
            <button
              onClick={() => {
                setAppState("idle");
                setChannelQuality([]);
                setCalibrationResult(null);
              }}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry Connection
            </button>
          )}
          
          <p className="text-xs text-slate-500 text-center">{deviceStatus}</p>
        </div>
      )}
    </div>
  );
}