"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const GHC_BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

export interface GhcDialogueMessage {
  id: string;
  content: string;
}

type GhcButtonSize = "sm" | "md" | "lg";
type GhcButtonVariant = "ghost" | "primary" | "toggleOn" | "toggleOff";

export function ghcButtonClasses({
  size = "md",
  variant = "ghost",
  className = "",
}: {
  size?: GhcButtonSize;
  variant?: GhcButtonVariant;
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" && "h-8 px-2.5 text-xs",
    size === "md" && "h-9 px-3.5 text-xs",
    size === "lg" && "h-11 px-4 text-sm",
    variant === "ghost" && "border border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600 hover:text-white",
    variant === "primary" && "border border-transparent bg-white text-black hover:bg-neutral-200",
    variant === "toggleOn" && "border border-white bg-white text-black",
    variant === "toggleOff" && "border border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300",
    className,
  );
}

export function GhcButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: GhcButtonSize;
  variant?: GhcButtonVariant;
}) {
  return <button className={ghcButtonClasses({ size, variant, className })} {...props} />;
}

export function GhcKeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center justify-center rounded border border-neutral-600 bg-black/55 px-1.5 font-mono text-[10px] font-medium leading-none text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </span>
  );
}

export function GhcShortcutChord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, index) => (
        <GhcKeyHint key={`${key}-${index}`}>{key}</GhcKeyHint>
      ))}
    </span>
  );
}

export function GhcButtonLabel({
  shortcut,
  children,
}: {
  shortcut?: ReactNode | string[];
  children: ReactNode;
}) {
  const shortcutNode =
    shortcut == null ? null : Array.isArray(shortcut) ? (
      <GhcShortcutChord keys={shortcut} />
    ) : typeof shortcut === "string" ? (
      <GhcKeyHint>{shortcut}</GhcKeyHint>
    ) : (
      shortcut
    );

  return (
    <span className="inline-flex items-center gap-2">
      {shortcutNode}
      <span>{children}</span>
    </span>
  );
}

export function HeliosProbeAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-red-500/70 bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#0a0a0a]">
        <span className="font-serif text-3xl text-neutral-200">H</span>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_32px_rgba(239,68,68,0.35)]" />
    </div>
  );
}

export function LearnerThoughtAvatar({ initial }: { initial: string }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-gradient-to-br from-white/10 via-neutral-800 to-neutral-900 ring-2 ring-white/40 ring-offset-2 ring-offset-[#0a0a0a]">
        <span className="font-serif text-3xl text-neutral-100">{initial}</span>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_32px_rgba(255,255,255,0.22)]" />
    </div>
  );
}

const ILE_DIALOGUE_TEXT_CLASS =
  "text-base leading-relaxed md:text-lg md:leading-relaxed [text-shadow:0_1px_16px_rgb(0_0_0/0.92),0_0_2px_rgb(0_0_0/0.85)]";

const GHL_DIALOGUE_TEXT_CLASS = "text-base leading-relaxed md:text-lg md:leading-relaxed";

function GhcDialogueSplitIle({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
  emptyUserTurnText,
}: {
  lastUserTurn: GhcDialogueMessage | null;
  lastAssistantTurn: GhcDialogueMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
  emptyUserTurnText: string;
}) {
  const userLines = lastUserTurn ? lastUserTurn.content.split("\n").map((line) => line.trim()).filter(Boolean) : [];

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-y-6 sm:grid-cols-2 sm:grid-rows-[auto_minmax(0,1fr)] sm:gap-x-10 sm:gap-y-8">
        <div className="flex justify-center sm:row-start-1">
          <HeliosProbeAvatar />
        </div>
        <div className="mx-auto w-full max-w-lg text-center sm:row-start-2">
          {isSending ? (
            <div className="flex justify-center gap-1.5 py-1">
              <div className="size-2.5 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "0ms" }} />
              <div className="size-2.5 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "150ms" }} />
              <div className="size-2.5 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "300ms" }} />
            </div>
          ) : lastAssistantTurn ? (
            <p className={`${ILE_DIALOGUE_TEXT_CLASS} text-neutral-100`}>{lastAssistantTurn.content}</p>
          ) : (
            <p className={`${ILE_DIALOGUE_TEXT_CLASS} text-neutral-300`}>{promptText}</p>
          )}
          {error && <p className="mt-3 text-xs text-red-300 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">{error}</p>}
        </div>

        <div className="flex justify-center sm:row-start-1">
          <LearnerThoughtAvatar initial={userInitial} />
        </div>
        <div className="mx-auto w-full max-w-lg text-center sm:row-start-2">
          {userLines.length > 0 ? (
            <div className="space-y-4">
              {userLines.map((line, index) => (
                <p key={`${lastUserTurn?.id}-${index}`} className={`${ILE_DIALOGUE_TEXT_CLASS} text-neutral-50`}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className={`${ILE_DIALOGUE_TEXT_CLASS} text-neutral-300`}>{emptyUserTurnText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GhcDialogueSplitFramed({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
  emptyUserTurnText,
}: {
  lastUserTurn: GhcDialogueMessage | null;
  lastAssistantTurn: GhcDialogueMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
  emptyUserTurnText: string;
}) {
  const userLines = lastUserTurn ? lastUserTurn.content.split("\n").map((line) => line.trim()).filter(Boolean) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-neutral-900 md:flex-row md:divide-x md:divide-y-0">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-6 pt-5 text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">
          Your thought
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6">
          <div className="my-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
            <LearnerThoughtAvatar initial={userInitial} />
            {userLines.length > 0 ? (
              <div className="space-y-4">
                {userLines.map((line, index) => (
                  <p key={`${lastUserTurn?.id}-${index}`} className={`${GHL_DIALOGUE_TEXT_CLASS} text-neutral-100`}>
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className={`${GHL_DIALOGUE_TEXT_CLASS} text-neutral-500`}>{emptyUserTurnText}</p>
            )}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-6 pt-5 text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">
          Helios
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6">
          <div className="my-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
            <HeliosProbeAvatar />
            {isSending ? (
              <div className="flex justify-center gap-1.5 py-1">
                <div className="size-2.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "0ms" }} />
                <div className="size-2.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "150ms" }} />
                <div className="size-2.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: "300ms" }} />
              </div>
            ) : lastAssistantTurn ? (
              <p className={`${GHL_DIALOGUE_TEXT_CLASS} text-neutral-200`}>{lastAssistantTurn.content}</p>
            ) : (
              <p className={`${GHL_DIALOGUE_TEXT_CLASS} text-neutral-500`}>{promptText}</p>
            )}
          </div>
        </div>
        {error && <p className="shrink-0 px-6 pb-4 text-center text-xs text-red-300">{error}</p>}
      </section>
    </div>
  );
}

export function GhcDialogueSplit({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
  emptyUserTurnText = "Send a thought to surface your latest submission here.",
  layout = "ile",
}: {
  lastUserTurn: GhcDialogueMessage | null;
  lastAssistantTurn: GhcDialogueMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
  emptyUserTurnText?: string;
  /** GHL score uses the framed two-column layout; ILE keeps the floating split grid. */
  layout?: "ile" | "ghl";
}) {
  const props = {
    lastUserTurn,
    lastAssistantTurn,
    promptText,
    isSending,
    error,
    userInitial,
    emptyUserTurnText,
  };

  if (layout === "ghl") {
    return <GhcDialogueSplitFramed {...props} />;
  }

  return <GhcDialogueSplitIle {...props} />;
}

export function GhcBackgroundLayers({
  bgImage,
  dimStrength = "strong",
}: {
  bgImage: string;
  dimStrength?: "strong" | "medium" | "light";
}) {
  const dimClass =
    dimStrength === "light"
      ? "bg-[#0a0a0a]/48"
      : dimStrength === "medium"
        ? "bg-[#0a0a0a]/72"
        : "bg-[#0a0a0a]/86";
  const gradientClass =
    dimStrength === "light"
      ? "bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.12),transparent_36%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.28),transparent_34%)]"
      : dimStrength === "medium"
        ? "bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.16),transparent_33%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.45),transparent_32%)]"
        : "bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.55),transparent_32%)]";

  return (
    <>
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      {bgImage && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
      )}
      <div className={`absolute inset-0 ${dimClass}`} />
      <div className={`absolute inset-0 ${gradientClass}`} />
    </>
  );
}