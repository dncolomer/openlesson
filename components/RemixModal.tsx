"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "../lib/i18n";

interface CommunityPlan {
  id: string;
  root_topic: string;
  remix_count: number;
}

interface RemixModalProps {
  plan: CommunityPlan;
  onClose: () => void;
  onComplete: (workspaceId: string) => void;
}

export function RemixModal({ plan, onClose, onComplete }: RemixModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [exactCopy, setExactCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleRemix = async () => {
    if (!title.trim()) {
      setError(t('remixModal.titleRequired'));
      return;
    }
    if (!exactCopy && !prompt.trim()) {
      setError(t('remixModal.promptRequired'));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/workspaces/${plan.id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remixPrompt: prompt, title: title.trim(), exactCopy }),
      });
      const data = await res.json();

      if (data.success) {
        onComplete(data.workspaceId);
      } else {
        setError(data.error || t('remixModal.remixFailed'));
      }
    } catch (err) {
      console.error("Error remixing plan:", err);
      setError(t('remixModal.remixFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('remixModal.remixTitle', { topic: plan.root_topic })}</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-neutral-400 mb-2">
            {t('remixModal.giveTitle')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('remixModal.topicPlaceholder')}
            className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-neutral-400 mb-2">
            {t('remixModal.howAdapt')}
          </label>
          <label className="flex items-start gap-3 mb-3 rounded-xl border border-neutral-800 bg-neutral-800/30 p-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={exactCopy}
              onChange={(e) => setExactCopy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-blue-600 focus:ring-blue-600"
            />
            <span>{t('remixModal.exactCopy')}</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('remixModal.modificationsPlaceholder')}
            disabled={exactCopy}
            rows={4}
            className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-600 resize-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleRemix}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('remixModal.remixing')}
              </>
            ) : (
              t('remixModal.remixPlan')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
