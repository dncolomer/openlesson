import { cn } from "@/lib/utils";

function stripTrailingEllipsis(message: string): string {
  return message.replace(/[.\s…]+$/u, "").trim();
}

type LoadingStatusMessageProps = {
  message: string;
  className?: string;
  size?: "sm" | "md";
  tone?: "light" | "muted" | "subtle";
};

const toneClasses = {
  light: "text-white/90",
  muted: "text-neutral-400",
  subtle: "text-neutral-500",
} as const;

const sizeClasses = {
  sm: "text-xs tracking-[3px]",
  md: "text-sm tracking-[4px] sm:text-base",
} as const;

export function LoadingStatusMessage({
  message,
  className,
  size = "md",
  tone = "light",
}: LoadingStatusMessageProps) {
  const text = stripTrailingEllipsis(message);

  return (
    <div
      className={cn("font-mono uppercase", sizeClasses[size], toneClasses[tone], className)}
      aria-live="polite"
    >
      <span className="animate-pulse">{text}</span>
      <span className="ml-2 inline-flex w-8 justify-between align-middle" aria-hidden="true">
        <span className="animate-bounce">.</span>
        <span className="animate-bounce" style={{ animationDelay: "120ms" }}>
          .
        </span>
        <span className="animate-bounce" style={{ animationDelay: "240ms" }}>
          .
        </span>
      </span>
    </div>
  );
}