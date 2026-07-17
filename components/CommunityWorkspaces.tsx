"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "../lib/i18n";

interface CommunityPlan {
  id: string;
  root_topic: string;
  remix_count: number;
}

interface CommunityPlansProps {
  user?: { id: string } | null;
}

const PAGE_SIZE = 5;

export function CommunityPlans({ user }: CommunityPlansProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<CommunityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchPlans();
  }, [page]);

  const fetchPlans = async (resetPage = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchInput) {
        params.set("search", searchInput);
      }
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(resetPage ? 0 : page * PAGE_SIZE));

      const res = await fetch(`/api/workspaces/community?${params}`);
      const data = await res.json();
      
      if (data.error) {
        console.error("API error:", data.error);
      }
      
      if (data.plans) {
        setPlans(data.plans);
      }
      if (data.total !== undefined) {
        setTotalCount(data.total);
      }
    } catch (error) {
      console.error("Error fetching community plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchPlans(true);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 pt-8 border-t border-neutral-800">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">{t('communityPlans.title')}</h3>
        <p className="text-sm text-neutral-500">
          {t('communityPlans.description')}
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('communityPlans.searchPlaceholder')}
            className="flex-1 px-4 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('common.search')}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin mx-auto" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">
          {t('communityPlans.noPlansYet')}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/workspace/${plan.id}`}
              className="block bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium text-sm">
                  {plan.root_topic}
                </h4>
                <span className="text-xs text-neutral-500">
                  {plan.remix_count === 0 ? t('communityPlans.zeroForks') : plan.remix_count === 1 ? t('communityPlans.oneFork') : `${plan.remix_count} ${t('communityPlans.forks')}`}
                </span>
              </div>

            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('dashboard.previous')}
          </button>
          <span className="text-xs text-neutral-500">
            {t('communityPlans.pageOf', { current: String(page + 1), total: String(totalPages) })}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('dashboard.next')}
          </button>
        </div>
      )}
    </div>
  );
}
