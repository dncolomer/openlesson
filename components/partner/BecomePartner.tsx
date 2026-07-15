"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PARTNER_TIERS, PartnerTier } from "@/lib/partners";
import { Crown, Users, DollarSign, ArrowRight, X, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BecomePartnerProps {
  onClose?: () => void;
}

export function BecomePartner({ onClose }: BecomePartnerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [showStakeForm, setShowStakeForm] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PartnerTier | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [staking, setStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStake = async () => {
    if (!selectedTier) return;
    
    setStaking(true);
    setError(null);

    try {
      const res = await fetch("/api/partners/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stakeAmount: PARTNER_TIERS[selectedTier].stakeAmount,
          walletAddress: walletAddress,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/dashboard/partner");
      } else {
        setError(data.error || t('partner.failedToBecomePartner'));
      }
    } catch (err) {
      setError(t('partner.errorOccurred'));
    } finally {
      setStaking(false);
    }
  };

  if (showStakeForm) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">{t('partner.becomePartner')}</h3>
          {onClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-4 mb-6">
          {(["bronze", "silver", "gold"] as PartnerTier[]).map((tier) => {
            const info = PARTNER_TIERS[tier];
            const isSelected = selectedTier === tier;
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-neutral-700 hover:border-neutral-600 bg-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white capitalize">{t(`partner.tier_${tier}`)} {t('partner.partnerLabel')}</div>
                    <div className="text-sm text-neutral-400">{info.stakeAmount / 1_000_000}M $UNSYS</div>
                  </div>
                  <div className="text-emerald-400 font-medium">{info.revenueShare * 100}% {t('partner.revenueLabel')}</div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedTier && (
          <div className="mb-6">
            <label className="block text-sm text-neutral-400 mb-2">
              {t('partner.walletLabel')}
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder={t('partner.walletPlaceholder')}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500"
            />
            <p className="text-xs text-neutral-500 mt-2">
              {t('partner.mockVerificationNote')}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowStakeForm(false)}
            className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
          >
            {t('common.back')}
          </button>
          <button
            onClick={handleStake}
            disabled={!selectedTier || staking}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {staking ? t('partner.processing') : t('partner.stakeAndBecomePartner')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{t('partner.becomeUncertainSystemsPartner')}</h3>
            <p className="text-sm text-neutral-400">{t('partner.earnRevenue')}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {(["bronze", "silver", "gold"] as PartnerTier[]).map((tier) => {
          const info = PARTNER_TIERS[tier];
          return (
            <div
              key={tier}
              className={`p-4 rounded-lg border ${
                tier === "gold"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : tier === "silver"
                  ? "border-slate-500/30 bg-slate-500/5"
                  : "border-amber-700/30 bg-amber-700/5"
              }`}
            >
              <div className="text-sm font-medium text-white capitalize mb-1">{t(`partner.tier_${tier}`)}</div>
              <div className="text-xs text-neutral-400 mb-2">{info.stakeAmount / 1_000_000}M $UNSYS</div>
              <div className="text-lg font-bold text-emerald-400">{info.revenueShare * 100}%</div>
              <div className="text-xs text-neutral-500">{t('partner.revenueShareLabel')}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-neutral-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-emerald-400 mt-0.5" />
          <div>
            <div className="font-medium text-white">{t('partner.howItWorks')}</div>
            <ul className="text-sm text-neutral-400 mt-1 space-y-1">
              <li>• {t('partner.howStep1')}</li>
              <li>• {t('partner.howStep2')}</li>
              <li>• {t('partner.howStep3', { min: String(PARTNER_TIERS.bronze.revenueShare * 100), max: String(PARTNER_TIERS.gold.revenueShare * 100) })}</li>
              <li>• {t('partner.howStep4')}</li>
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowStakeForm(true)}
        className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 flex items-center justify-center gap-2"
      >
        {t('partner.becomePartner')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}