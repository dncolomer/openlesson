"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionConsoleMarks } from "@/components/session-view/session-console-marks";
import type { SessionViewTranslate } from "@/components/session-view/types";
import {
  ILE_START_TIP_IDS,
  ILE_START_TIP_INTERVAL_MS,
  ILE_START_TIP_LABEL_KEYS,
  nextIleStartTipIndex,
  shuffleIleStartTipIds,
  type IleStartTipId,
} from "@/lib/ile-pregame-settings";
import { sessionFieldLoadProgress } from "@/lib/session-field-gate";

export function IleStartLoading({
  t,
  statusLabel = null,
  fieldStatus = null,
  fieldError = null,
  children = null,
}: {
  t: SessionViewTranslate;
  /** Replaces "Starting session" when this same plate is a save or a route wait. */
  statusLabel?: string | null;
  fieldStatus?: "preparing" | "failed" | null;
  fieldError?: string | null;
  /** Extra readout under the current tip. The plate stays the tips screen. */
  children?: ReactNode;
}) {
  // The first paint stays on ILE_START_TIP_IDS. Shuffling during render
  // uses Math.random and the server order will not match the client.
  const [order, setOrder] = useState<readonly IleStartTipId[]>(ILE_START_TIP_IDS);
  const [index, setIndex] = useState(0);
  const tipId = order[index] ?? ILE_START_TIP_IDS[0];
  const tip = t(ILE_START_TIP_LABEL_KEYS[tipId]);

  useEffect(() => {
    const next = shuffleIleStartTipIds();
    setOrder(next);
    setIndex(0);
    if (next.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => nextIleStartTipIndex(current, next.length));
    }, ILE_START_TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (fieldStatus !== "preparing") return;
    const started = Date.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 400);
    return () => window.clearInterval(timer);
  }, [fieldStatus]);
  const field = fieldStatus
    ? sessionFieldLoadProgress({ status: fieldStatus, elapsedMs, error: fieldError })
    : null;

  const slot = String(index + 1).padStart(2, "0");
  const total = String(order.length).padStart(2, "0");

  return (
    <div data-ile-start-loading className="flex w-full max-w-2xl flex-col">
      <div className="relative border border-white/40 bg-black">
        <SessionConsoleMarks />
        <div className="relative z-[2] px-5 py-5 sm:px-7 sm:py-6">
          <LoadingStatusMessage
            message={statusLabel?.trim() || t("session.startLoading")}
            className="text-left"
            size="sm"
          />
          <section
            data-ile-start-tips
            aria-roledescription="carousel"
            aria-label={t("session.startTipsTitle")}
            className="mt-6 border-t border-white/25 pt-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
                {t("session.startTipsTitle")}
              </p>
              <p
                data-ile-start-tip-index=""
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-white"
              >
                {slot} / {total}
              </p>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden="true">
              {order.map((id, markIndex) => (
                <span
                  key={id}
                  data-ile-start-tip-mark={id}
                  data-active={markIndex === index ? "true" : "false"}
                  className={
                    markIndex === index ? "h-1 flex-1 bg-white" : "h-1 flex-1 bg-white/20"
                  }
                />
              ))}
            </div>
            <p
              key={tipId}
              data-ile-start-tip={tipId}
              className="mt-5 border border-white/30 px-4 py-4 text-left font-mono text-sm leading-relaxed tracking-wide text-white sm:text-base"
            >
              {tip}
            </p>
            {field ? (
              <div className="mt-5 border-t border-white/25 pt-4">
                <p className="font-mono text-xs leading-relaxed text-white" data-session-field-label>
                  {field.label}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={field.percent}
                  aria-label={field.label}
                  className="mt-3 h-1 w-full bg-white/20"
                >
                  <div className="h-full bg-white" style={{ width: `${field.percent}%` }} />
                </div>
              </div>
            ) : null}
            {children ? <div className="mt-5 border-t border-white/25 pt-5">{children}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
