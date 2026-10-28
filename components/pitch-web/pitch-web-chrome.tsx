import { cn } from "@/lib/utils";
import {
  PITCH_WEB_SECTIONS,
  type PitchWebSectionId,
} from "@/lib/sales/pitch-web-deck";

export function PitchWebMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      fill="none"
    >
      <path
        d="M9 5.5 V22.5 A11 11 0 0 0 31 22.5 V5.5"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="22.5" r="2.15" fill="white" />
    </svg>
  );
}

export function PitchWebCornerTicks({
  className,
  color = "rgba(255,255,255,0.85)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {[
        "M 0 10 L 0 0 L 10 0",
        "M 90 0 L 100 0 L 100 10",
        "M 0 90 L 0 100 L 10 100",
        "M 90 100 L 100 100 L 100 90",
      ].map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function PitchWebKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex self-start border-[1.5px] border-[#6ec8e8] px-3.5 py-1.5 font-mono text-[15px] font-medium uppercase tracking-[2px] text-[#6ec8e8]">
      {children}
    </div>
  );
}

export function PitchWebHudBox({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden border border-white/55 bg-[#071820] px-7 py-5",
        className,
      )}
      data-pitch-web-hud
    >
      <PitchWebCornerTicks color="#6ec8e8" />
      {title ? (
        <p className="relative z-[1] mb-3 text-center font-mono text-[14px] font-medium uppercase tracking-[2.2px] text-[#6ec8e8]">
          {title}
        </p>
      ) : null}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function PitchWebHeadline({
  lines,
}: {
  lines: Array<{ text: string; tone?: "white" | "cyan" }>;
}) {
  return (
    <h1 className="mt-4 text-[52px] font-semibold leading-[0.95] tracking-[-1.2px]">
      {lines.map((line) => (
        <span
          key={line.text}
          className={cn(
            "block uppercase",
            line.tone === "cyan" ? "text-[#6ec8e8]" : "text-white",
          )}
        >
          {line.text}
        </span>
      ))}
    </h1>
  );
}

export function PitchWebPoints({
  items,
  compact,
}: {
  items: Array<{ n: string; text: React.ReactNode }>;
  compact?: boolean;
}) {
  return (
    <ol className={cn("mt-6 space-y-4", compact && "mt-3 space-y-3")}>
      {items.map((item) => (
        <li key={item.n} className="flex gap-3.5 text-[20px] leading-snug text-zinc-200">
          <span className="w-7 shrink-0 font-mono text-[18px] font-medium text-[#6ec8e8]">
            {item.n}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function PitchWebNav({
  activeId,
  onSelect,
}: {
  activeId: PitchWebSectionId;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      className="flex w-full items-stretch border border-white/70"
      data-pitch-web-nav
      aria-label="Pitch sections"
    >
      {PITCH_WEB_SECTIONS.map((section, index) => {
        const active = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(index)}
            data-pitch-web-nav-item={section.id}
            data-active={active ? "true" : "false"}
            className={cn(
              "relative flex flex-1 items-center justify-center px-2 py-2.5 font-mono text-[13px] font-medium uppercase tracking-[1.6px] transition",
              index > 0 && "border-l border-white/40",
              active ? "text-[#6ec8e8]" : "text-zinc-300 hover:text-white",
            )}
          >
            {section.nav}
            {active ? (
              <span className="absolute inset-x-6 bottom-1.5 h-[2px] bg-[#6ec8e8]" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function PitchWebChrome({
  activeId,
  footer,
  onSelect,
  children,
}: {
  activeId: PitchWebSectionId;
  footer: string;
  onSelect: (index: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full w-full flex-col px-12 pb-7 pt-8 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px]"
        aria-hidden
      />
      <header className="relative z-[1] mb-5 flex items-center gap-3">
        <PitchWebMark className="h-9 w-9" />
        <p className="font-mono text-[18px] font-medium uppercase tracking-[3.6px] text-white">
          Uncertain Systems
        </p>
      </header>
      <div className="relative z-[1]">
        <PitchWebNav activeId={activeId} onSelect={onSelect} />
      </div>
      <div className="relative z-[1] mt-6 min-h-0 flex-1">{children}</div>
      <footer className="relative z-[1] mt-5 flex items-end justify-center">
        <span className="pointer-events-none absolute bottom-0 left-0 h-8 w-8 border-b border-l border-white/70" />
        <span className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 border-b border-r border-white/70" />
        <p className="relative px-16 text-center font-mono text-[22px] font-medium uppercase tracking-[2.4px] text-white">
          {footer}
        </p>
      </footer>
    </div>
  );
}
