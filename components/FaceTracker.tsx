"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { useI18n } from "../lib/i18n";

if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  const isMediaPipeLog = (args: unknown[]) => {
    const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    return msg.includes("vision_wasm") || msg.includes("XNNPACK") || msg.includes("TensorFlow") || msg.includes("mediapipe") || msg.includes("wasm");
  };
  
  console.error = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalError.apply(console, args);
  };
  
  console.warn = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalWarn.apply(console, args);
  };
  
  console.info = (...args: unknown[]) => {
    if (isMediaPipeLog(args)) return;
    originalInfo.apply(console, args);
  };
}

export interface FacialDataPoint {
  timestamp: number;
  facePresent: boolean;
  
  // Raw low-level indicators (for raw analysis/ML training)
  eyeOpennessLeft: number;
  eyeOpennessRight: number;
  gazeOffsetX: number;
  gazeOffsetY: number;
  mouthOpenness: number;
  mouthCornerLeft: number;
  mouthCornerRight: number;
  eyebrowLeftInner: number;
  eyebrowLeftOuter: number;
  eyebrowRightInner: number;
  eyebrowRightOuter: number;
  noseTipY: number;
  faceWidth: number;
  faceHeight: number;
  pupilLeftX: number;
  pupilLeftY: number;
  pupilRightX: number;
  pupilRightY: number;
  lipCornerLeftX: number;
  lipCornerLeftY: number;
  lipCornerRightX: number;
  lipCornerRightY: number;
  upperLipY: number;
  lowerLipY: number;
  
  // Head pose (raw)
  headPitch: number;
  headYaw: number;
  headRoll: number;
  
  // Derived states
  gazeDirection: "at_camera" | "away" | "unknown";
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  mouthState: "open" | "closed";
  faceDistance: "optimal" | "too_close" | "too_far";
  
  // Inferred high-level indicators (for tutoring)
  emotion: "neutral" | "happy" | "confused" | "frustrated" | "surprised" | "bored" | "thinking";
  attentionLevel: "high" | "medium" | "low";
  confusionScore: number;
  frustrationScore: number;
  engagementScore: number;
  processingScore: number;
  smileScore: number;
}

interface FaceTrackerProps {
  isEnabled: boolean;
  onDataPoint: (data: FacialDataPoint) => void;
  onError?: (error: string) => void;
}

export function FaceTracker({ isEnabled, onDataPoint, onError }: FaceTrackerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastBlinkRef = useRef<number>(0);
  const blinkCountRef = useRef<number>(0);
  const blinkRateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevEyeStateRef = useRef<"open" | "closed">("open");
  const onErrorRef = useRef(onError);
  const onDataPointRef = useRef(onDataPoint);
  const isInitializedRef = useRef(false);
  const isWebcamOnRef = useRef(false);
  
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onDataPointRef.current = onDataPoint; }, [onDataPoint]);

  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { isWebcamOnRef.current = isWebcamOn; }, [isWebcamOn]);

  const calculateEmotionScores = useCallback((
    facePresent: boolean,
    gazeDirection: "at_camera" | "away" | "unknown",
    mouthState: "open" | "closed",
    mouthOpenness: number,
    mouthCornerLeft: number,
    mouthCornerRight: number,
    eyebrowLeftInner: number,
    eyebrowLeftOuter: number,
    eyebrowRightInner: number,
    eyebrowRightOuter: number,
    eyeOpennessLeft: number,
    eyeOpennessRight: number,
    headPose: { pitch: number; yaw: number; roll: number }
  ): { emotion: FacialDataPoint["emotion"]; confusionScore: number; frustrationScore: number; smileScore: number; engagementScore: number; processingScore: number; attentionLevel: FacialDataPoint["attentionLevel"] } => {
    if (!facePresent) {
      return { emotion: "neutral", confusionScore: 0, frustrationScore: 0, smileScore: 0, engagementScore: 0, processingScore: 0, attentionLevel: "low" };
    }

    let confusionScore = 0;
    let frustrationScore = 0;
    let smileScore = 0;

    // Smile detection: both corners elevated (higher = more elevated)
    const avgMouthCorner = (mouthCornerLeft + mouthCornerRight) / 2;
    smileScore = Math.max(0, Math.min(100, avgMouthCorner * 200));

    // Confusion: inner eyebrows raised (higher y = lower on screen = raised), tight lips
    const avgEyebrowInner = (eyebrowLeftInner + eyebrowRightInner) / 2;
    const eyebrowRaise = avgEyebrowInner < 0.32 ? 1 - (avgEyebrowInner / 0.32) : 0;
    const lipTension = mouthOpenness < 0.03 ? 1 : 0;
    confusionScore = Math.min(100, (eyebrowRaise * 60 + lipTension * 40));

    // Frustration: lowered eyebrows + (open mouth OR tight lips)
    const avgEyebrowOuter = (eyebrowLeftOuter + eyebrowRightOuter) / 0.4;
    const eyebrowLower = avgEyebrowOuter > 0.28 ? (avgEyebrowOuter - 0.28) * 200 : 0;
    const frustratedMouth = mouthState === "open" || mouthOpenness < 0.02;
    frustrationScore = Math.min(100, eyebrowLower * 40 + (frustratedMouth ? 60 : 0));

    // Engagement: eye contact + stable head
    let engagementScore = 50;
    if (gazeDirection === "at_camera") engagementScore += 30;
    else if (gazeDirection === "away") engagementScore -= 10;
    
    const headStable = Math.abs(headPose.pitch) < 15 && Math.abs(headPose.yaw) < 20;
    if (headStable) engagementScore += 20;
    
    const eyesOpen = (eyeOpennessLeft + eyeOpennessRight) / 2 > 0.02;
    if (eyesOpen) engagementScore += 10;
    
    engagementScore = Math.min(100, Math.max(0, engagementScore));

    // Processing: looking away + not confused = thinking/processing
    let processingScore = 0;
    if (gazeDirection === "away" && confusionScore < 30 && frustrationScore < 30) {
      processingScore = 70;
    } else if (gazeDirection === "at_camera" && confusionScore < 30) {
      processingScore = 50;
    }
    processingScore = Math.min(100, Math.max(0, processingScore));

    // Determine emotion
    let emotion: FacialDataPoint["emotion"] = "neutral";
    if (smileScore > 40) emotion = "happy";
    else if (confusionScore > 50) emotion = "confused";
    else if (frustrationScore > 50) emotion = "frustrated";
    else if (eyeOpennessLeft < 0.01 && eyeOpennessRight < 0.01) emotion = "bored";
    else if (gazeDirection === "away" && processingScore > 50) emotion = "thinking";

    // Attention level
    let attentionLevel: FacialDataPoint["attentionLevel"] = "medium";
    if (engagementScore >= 70 && gazeDirection === "at_camera") attentionLevel = "high";
    else if (engagementScore < 40 || emotion === "bored") attentionLevel = "low";

    return { emotion, confusionScore, frustrationScore, smileScore, engagementScore, processingScore, attentionLevel };
  }, []);

  const processFrame = useCallback(async () => {
    if (!isEnabled || !isWebcamOnRef.current || !faceLandmarkerRef.current || !videoRef.current) return;

    const startTimeMs = performance.now();
    const result = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    const now = Date.now();
    const face = result.faceLandmarks && result.faceLandmarks.length > 0 ? result.faceLandmarks[0] : null;

    let headPose = { pitch: 0, yaw: 0, roll: 0 };
    let mouthState: "open" | "closed" = "closed";
    let eyeState: "open" | "closed" = "open";
    let gazeDirection: "at_camera" | "away" | "unknown" = "unknown";

    // Raw values defaults
    let eyeOpennessLeft = 0;
    let eyeOpennessRight = 0;
    let gazeOffsetX = 0;
    let gazeOffsetY = 0;
    let mouthOpenness = 0;
    let mouthCornerLeft = 0.5;
    let mouthCornerRight = 0.5;
    let eyebrowLeftInner = 0.35;
    let eyebrowLeftOuter = 0.32;
    let eyebrowRightInner = 0.35;
    let eyebrowRightOuter = 0.32;
    let noseTipY = 0.5;
    let faceWidth = 0;
    let faceHeight = 0;
    let pupilLeftX = 0;
    let pupilLeftY = 0;
    let pupilRightX = 0;
    let pupilRightY = 0;
    let lipCornerLeftX = 0.4;
    let lipCornerLeftY = 0.6;
    let lipCornerRightX = 0.6;
    let lipCornerRightY = 0.6;
    let upperLipY = 0.55;
    let lowerLipY = 0.58;

    if (face && face.length > 468) {
      const nose = face[1];
      const leftEye = face[33];
      const rightEye = face[263];
      const leftEyeTop = face[159];
      const leftEyeBottom = face[145];
      const rightEyeTop = face[386];
      const rightEyeBottom = face[374];
      const upperLip = face[13];
      const lowerLip = face[14];
      const leftMouthCorner = face[61];
      const rightMouthCorner = face[291];
      const leftEyebrowInner = face[107];
      const leftEyebrowOuter = face[70];
      const rightEyebrowInner = face[336];
      const rightEyebrowOuter = face[300];
      const leftPupil = face[468];
      const rightPupil = face[473];
      const faceOutlineTop = face[10];
      const faceOutlineBottom = face[152];
      const faceOutlineLeft = face[234];
      const faceOutlineRight = face[454];

      eyeOpennessLeft = Math.abs(leftEyeTop.y - leftEyeBottom.y);
      eyeOpennessRight = Math.abs(rightEyeTop.y - rightEyeBottom.y);

      const eyeCenterX = (leftEye.x + rightEye.x) / 2;
      const eyeCenterY = (leftEye.y + rightEye.y) / 2;
      gazeOffsetX = Math.abs(nose.x - eyeCenterX);
      gazeOffsetY = Math.abs(nose.y - eyeCenterY);
      
      if (gazeOffsetX < 0.02) gazeDirection = "at_camera";
      else if (gazeOffsetX < 0.05) gazeDirection = "away";
      else gazeDirection = "unknown";

      const avgOpenness = (eyeOpennessLeft + eyeOpennessRight) / 2;
      eyeState = avgOpenness < 0.015 ? "closed" : "open";

      mouthOpenness = Math.abs(upperLip.y - lowerLip.y);
      mouthState = mouthOpenness > 0.02 ? "open" : "closed";

      mouthCornerLeft = 1 - leftMouthCorner.y;
      mouthCornerRight = 1 - rightMouthCorner.y;

      eyebrowLeftInner = leftEyebrowInner.y;
      eyebrowLeftOuter = leftEyebrowOuter.y;
      eyebrowRightInner = rightEyebrowInner.y;
      eyebrowRightOuter = rightEyebrowOuter.y;

      noseTipY = nose.y;
      faceWidth = Math.abs(faceOutlineRight.x - faceOutlineLeft.x);
      faceHeight = Math.abs(faceOutlineBottom.y - faceOutlineTop.y);

      pupilLeftX = leftPupil.x;
      pupilLeftY = leftPupil.y;
      pupilRightX = rightPupil.x;
      pupilRightY = rightPupil.y;

      lipCornerLeftX = leftMouthCorner.x;
      lipCornerLeftY = leftMouthCorner.y;
      lipCornerRightX = rightMouthCorner.x;
      lipCornerRightY = rightMouthCorner.y;
      upperLipY = upperLip.y;
      lowerLipY = lowerLip.y;

      const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
      headPose = {
        pitch: (nose.y - 0.5) * 50,
        yaw: (nose.x - 0.5) * -50,
        roll
      };
    }

    if (eyeState === "closed" && prevEyeStateRef.current === "open" && now - lastBlinkRef.current > 200) {
      blinkCountRef.current++;
      lastBlinkRef.current = now;
    }
    prevEyeStateRef.current = eyeState;

    const emotionScores = calculateEmotionScores(
      !!face,
      gazeDirection,
      mouthState,
      mouthOpenness,
      mouthCornerLeft,
      mouthCornerRight,
      eyebrowLeftInner,
      eyebrowLeftOuter,
      eyebrowRightInner,
      eyebrowRightOuter,
      eyeOpennessLeft,
      eyeOpennessRight,
      headPose
    );

    const dataPoint: FacialDataPoint = {
      timestamp: now,
      facePresent: !!face,
      
      // Raw low-level
      eyeOpennessLeft,
      eyeOpennessRight,
      gazeOffsetX,
      gazeOffsetY,
      mouthOpenness,
      mouthCornerLeft,
      mouthCornerRight,
      eyebrowLeftInner,
      eyebrowLeftOuter,
      eyebrowRightInner,
      eyebrowRightOuter,
      noseTipY,
      faceWidth,
      faceHeight,
      pupilLeftX,
      pupilLeftY,
      pupilRightX,
      pupilRightY,
      lipCornerLeftX,
      lipCornerLeftY,
      lipCornerRightX,
      lipCornerRightY,
      upperLipY,
      lowerLipY,
      
      // Head pose
      headPitch: headPose.pitch,
      headYaw: headPose.yaw,
      headRoll: headPose.roll,
      
      // Derived states
      gazeDirection,
      headPose,
      mouthState,
      faceDistance: "optimal",
      
      // Inferred high-level
      emotion: emotionScores.emotion,
      attentionLevel: emotionScores.attentionLevel,
      confusionScore: emotionScores.confusionScore,
      frustrationScore: emotionScores.frustrationScore,
      engagementScore: emotionScores.engagementScore,
      processingScore: emotionScores.processingScore,
      smileScore: emotionScores.smileScore,
    };

    if (onDataPointRef.current) onDataPointRef.current(dataPoint);
  }, [isEnabled, calculateEmotionScores]);

  useEffect(() => {
    console.log("[FaceTracker] useEffect triggered, isEnabled:", isEnabled);
    if (!isEnabled) {
      console.log("[FaceTracker] Cleaning up - stopping stream");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsWebcamOn(false);
      setIsLoading(true);
      isInitializedRef.current = false;
      if (blinkRateIntervalRef.current) {
        clearInterval(blinkRateIntervalRef.current);
        blinkRateIntervalRef.current = null;
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        console.log("[FaceTracker] Loading FilesetResolver...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        console.log("[FaceTracker] FilesetResolver loaded");
        
        console.log("[FaceTracker] Loading FaceLandmarker model...");
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (!isMounted) return;
        
        faceLandmarkerRef.current = faceLandmarker;
        console.log("[FaceTracker] FaceLandmarker created");

        console.log("[FaceTracker] Requesting webcam...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        setIsWebcamOn(true);
        setIsLoading(false);
        console.log("[FaceTracker] Initialization complete!");
        setWebcamError(null);

        blinkRateIntervalRef.current = setInterval(() => {
          const rate = blinkCountRef.current;
          blinkCountRef.current = 0;
          const entry: FacialDataPoint = {
            timestamp: Date.now(),
            facePresent: true,
            
            // Raw low-level (defaults)
            eyeOpennessLeft: 0.03,
            eyeOpennessRight: 0.03,
            gazeOffsetX: 0,
            gazeOffsetY: 0,
            mouthOpenness: 0.01,
            mouthCornerLeft: 0.5,
            mouthCornerRight: 0.5,
            eyebrowLeftInner: 0.35,
            eyebrowLeftOuter: 0.32,
            eyebrowRightInner: 0.35,
            eyebrowRightOuter: 0.32,
            noseTipY: 0.5,
            faceWidth: 0.5,
            faceHeight: 0.6,
            pupilLeftX: 0.33,
            pupilLeftY: 0.5,
            pupilRightX: 0.67,
            pupilRightY: 0.5,
            lipCornerLeftX: 0.4,
            lipCornerLeftY: 0.6,
            lipCornerRightX: 0.6,
            lipCornerRightY: 0.6,
            upperLipY: 0.55,
            lowerLipY: 0.57,
            
            // Head pose
            headPitch: 0,
            headYaw: 0,
            headRoll: 0,
            
            // Derived states
            gazeDirection: "at_camera",
            headPose: { pitch: 0, yaw: 0, roll: 0 },
            mouthState: "closed",
            faceDistance: "optimal",
            
            // Inferred high-level
            emotion: "neutral",
            attentionLevel: "medium",
            confusionScore: 0,
            frustrationScore: 0,
            engagementScore: 50,
            processingScore: 50,
            smileScore: 0,
          };
          if (onDataPointRef.current) onDataPointRef.current(entry);
        }, 60000);

        trackingIntervalRef.current = setInterval(processFrame, 500);
        isInitializedRef.current = true;
      } catch (err) {
        console.error("[FaceTracker] Init error:", err);
        if (!isMounted) return;
        const error = err as Error;
        setWebcamError(error.message || t('faceTracker.failedToInitialize'));
        if (onErrorRef.current) onErrorRef.current(error.message || "Failed to initialize");
        setIsLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (blinkRateIntervalRef.current) {
        clearInterval(blinkRateIntervalRef.current);
        blinkRateIntervalRef.current = null;
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [isEnabled, processFrame, onError]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full h-48 rounded-none overflow-hidden bg-neutral-900">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        style={{ opacity: isWebcamOn ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-neutral-400 text-xs">{t('faceTracker.loadingModel')}</p>
        </div>
      )}
      {webcamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-red-400 text-xs text-center px-4">{webcamError}</p>
        </div>
      )}
      {!isWebcamOn && !isLoading && !webcamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <p className="text-neutral-400 text-xs">{t('faceTracker.initializingWebcam')}</p>
        </div>
      )}
    </div>
  );
}