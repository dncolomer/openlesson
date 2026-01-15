"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-charcoal)] mb-2"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "w-full px-4 py-3 text-base bg-white border-[1.5px] border-[var(--color-sand)] rounded-lg transition-all duration-200",
            "placeholder:text-[var(--color-pebble)]",
            "focus:outline-none focus:border-[var(--color-indigo)] focus:ring-2 focus:ring-[var(--color-indigo)]/20",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-ivory)]",
            error && "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && !error && (
          <p className="mt-2 text-sm text-[var(--color-stone)]">{helperText}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

// Textarea component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-charcoal)] mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          className={cn(
            "w-full px-4 py-3 text-base bg-white border-[1.5px] border-[var(--color-sand)] rounded-lg transition-all duration-200 resize-y min-h-[120px]",
            "placeholder:text-[var(--color-pebble)]",
            "focus:outline-none focus:border-[var(--color-indigo)] focus:ring-2 focus:ring-[var(--color-indigo)]/20",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-ivory)]",
            error && "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && !error && (
          <p className="mt-2 text-sm text-[var(--color-stone)]">{helperText}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
