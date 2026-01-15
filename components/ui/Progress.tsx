"use client";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning";
}

export function Progress({
  className,
  value,
  max = 100,
  showLabel = false,
  size = "md",
  variant = "default",
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const variants = {
    default: "bg-[var(--color-indigo)]",
    success: "bg-[var(--color-emerald)]",
    warning: "bg-[var(--color-warning)]",
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-[var(--color-charcoal)]">
            Progress
          </span>
          <span className="text-sm text-[var(--color-stone)]">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full bg-[var(--color-sand)] rounded-full overflow-hidden",
          sizes[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            variants[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Challenge progress component
interface ChallengeProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export function ChallengeProgress({
  completed,
  total,
  className,
}: ChallengeProgressProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Progress value={completed} max={total} size="sm" className="flex-1" />
      <span className="text-sm font-medium text-[var(--color-stone)] whitespace-nowrap">
        {completed}/{total} challenges
      </span>
    </div>
  );
}
