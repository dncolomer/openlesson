"use client";

import {
  LEARNING_MODEL_SIZE_COPY,
  LEARNING_MODEL_SIZES,
  parseLearningModelSize,
  type LearningModelSize,
} from "@/lib/learning-model";

export function LearningModelSizePicker({
  value,
  onChange,
  disabled = false,
  name = "learning-model-size",
}: {
  value: LearningModelSize;
  onChange: (size: LearningModelSize) => void;
  disabled?: boolean;
  name?: string;
}) {
  const current = parseLearningModelSize(value);
  return (
    <fieldset
      className="min-w-0"
      data-learning-model-size-picker
      disabled={disabled}
    >
      <legend className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        Learning model
      </legend>
      <p className="mt-1 text-sm text-neutral-400">
        How many actions the policy may take from a hidden state. 4 is Forage,
        Exploit, Avoid, Infer.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {LEARNING_MODEL_SIZES.map((size) => {
          const copy = LEARNING_MODEL_SIZE_COPY[size];
          const selected = current === size;
          return (
            <label
              key={size}
              data-learning-model-size={size}
              data-selected={selected ? "true" : undefined}
              className={`cursor-pointer border px-3 py-3 text-left ${
                selected
                  ? "border-white bg-neutral-900 text-white"
                  : "border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-400"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={size}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(size)}
                className="sr-only"
              />
              <span className="block font-mono text-[11px] uppercase tracking-[0.14em]">
                {copy.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-400">
                {copy.body}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
