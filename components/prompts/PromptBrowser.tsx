"use client";

import { useMemo, useState } from "react";
import type { PromptInventory, PromptInventoryEntry } from "@/lib/prompt-inventory/types";

const KIND_STYLES: Record<string, string> = {
  registry: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  context: "border-teal-800/60 bg-teal-950/40 text-teal-300",
  builder: "border-violet-800/60 bg-violet-950/40 text-violet-300",
  inline: "border-blue-800/60 bg-blue-950/40 text-blue-300",
  consumer: "border-amber-800/60 bg-amber-950/40 text-amber-300",
};

const STATUS_STYLES: Record<string, string> = {
  active: "border-green-700/60 bg-green-950/40 text-green-300",
  legacy: "border-neutral-700/60 bg-neutral-900/60 text-neutral-400",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function entryTitle(entry: PromptInventoryEntry) {
  return entry.label || entry.symbol;
}

function matchesQuery(entry: PromptInventoryEntry, query: string) {
  const haystack = [
    entry.file,
    entry.symbol,
    entry.label,
    entry.description,
    entry.delegatesTo,
    entry.text,
    entry.usedBy?.join(" "),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

export function PromptBrowser({ inventory }: { inventory: PromptInventory }) {
  const [domainId, setDomainId] = useState<string>(inventory.domains[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of inventory.entries) {
      counts.set(entry.domainId, (counts.get(entry.domainId) ?? 0) + 1);
    }
    return counts;
  }, [inventory.entries]);

  const filteredEntries = useMemo(() => {
    return inventory.entries.filter((entry) => {
      if (normalizedQuery) return matchesQuery(entry, normalizedQuery);
      return entry.domainId === domainId;
    });
  }, [inventory.entries, domainId, normalizedQuery]);

  const selected =
    filteredEntries.find((e) => e.id === selectedId) ??
    (filteredEntries.length === 1 ? filteredEntries[0] : null);

  const activeDomain = inventory.domains.find((d) => d.id === domainId);

  function selectDomain(id: string) {
    setDomainId(id);
    setSelectedId(null);
    setQuery("");
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Domains</p>
          <ul className="space-y-1">
            {inventory.domains.map((domain) => {
              const count = domainCounts.get(domain.id) ?? 0;
              const active = !normalizedQuery && domainId === domain.id;
              return (
                <li key={domain.id}>
                  <button
                    type="button"
                    onClick={() => selectDomain(domain.id)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                    }`}
                  >
                    <span className="truncate pr-2">{domain.label}</span>
                    <span className="font-mono text-xs text-neutral-500">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-500">
          <p>{inventory.entry_count} prompts</p>
          <p className="mt-1">{inventory.path_count} source files</p>
          <p className="mt-1">Generated {new Date(inventory.generated_at).toLocaleString()}</p>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col gap-3 lg:max-w-sm">
        <div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Search prompts, files, symbols…"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </div>

        {!normalizedQuery && activeDomain && (
          <p className="text-xs leading-relaxed text-neutral-500">{activeDomain.description}</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/30">
          {filteredEntries.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">No prompts match.</p>
          ) : (
            <ul className="divide-y divide-neutral-800/80">
              {filteredEntries.map((entry) => {
                const isSelected = selected?.id === entry.id;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className={`w-full px-3 py-3 text-left transition-colors ${
                        isSelected ? "bg-neutral-800/80" : "hover:bg-neutral-900/60"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge label={entry.kind} className={KIND_STYLES[entry.kind] ?? KIND_STYLES.inline} />
                        {entry.status && (
                          <Badge label={entry.status} className={STATUS_STYLES[entry.status]} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-white">{entryTitle(entry)}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">{entry.file}</p>
                      {entry.symbol !== entry.label && (
                        <p className="mt-0.5 font-mono text-[11px] text-neutral-600">{entry.symbol}</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="min-h-[40vh] flex-1 rounded-lg border border-neutral-800 bg-neutral-900/30 lg:min-w-0">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-neutral-500">
            Select a prompt to view its full text.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-neutral-800 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge label={selected.kind} className={KIND_STYLES[selected.kind] ?? KIND_STYLES.inline} />
                {selected.status && (
                  <Badge label={selected.status} className={STATUS_STYLES[selected.status]} />
                )}
                {selected.charCount > 0 && (
                  <span className="text-xs text-neutral-500">{selected.charCount.toLocaleString()} chars</span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-white">{entryTitle(selected)}</h2>
              {selected.description && (
                <p className="mt-1 text-sm text-neutral-400">{selected.description}</p>
              )}
              <p className="mt-2 font-mono text-xs text-neutral-500">{selected.file}</p>
              {selected.symbol && selected.symbol !== selected.label && (
                <p className="font-mono text-xs text-neutral-600">{selected.symbol}</p>
              )}
              {selected.delegatesTo && (
                <p className="mt-2 text-xs text-amber-300/90">
                  Delegates to: <span className="font-mono">{selected.delegatesTo}</span>
                </p>
              )}
              {selected.usedBy && selected.usedBy.length > 0 && (
                <p className="mt-2 text-xs text-neutral-400">
                  Used by: <span className="font-mono text-neutral-300">{selected.usedBy.join(", ")}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => copyText(selected.text)}
                className="mt-3 rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
              >
                Copy prompt text
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-neutral-200">
              {selected.text}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}