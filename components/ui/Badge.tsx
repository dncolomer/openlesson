"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "sm",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-[var(--color-ivory)] text-[var(--color-graphite)]",
    success: "bg-[var(--color-emerald)]/10 text-[var(--color-emerald-dark)]",
    warning: "bg-[var(--color-warning)]/10 text-amber-700",
    error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
    info: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full capitalize",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Helper function to get badge variant from status
export function getStatusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "passed":
    case "completed":
    case "active":
      return "success";
    case "in_progress":
    case "evaluating":
    case "processing":
      return "warning";
    case "failed":
    case "error":
      return "error";
    case "pending":
    default:
      return "default";
  }
}
