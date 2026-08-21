"use client";

import { useEffect, useState } from "react";
import {
  AYCL_FULL_PRICE_CENTS,
  AYCL_LEARNER_PRICE_CENTS,
  formatAyclPriceCentsLabel,
} from "@/lib/aycl-shared";
import {
  AYCL_SUGGESTED_CATEGORIES,
  centsToDollarsInput,
  dollarsInputToCents,
} from "@/lib/aycl-marketplace";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceAyclMarketplaceSettingsProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  onPlanUpdate: (plan: Workspace) => void;
}

/**
 * Admin AYCL / marketplace listing settings: enable catalog listing +
 * category, summary, author, and dual prices.
 */
export function WorkspaceAyclMarketplaceSettings({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceAyclMarketplaceSettingsProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const [enabled, setEnabled] = useState(Boolean(plan.is_all_you_can_learn));
  const [category, setCategory] = useState(plan.aycl_category || "");
  const [summary, setSummary] = useState(plan.aycl_summary || "");
  const [authorName, setAuthorName] = useState(plan.aycl_author_name || "");
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState(
    plan.aycl_author_avatar_url || "",
  );
  const [learnerDollars, setLearnerDollars] = useState(
    centsToDollarsInput(plan.aycl_learner_price_cents),
  );
  const [fullDollars, setFullDollars] = useState(
    centsToDollarsInput(plan.aycl_full_price_cents),
  );

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/me/status")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [isOwner]);

  useEffect(() => {
    setEnabled(Boolean(plan.is_all_you_can_learn));
    setCategory(plan.aycl_category || "");
    setSummary(plan.aycl_summary || "");
    setAuthorName(plan.aycl_author_name || "");
    setAuthorAvatarUrl(plan.aycl_author_avatar_url || "");
    setLearnerDollars(centsToDollarsInput(plan.aycl_learner_price_cents));
    setFullDollars(centsToDollarsInput(plan.aycl_full_price_cents));
  }, [
    plan.is_all_you_can_learn,
    plan.aycl_category,
    plan.aycl_summary,
    plan.aycl_author_name,
    plan.aycl_author_avatar_url,
    plan.aycl_learner_price_cents,
    plan.aycl_full_price_cents,
  ]);

  if (!isOwner) return null;

  if (!isAdmin) {
    return (
      <section
        className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
        data-settings-section="aycl-marketplace"
        data-workspace-aycl-marketplace-settings
      >
        <h2 className="text-sm font-medium text-white">AYCL marketplace</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Admin access is required to list this workspace on All-You-Can-Learn.
        </p>
      </section>
    );
  }

  const defaultLearnerLabel = formatAyclPriceCentsLabel(AYCL_LEARNER_PRICE_CENTS);
  const defaultFullLabel = formatAyclPriceCentsLabel(AYCL_FULL_PRICE_CENTS);

  const save = async () => {
    setBusy(true);
    setError("");
    setSavedFlash(false);
    try {
      let learnerCents: number | null = null;
      let fullCents: number | null = null;
      if (learnerDollars.trim()) {
        learnerCents = dollarsInputToCents(learnerDollars);
        if (learnerCents === null) {
          throw new Error("Practice price must be a valid dollar amount (or empty for default).");
        }
      }
      if (fullDollars.trim()) {
        fullCents = dollarsInputToCents(fullDollars);
        if (fullCents === null) {
          throw new Error("Full price must be a valid dollar amount (or empty for default).");
        }
      }

      const res = await fetch(`/api/workspaces/${workspaceId}/aycl`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_all_you_can_learn: enabled,
          aycl_category: category.trim() || null,
          aycl_summary: summary.trim() || null,
          aycl_author_name: authorName.trim() || null,
          aycl_author_avatar_url: authorAvatarUrl.trim() || null,
          aycl_learner_price_cents: learnerCents,
          aycl_full_price_cents: fullCents,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save AYCL listing");
      }

      onPlanUpdate({
        ...plan,
        is_all_you_can_learn: Boolean(
          data.listing?.is_all_you_can_learn ?? enabled,
        ),
        aycl_category: data.listing?.aycl_category ?? (category.trim() || null),
        aycl_summary: data.listing?.aycl_summary ?? (summary.trim() || null),
        aycl_author_name:
          data.listing?.aycl_author_name ?? (authorName.trim() || null),
        aycl_author_avatar_url:
          data.listing?.aycl_author_avatar_url ??
          (authorAvatarUrl.trim() || null),
        aycl_learner_price_cents:
          data.listing?.aycl_learner_price_cents ?? learnerCents,
        aycl_full_price_cents:
          data.listing?.aycl_full_price_cents ?? fullCents,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="aycl-marketplace"
      data-workspace-aycl-marketplace-settings
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-white">AYCL marketplace</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          List this workspace on All-You-Can-Learn and set marketplace fields:
          category, summary, author, and prices.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 rounded-none border border-white/10 bg-white/5 px-3 py-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-aycl-listing-enabled
            className="h-4 w-4 rounded-none border-neutral-600 bg-neutral-900 text-neutral-300 focus:ring-neutral-600/40"
          />
          <span className="text-sm text-neutral-200">
            Enable Paid (AYCL) — show on marketplace catalog
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Category
            </span>
            <input
              type="text"
              list="aycl-category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Engineering"
              data-aycl-listing-category
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
            <datalist id="aycl-category-suggestions">
              {AYCL_SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Author name
            </span>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Instructor or studio name"
              data-aycl-listing-author-name
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Author avatar URL
          </span>
          <input
            type="url"
            value={authorAvatarUrl}
            onChange={(e) => setAuthorAvatarUrl(e.target.value)}
            placeholder="https://… or /path/to/avatar.jpg"
            data-aycl-listing-author-avatar
            className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Summary / description
          </span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Marketplace blurb shown on the catalog card and landing"
            data-aycl-listing-summary
            className="w-full resize-y rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Practice price (USD)
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={learnerDollars}
                onChange={(e) => setLearnerDollars(e.target.value)}
                placeholder={defaultLearnerLabel.replace("$", "")}
                data-aycl-listing-learner-price
                className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 py-2 pl-7 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              Empty → default {defaultLearnerLabel}
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Full price (USD)
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={fullDollars}
                onChange={(e) => setFullDollars(e.target.value)}
                placeholder={defaultFullLabel.replace("$", "")}
                data-aycl-listing-full-price
                className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 py-2 pl-7 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              Empty → default {defaultFullLabel}
            </p>
          </label>
        </div>

        {error ? (
          <p className="text-sm text-red-400" data-aycl-listing-error>
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            data-aycl-listing-save
            className="rounded-none bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save marketplace listing"}
          </button>
          {savedFlash ? (
            <span className="text-sm text-green-400" data-aycl-listing-saved>
              Saved
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
