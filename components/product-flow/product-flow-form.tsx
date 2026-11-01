import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Mono kicker shared with dashboard and Organization cards. */
export const FLOW_FORM_LABEL =
  "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

/** Black hairline field — not a gray inset. */
export const FLOW_FORM_INPUT =
  "w-full rounded-none border border-white/40 bg-black px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none";

export const FLOW_FORM_TEXTAREA = `${FLOW_FORM_INPUT} resize-y`;

export const FLOW_PRIMARY_BTN =
  "inline-flex h-12 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40";

export const FLOW_SECONDARY_BTN =
  "console-button inline-flex h-12 items-center justify-center px-6 text-sm font-medium text-neutral-200 transition hover:border-white/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export const FLOW_GHOST_BTN =
  "console-button inline-flex h-10 items-center justify-center px-4 text-xs font-medium text-neutral-300 transition hover:border-white/80 hover:text-white disabled:opacity-40";

export const FLOW_DANGER_BTN =
  "console-button inline-flex h-10 items-center justify-center px-4 text-xs font-medium text-red-300 transition hover:border-red-300/70 hover:text-red-200 disabled:opacity-40";

export function FlowFormHeader({
  kicker,
  title,
  description,
  backHref,
  backLabel = "Back to flows",
  extra,
}: {
  kicker?: ReactNode;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="console-copy px-6 py-7 sm:px-8 sm:py-8">
      {backHref ? (
        <Link
          href={backHref}
          className="text-xs text-neutral-400 transition hover:text-white"
        >
          ← {backLabel}
        </Link>
      ) : null}
      {kicker ? <div className={backHref ? "mt-5" : undefined}>{kicker}</div> : null}
      <h1
        className={`${backHref || kicker ? "mt-4" : ""} text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl`}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">{description}</p>
      ) : null}
      {extra}
    </div>
  );
}

export function FlowFormCard({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("console-copy space-y-5 px-6 py-6 sm:px-8 sm:py-8", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function FlowField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className={FLOW_FORM_LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function FlowWizardSteps({
  steps,
  current,
}: {
  steps: readonly string[];
  current: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const active = step === current;
        return (
          <span
            key={step}
            className={`console-chip px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.6px] ${
              active ? "text-white" : "text-neutral-500"
            }`}
          >
            {String(index + 1).padStart(2, "0")} {step}
          </span>
        );
      })}
    </div>
  );
}
