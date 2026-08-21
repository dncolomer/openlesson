"use client";

import { useCallback, useEffect, useState } from "react";
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

type ComplimentaryLinkRow = {
  id: string;
  access_tier: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  status: string;
  created_at: string;
  url: string;
};

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

  const [compLinks, setCompLinks] = useState<ComplimentaryLinkRow[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState("");
  const [playMaxUses, setPlayMaxUses] = useState("");
  const [playExpiresAt, setPlayExpiresAt] = useState("");
  const [fullMaxUses, setFullMaxUses] = useState("");
  const [fullExpiresAt, setFullExpiresAt] = useState("");
  const [creatingTier, setCreatingTier] = useState<"learner" | "full" | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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

  const loadComplimentaryLinks = useCallback(async () => {
    setCompLoading(true);
    setCompError("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/aycl/complimentary`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load complimentary URLs");
      }
      setCompLinks(Array.isArray(data.links) ? data.links : []);
    } catch (err) {
      setCompError(err instanceof Error ? err.message : "Failed to load complimentary URLs");
    } finally {
      setCompLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!isOwner) return;
    void loadComplimentaryLinks();
  }, [isOwner, loadComplimentaryLinks]);

  if (!isOwner) return null;

  const createComplimentary = async (tier: "learner" | "full") => {
    setCreatingTier(tier);
    setCompError("");
    try {
      const maxUsesRaw = tier === "learner" ? playMaxUses : fullMaxUses;
      const expiresRaw = tier === "learner" ? playExpiresAt : fullExpiresAt;
      const body: Record<string, unknown> = { access_tier: tier };
      if (maxUsesRaw.trim()) body.max_uses = Number(maxUsesRaw.trim());
      if (expiresRaw.trim()) {
        const ms = Date.parse(expiresRaw);
        if (!Number.isFinite(ms)) {
          throw new Error("Expiration must be a valid date and time");
        }
        body.expires_at = new Date(ms).toISOString();
      }
      const res = await fetch(`/api/workspaces/${workspaceId}/aycl/complimentary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.link) {
        throw new Error(data.error || "Failed to create complimentary URL");
      }
      setCompLinks((prev) => [data.link as ComplimentaryLinkRow, ...prev]);
      if (tier === "learner") {
        setPlayMaxUses("");
        setPlayExpiresAt("");
      } else {
        setFullMaxUses("");
        setFullExpiresAt("");
      }
    } catch (err) {
      setCompError(err instanceof Error ? err.message : "Failed to create complimentary URL");
    } finally {
      setCreatingTier(null);
    }
  };

  const copyLink = async (link: ComplimentaryLinkRow) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedLinkId(link.id);
      window.setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      setCompError("Could not copy URL");
    }
  };

  const revokeLink = async (linkId: string) => {
    setRevokingId(linkId);
    setCompError("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/aycl/complimentary`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke URL");
      }
      setCompLinks((prev) =>
        prev.map((row) => (row.id === linkId ? { ...row, ...data.link } : row)),
      );
    } catch (err) {
      setCompError(err instanceof Error ? err.message : "Failed to revoke URL");
    } finally {
      setRevokingId(null);
    }
  };

  const complimentarySection = (
    <section
      className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="aycl-complimentary"
      data-aycl-complimentary-links
    >
      <h2 className="text-sm font-medium text-white">Complimentary AYCL URLs</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-400">
        Create a free special URL for play mode (practice only) or full mode (Play + Build).
        Optionally cap how many times it can be redeemed and/or when it expires. Recipients get
        the course without paying.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div
          className="space-y-3 rounded-none border border-white/10 bg-white/5 p-3"
          data-aycl-complimentary-create-play
        >
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
            Play mode
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">
              Usage cap (empty = unlimited)
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={playMaxUses}
              onChange={(e) => setPlayMaxUses(e.target.value)}
              placeholder="Unlimited"
              data-aycl-complimentary-play-max-uses
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">
              Time expiration (empty = none)
            </span>
            <input
              type="datetime-local"
              value={playExpiresAt}
              onChange={(e) => setPlayExpiresAt(e.target.value)}
              data-aycl-complimentary-play-expires-at
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void createComplimentary("learner")}
            disabled={creatingTier !== null}
            data-aycl-complimentary-create-play-submit
            className="rounded-none bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {creatingTier === "learner" ? "Creating…" : "Create play URL"}
          </button>
        </div>

        <div
          className="space-y-3 rounded-none border border-white/10 bg-white/5 p-3"
          data-aycl-complimentary-create-full
        >
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
            Full mode
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">
              Usage cap (empty = unlimited)
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={fullMaxUses}
              onChange={(e) => setFullMaxUses(e.target.value)}
              placeholder="Unlimited"
              data-aycl-complimentary-full-max-uses
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">
              Time expiration (empty = none)
            </span>
            <input
              type="datetime-local"
              value={fullExpiresAt}
              onChange={(e) => setFullExpiresAt(e.target.value)}
              data-aycl-complimentary-full-expires-at
              className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void createComplimentary("full")}
            disabled={creatingTier !== null}
            data-aycl-complimentary-create-full-submit
            className="rounded-none bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {creatingTier === "full" ? "Creating…" : "Create full URL"}
          </button>
        </div>
      </div>

      {compError ? (
        <p className="mt-3 text-sm text-red-400" data-aycl-complimentary-error>
          {compError}
        </p>
      ) : null}

      <div className="mt-5 space-y-2" data-aycl-complimentary-link-list>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Existing URLs
        </p>
        {compLoading && compLinks.length === 0 ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : null}
        {compLinks.length === 0 && !compLoading ? (
          <p className="text-sm text-neutral-500">No complimentary URLs yet.</p>
        ) : null}
        {compLinks.map((link) => (
          <div
            key={link.id}
            className="flex flex-col gap-2 rounded-none border border-neutral-800 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-aycl-complimentary-link
            data-aycl-complimentary-link-tier={link.access_tier}
            data-aycl-complimentary-link-status={link.status}
          >
            <div className="min-w-0">
              <p className="text-sm text-neutral-200">
                {link.access_tier === "full" ? "Full (Play + Build)" : "Play mode"}
                {link.status !== "active" ? (
                  <span className="ml-2 text-xs uppercase text-neutral-500">{link.status}</span>
                ) : null}
              </p>
              <p className="mt-1 truncate font-mono text-[11px] text-neutral-500" title={link.url}>
                {link.url}
              </p>
              <p className="mt-1 text-[11px] text-neutral-600">
                Uses {link.use_count}
                {link.max_uses != null ? ` / ${link.max_uses}` : " · unlimited"}
                {link.expires_at
                  ? ` · expires ${new Date(link.expires_at).toLocaleString()}`
                  : " · no expiration"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink(link)}
                data-aycl-complimentary-copy
                className="rounded-none border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                {copiedLinkId === link.id ? "Copied" : "Copy URL"}
              </button>
              {link.status === "active" ? (
                <button
                  type="button"
                  onClick={() => void revokeLink(link.id)}
                  disabled={revokingId === link.id}
                  data-aycl-complimentary-revoke
                  className="rounded-none border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-50"
                >
                  {revokingId === link.id ? "Revoking…" : "Revoke"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  if (!isAdmin) {
    return (
      <div className="space-y-4" data-workspace-aycl-marketplace-settings>
        <section
          className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
          data-settings-section="aycl-marketplace"
        >
          <h2 className="text-sm font-medium text-white">AYCL marketplace</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Admin access is required to list this workspace on All-You-Can-Learn.
          </p>
        </section>
        {complimentarySection}
      </div>
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
    <div className="space-y-4" data-workspace-aycl-marketplace-settings>
    <section
      className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="aycl-marketplace"
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
    {complimentarySection}
    </div>
  );
}
