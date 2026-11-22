"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { LiveExcalidrawAPI } from "@/components/excalidraw-canvas/excalidraw-api";
import type { IleWorkCanvasCommandId, IleWorkCanvasElement } from "@/lib/learn-work-canvas";
import {
  classifyLaserStroke,
  emptyLaserGestureSession,
  finishLaserStroke,
  flushPendingLaserGesture,
  type LaserStroke,
} from "@/lib/learn-work-canvas-laser-gestures";
import { recordCommandAttempt, recordLaserStroke } from "@/lib/behavior-capture-house";

type LaserPointerPayload = {
  pointer: { x: number; y: number; tool: "pointer" | "laser" };
  button: "up" | "down";
};

export function useWorkCanvasLaser(input: {
  apiRef: MutableRefObject<LiveExcalidrawAPI | null>;
  handleQuickActionRef: MutableRefObject<
    (id: IleWorkCanvasCommandId, selected?: IleWorkCanvasElement[]) => void
  >;
}) {
  const { apiRef, handleQuickActionRef } = input;
  const strokeRef = useRef<LaserStroke>([]);
  const drawingRef = useRef(false);
  const sessionRef = useRef(emptyLaserGestureSession());
  const waitRef = useRef<number | null>(null);

  const clearWait = useCallback(() => {
    if (waitRef.current == null) return;
    window.clearTimeout(waitRef.current);
    waitRef.current = null;
  }, []);

  useEffect(() => () => clearWait(), [clearWait]);

  const onLaserPointerUpdate = useCallback(
    (payload: LaserPointerPayload) => {
      if (payload.pointer.tool !== "laser") {
        drawingRef.current = false;
        strokeRef.current = [];
        return;
      }
      const point = { x: payload.pointer.x, y: payload.pointer.y, t: Date.now() };
      if (payload.button === "down") {
        if (!drawingRef.current) {
          drawingRef.current = true;
          strokeRef.current = [point];
          return;
        }
        const last = strokeRef.current[strokeRef.current.length - 1];
        if (!last || last.x !== point.x || last.y !== point.y) strokeRef.current.push(point);
        return;
      }
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const stroke = strokeRef.current;
      strokeRef.current = [];
      if (stroke.length < 4) return;
      const elements = [...(apiRef.current?.getSceneElements() ?? [])];
      const result = finishLaserStroke({
        session: sessionRef.current,
        stroke,
        elements,
        now: Date.now(),
      });
      sessionRef.current = result.session;
      recordLaserStroke({
        points: stroke,
        kind: classifyLaserStroke(stroke),
        command: result.fire?.command ?? null,
      });
      const run = (targetId: string, command: IleWorkCanvasCommandId) => {
        const target = elements.find((el) => el.id === targetId && !el.isDeleted);
        if (!target) return;
        handleQuickActionRef.current(command, [target]);
      };
      if (result.fire) {
        clearWait();
        run(result.fire.targetId, result.fire.command);
        return;
      }
      if (result.waitMs == null) return;
      clearWait();
      waitRef.current = window.setTimeout(() => {
        waitRef.current = null;
        const flushed = flushPendingLaserGesture(sessionRef.current, Date.now());
        sessionRef.current = flushed.session;
        if (flushed.fire) run(flushed.fire.targetId, flushed.fire.command);
      }, result.waitMs);
    },
    [apiRef, clearWait, handleQuickActionRef],
  );

  return { onLaserPointerUpdate };
}
