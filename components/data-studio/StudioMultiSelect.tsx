"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  pruneStudioSelectedIds,
  studioMultiSelectSummary,
  studioOptionMatchesQuery,
  toggleStudioSelectedId,
  uniqueStudioIds,
  type StudioSelectOption,
} from "@/lib/data-studio-view";

export function StudioMultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  plural,
  searchPlaceholder = "Search",
  marker,
  compact = false,
}: {
  label: string;
  options: readonly StudioSelectOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  emptyLabel: string;
  plural: string;
  searchPlaceholder?: string;
  marker: string;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const availableIds = useMemo(() => options.map((option) => option.id), [options]);
  const chosen = useMemo(
    () => pruneStudioSelectedIds(selected, availableIds),
    [availableIds, selected],
  );
  const visible = useMemo(
    () => options.filter((option) => studioOptionMatchesQuery(option, query)),
    [options, query],
  );
  const summary = studioMultiSelectSummary(chosen, options, emptyLabel, plural);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(ids: string[]) {
    onChange(uniqueStudioIds(ids));
  }

  return (
    <div
      ref={rootRef}
      className={compact ? "relative flex items-center gap-1.5" : "relative"}
    >
      <p className={compact ? "mb-0 text-[11px] text-neutral-400" : "mb-0.5 text-[11px] text-neutral-400"}>
        {label}
      </p>
      <button
        type="button"
        className={
          compact
            ? "flex min-w-[8.5rem] max-w-[14rem] items-center justify-between gap-2 rounded-none border border-white/20 bg-black px-2 py-1 text-left font-mono text-[11px] text-white outline-none hover:border-white/50 focus:border-white/60"
            : "flex min-w-[11rem] max-w-[18rem] items-center justify-between gap-2 rounded-none border border-white/20 bg-black px-2 py-1 text-left font-mono text-[11px] text-white outline-none hover:border-white/50 focus:border-white/60"
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        data-data-studio-select={marker}
        {...{ [marker]: chosen.join(",") }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{summary}</span>
        <span className="text-neutral-500">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div
          className="absolute left-0 z-20 mt-1 w-[18rem] border border-white/20 bg-black shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
          data-data-studio-select-menu={marker}
        >
          <div className="border-b border-white/15 p-1.5">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-none border border-white/20 bg-black px-2 py-1 font-mono text-[11px] text-white outline-none placeholder:text-neutral-600 focus:border-white/60"
              data-data-studio-select-search={marker}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1 text-[10px] text-neutral-500">
            <button
              type="button"
              className="hover:text-white"
              onClick={() =>
                commit(uniqueStudioIds([...chosen, ...visible.map((option) => option.id)]))
              }
              data-data-studio-select-all={marker}
            >
              Select visible
            </button>
            <button
              type="button"
              className="hover:text-white"
              onClick={() => commit([])}
              data-data-studio-select-clear={marker}
            >
              Clear
            </button>
          </div>
          <ul
            className="max-h-56 overflow-y-auto py-1"
            role="listbox"
            aria-multiselectable="true"
            data-data-studio-select-options={marker}
          >
            {visible.length === 0 ? (
              <li className="px-2 py-1.5 text-[11px] text-neutral-500">No matches</li>
            ) : (
              visible.map((option) => {
                const checked = chosen.includes(option.id);
                return (
                  <li key={option.id}>
                    <label
                      className="flex cursor-pointer items-start gap-2 px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
                      data-data-studio-select-option={option.id}
                      data-data-studio-select-checked={checked ? "true" : "false"}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-white"
                        checked={checked}
                        onChange={() => commit(toggleStudioSelectedId(chosen, option.id))}
                      />
                      <span className="min-w-0 leading-snug">
                        <span className="block truncate font-mono">{option.label}</span>
                        {option.keywords ? (
                          <span className="block truncate text-[10px] text-neutral-500">
                            {option.keywords}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
