"use client";

import { useCallback, useEffect, useState } from "react";
import { PitchWebChrome } from "@/components/pitch-web/pitch-web-chrome";
import {
  PitchWebArtifactSlide,
  PitchWebAutopilotSlide,
  PitchWebEngineSlide,
  PitchWebFreeEnergySlide,
  PitchWebGtmSlide,
  PitchWebProblemSlide,
  PitchWebTractionSlide,
} from "@/components/pitch-web/pitch-web-slides";
import {
  PITCH_WEB_SECTIONS,
  PITCH_WEB_STAGE,
  parsePitchWebHash,
  pitchWebHash,
} from "@/lib/sales/pitch-web-deck";

const SLIDES = [
  PitchWebProblemSlide,
  PitchWebAutopilotSlide,
  PitchWebFreeEnergySlide,
  PitchWebEngineSlide,
  PitchWebArtifactSlide,
  PitchWebGtmSlide,
  PitchWebTractionSlide,
] as const;

function readInitialIndex(): number {
  if (typeof window === "undefined") return 0;
  return parsePitchWebHash(window.location.hash) ?? 0;
}

export function PitchWebDeck() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [hint, setHint] = useState(true);
  const total = PITCH_WEB_SECTIONS.length;
  const section = PITCH_WEB_SECTIONS[index] ?? PITCH_WEB_SECTIONS[0];
  const Slide = SLIDES[index] ?? SLIDES[0];

  const go = useCallback(
    (next: number) => {
      setIndex(Math.min(total - 1, Math.max(0, next)));
      setHint(false);
    },
    [total],
  );

  useEffect(() => {
    setIndex(readInitialIndex());
  }, []);

  useEffect(() => {
    const hash = pitchWebHash(index);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
    }
  }, [index]);

  useEffect(() => {
    const onHash = () => {
      const parsed = parsePitchWebHash(window.location.hash);
      if (parsed !== null) setIndex(parsed);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const fit = () => {
      const next = Math.min(
        window.innerWidth / PITCH_WEB_STAGE.width,
        window.innerHeight / PITCH_WEB_STAGE.height,
      );
      setScale(next);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "PageDown" ||
        event.key === "n" ||
        event.key === "j"
      ) {
        event.preventDefault();
        go(index + 1);
      }
      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp" ||
        event.key === "p" ||
        event.key === "k" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        go(index - 1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        go(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        go(total - 1);
      }
      if (/^[1-7]$/.test(event.key)) {
        event.preventDefault();
        go(Number(event.key) - 1);
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, index, total]);

  useEffect(() => {
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      if (locked) return;
      if (Math.abs(event.deltaY) < 18) return;
      locked = true;
      go(index + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => {
        locked = false;
      }, 420);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [go, index]);

  return (
    <div
      className="flex h-dvh w-full items-center justify-center bg-black text-zinc-100"
      data-pitch-web
      data-pitch-web-index={index}
    >
      <div
        className="relative overflow-hidden bg-[#0b0b0b]"
        style={{
          width: PITCH_WEB_STAGE.width,
          height: PITCH_WEB_STAGE.height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        data-pitch-web-stage
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a, nav")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          go(index + (x < rect.width * 0.22 ? -1 : 1));
        }}
      >
        <PitchWebChrome
          activeId={section.id}
          footer={section.footer}
          onSelect={go}
        >
          <div key={section.id} className="h-full">
            <Slide />
          </div>
        </PitchWebChrome>
        {hint ? (
          <p
            className="pointer-events-none absolute bottom-3 right-6 font-mono text-[12px] uppercase tracking-[1.8px] text-zinc-500"
            data-pitch-web-hint
          >
            ← → · F fullscreen · 1–7 jump
          </p>
        ) : null}
      </div>
    </div>
  );
}
