"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const THOUGHT_BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

export interface DialogueMessage {
  id: string;
  content: string;
}

type ThoughtButtonSize = "sm" | "md" | "lg";
type ThoughtButtonVariant = "ghost" | "primary" | "toggleOn" | "toggleOff";

export function thoughtButtonClasses({
  size = "md",
  variant = "ghost",
  className = "",
}: {
  size?: ThoughtButtonSize;
  variant?: ThoughtButtonVariant;
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

export function ThoughtButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ThoughtButtonSize;
  variant?: ThoughtButtonVariant;
}) {
  return <button className={thoughtButtonClasses({ size, variant, className })} {...props} />;
}

export function ThoughtKeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center justify-center rounded border border-neutral-600 bg-black/55 px-1.5 font-mono text-[10px] font-medium leading-none text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </span>
  );
}

export function ThoughtShortcutChord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, index) => (
        <ThoughtKeyHint key={`${key}-${index}`}>{key}</ThoughtKeyHint>
      ))}
    </span>
  );
}

export const thoughtSelectionBarClass =
  "rounded-md border border-white/25 bg-white/5";

export const thoughtSelectionBarTextClass = "text-[11px] text-neutral-100";

export const thoughtSelectionActionClass =
  "text-[11px] text-neutral-200 underline underline-offset-2 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function thoughtSelectionCardClass(isSelected: boolean, baseClass = "") {
  return cn(
    baseClass,
    isSelected && "border-l-2 border-l-white/80 bg-white/5 pl-2",
  );
}

export function thoughtSelectionChipClass(isSelected: boolean) {
  return cn(
    "flex w-full min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed transition-all active:scale-[0.99]",
    isSelected
      ? "border-white/60 bg-white/10 text-white"
      : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-white/35 hover:bg-white/5 hover:text-white",
  );
}

export function ThoughtCompactAction({
  shortcut,
  label,
  disabled,
  onClick,
}: {
  shortcut: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ThoughtButton
      size="sm"
      disabled={disabled}
      onClick={onClick}
      title={`${label} (${shortcut})`}
      aria-label={`${label} (${shortcut})`}
      className="h-7 min-w-7 px-1"
    >
      <ThoughtKeyHint>{shortcut}</ThoughtKeyHint>
    </ThoughtButton>
  );
}

export function ThoughtButtonLabel({
  shortcut,
  children,
}: {
  shortcut?: ReactNode | string[];
  children: ReactNode;
}) {
  const shortcutNode =
    shortcut == null ? null : Array.isArray(shortcut) ? (
      <ThoughtShortcutChord keys={shortcut} />
    ) : typeof shortcut === "string" ? (
      <ThoughtKeyHint>{shortcut}</ThoughtKeyHint>
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

function dialogueAvatarClasses(isActiveTurn: boolean) {
  return cn(
    "grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border bg-gradient-to-br via-neutral-800 to-neutral-900 ring-2 ring-offset-2 ring-offset-[#0a0a0a]",
    isActiveTurn
      ? "animate-dialogue-turn-pulse border-red-500/70 from-amber-500/15 ring-red-500/40"
      : "border-white/70 from-white/10 ring-white/40",
  );
}

function dialogueAvatarGlowClass(isActiveTurn: boolean) {
  return isActiveTurn
    ? "pointer-events-none absolute inset-0 rounded-full shadow-[0_0_32px_rgba(239,68,68,0.35)]"
    : "pointer-events-none absolute inset-0 rounded-full shadow-[0_0_32px_rgba(255,255,255,0.22)]";
}

function dialogueBubbleClasses(isActiveTurn: boolean, cornerClass: string) {
  return cn(
    "rounded-2xl border px-4 py-3 backdrop-blur-sm",
    cornerClass,
    isActiveTurn
      ? "animate-dialogue-turn-pulse border-red-500/70 bg-neutral-950/55"
      : "border-white/50 bg-neutral-950/55",
  );
}

export function HeliosProbeAvatar({ isActiveTurn = false }: { isActiveTurn?: boolean }) {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <div className={dialogueAvatarClasses(isActiveTurn)}>
        <span className="font-serif text-3xl leading-none text-neutral-200">H</span>
      </div>
      <div className={dialogueAvatarGlowClass(isActiveTurn)} />
    </div>
  );
}

export function LearnerThoughtAvatar({
  initial,
  isActiveTurn = false,
}: {
  initial: string;
  isActiveTurn?: boolean;
}) {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <div className={dialogueAvatarClasses(isActiveTurn)}>
        <span className="font-serif text-3xl leading-none text-neutral-100">{initial}</span>
      </div>
      <div className={dialogueAvatarGlowClass(isActiveTurn)} />
    </div>
  );
}

const ILE_DIALOGUE_TEXT_CLASS =
  "break-words text-base leading-relaxed md:text-lg md:leading-relaxed [text-shadow:0_1px_16px_rgb(0_0_0/0.92),0_0_2px_rgb(0_0_0/0.85)]";

const TAP_DIALOGUE_TEXT_CLASS = "break-words text-base leading-relaxed md:text-lg md:leading-relaxed";

function DialogueSplitComic({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
  emptyUserTurnText,
  variant = "ile",
}: {
  lastUserTurn: DialogueMessage | null;
  lastAssistantTurn: DialogueMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
  emptyUserTurnText: string;
  variant?: "ile" | "tap";
}) {
  const userLines = lastUserTurn ? lastUserTurn.content.split("\n").map((line) => line.trim()).filter(Boolean) : [];
  const isHeliosTurn = isSending;
  const isLearnerTurn = !isSending;
  // Show the learner bubble only while Helios is responding; clear it when the turn returns to the user.
  const hasUserBubble = isSending && (userLines.length > 0 || !!emptyUserTurnText);
  const textClass = variant === "ile" ? ILE_DIALOGUE_TEXT_CLASS : TAP_DIALOGUE_TEXT_CLASS;
  const heliosPromptClass = variant === "ile" ? "text-neutral-300" : "text-neutral-500";
  const heliosReplyClass = variant === "ile" ? "text-neutral-100" : "text-neutral-200";
  const userReplyClass = variant === "ile" ? "text-neutral-50" : "text-neutral-100";
  const userEmptyClass = variant === "ile" ? "text-neutral-400" : "text-neutral-500";
  const pendingDotClass = variant === "ile" ? "bg-neutral-300" : "bg-neutral-500";
  const errorClass =
    variant === "ile"
      ? "mt-3 text-left text-xs text-red-300 [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]"
      : "mt-3 text-left text-xs text-red-300";

  return (
    <div className="flex min-h-full min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
      {/* Helios — centered vertically in the top half */}
      <div className="flex min-h-0 flex-1 items-center">
        <div className="flex w-full max-w-[min(100%,34rem)] items-center gap-3 sm:gap-4">
          <HeliosProbeAvatar isActiveTurn={isHeliosTurn} />
          <div className="min-w-0 flex-1">
            <div className={dialogueBubbleClasses(isHeliosTurn, "rounded-tl-md")}>
              {isSending ? (
                <div className="flex gap-1.5 py-1">
                  <div className={`size-2.5 animate-bounce rounded-full ${pendingDotClass}`} style={{ animationDelay: "0ms" }} />
                  <div className={`size-2.5 animate-bounce rounded-full ${pendingDotClass}`} style={{ animationDelay: "150ms" }} />
                  <div className={`size-2.5 animate-bounce rounded-full ${pendingDotClass}`} style={{ animationDelay: "300ms" }} />
                </div>
              ) : lastAssistantTurn ? (
                <p className={`${textClass} text-left ${heliosReplyClass}`}>{lastAssistantTurn.content}</p>
              ) : (
                <p className={`${textClass} text-left ${heliosPromptClass}`}>{promptText}</p>
              )}
              {error && <p className={errorClass}>{error}</p>}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mx-8 h-px shrink-0 bg-gradient-to-r from-transparent via-neutral-700/45 to-transparent sm:mx-12"
        role="separator"
        aria-hidden
      />

      {/* Learner — centered vertically in the bottom half */}
      <div className="flex min-h-0 flex-1 items-center justify-end">
        <div
          className={cn(
            "flex w-full max-w-[min(100%,34rem)] items-center gap-3 sm:gap-4",
            !hasUserBubble && "justify-end",
          )}
        >
          {hasUserBubble ? (
            <div className="min-w-0 flex-1">
              <div className={dialogueBubbleClasses(isLearnerTurn, "rounded-br-md bg-black/55")}>
                {userLines.length > 0 ? (
                  <div className="space-y-3">
                    {userLines.map((line, index) => (
                      <p key={`${lastUserTurn?.id}-${index}`} className={`${textClass} text-right ${userReplyClass}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className={`${textClass} text-right ${userEmptyClass}`}>{emptyUserTurnText}</p>
                )}
              </div>
            </div>
          ) : null}
          <LearnerThoughtAvatar initial={userInitial} isActiveTurn={isLearnerTurn} />
        </div>
      </div>
    </div>
  );
}

function DialogueSplitIle(
  props: Omit<Parameters<typeof DialogueSplitComic>[0], "variant">,
) {
  return <DialogueSplitComic {...props} variant="ile" />;
}

function DialogueSplitFramed(
  props: Omit<Parameters<typeof DialogueSplitComic>[0], "variant">,
) {
  return <DialogueSplitComic {...props} variant="tap" />;
}

export function DialogueSplit({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
  emptyUserTurnText = "",
  layout = "ile",
}: {
  lastUserTurn: DialogueMessage | null;
  lastAssistantTurn: DialogueMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
  emptyUserTurnText?: string;
  /** TAP evaluation uses the same comic layout with panel-friendly typography. */
  layout?: "ile" | "tap";
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

  if (layout === "tap") {
    return <DialogueSplitFramed {...props} />;
  }

  return <DialogueSplitIle {...props} />;
}

export function ThoughtBackgroundLayers({
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