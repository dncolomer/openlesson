"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_TIERS, UNSTAKE_LOCKUP_DAYS, PartnerTier } from "@/lib/partners";
import { Copy, ExternalLink, DollarSign, Users, Link2, AlertTriangle, Check, X, Wallet, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const DASHBOARD_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect?: () => Promise<void>;
    };
  }
}

interface PartnerData {
  isPartner: boolean;
  partner?: {
    id: string;
    tier: PartnerTier;
    stakeAmount: number;
    referralCode: string;
    stripeAccountId: string | null;
    stripeAccountStatus: string;
    totalRevenueClaimed: number;
    lastPayoutAt: string | null;
    unstakeRequestedAt: string | null;
    createdAt: string;
  };
  stats?: {
    referralCount: number;
    unclaimedRevenue: number;
    lifetimeEarnings: number;
    isUnstakeLocked: boolean;
    unlockDate: string | null;
  };
  referredUsers?: { user_id: string; username: string; created_at: string }[];
}

export default function PartnerPage() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Staking flow
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PartnerTier | null>(null);
  const [staking, setStaking] = useState(false);
  const [stakeStep, setStakeStep] = useState<"select" | "verify" | "done">("select");
  const [error, setError] = useState<string | null>(null);

  const STAKING_WALLET = "3Q6HtL8pmenFZjN4TQ21okC12WWKBeeH9k5g3pYT4WYY";

  const connectWallet = async () => {
    // Try to connect to Phantom or other Solana wallet
    if (window.solana?.isPhantom) {
      try {
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
        setWalletConnected(true);
      } catch (err) {
        console.error("Failed to connect wallet:", err);
        setError(t('partner.failedToConnectWallet'));
      }
    } else {
      // Show manual input if no wallet found
      setError(t('partner.noWalletFound'));
    }
  };

  const handleStake = async () => {
    if (!selectedTier || !walletAddress) return;
    
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
        setStakeStep("done");
        loadPartnerData();
      } else {
        setError(data.error || t('partner.failedToBecomePartner'));
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setStaking(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/partners/me");
      const data = await res.json();
      setPartnerData(data);
    } catch (error) {
      console.error("Error loading partner data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!partnerData?.partner) return;
    const link = `${window.location.origin}/register?ref=${partnerData.partner.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connectStripe = async () => {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/partners/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
    } finally {
      setConnectingStripe(false);
    }
  };

  const requestUnstake = async () => {
    setUnstaking(true);
    try {
      const res = await fetch("/api/partners/unstake", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        loadPartnerData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error requesting unstake:", error);
    } finally {
      setUnstaking(false);
      setShowUnstakeConfirm(false);
    }
  };

  const confirmUnstake = async () => {
    setUnstaking(true);
    try {
      const res = await fetch("/api/partners/confirm-unstake", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        router.push("/dashboard");
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error confirming unstake:", error);
    } finally {
      setUnstaking(false);
      setShowUnstakeConfirm(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#0a0a0a] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
      >
        <div className="text-neutral-400">{t('common.loading')}</div>
      </div>
    );
  }

  if (!partnerData?.isPartner) {
    return (
      <div
        className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
      >
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-white mb-4">{t('partner.program')}</h1>
          <p className="text-neutral-400 mb-8">{t('partner.becomePartnerDesc')}</p>
          
          {stakeStep === "done" ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('partner.nowPartner') || "You're now a partner!"}</h2>
              <p className="text-neutral-400 mb-2">{t('partner.accountCreated')}</p>
              <p className="text-sm text-emerald-400 mb-6">{t('partner.planUpgraded')}</p>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
              >
                {t('partner.goToDashboard')}
              </button>
            </div>
          ) : stakeStep === "verify" ? (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">{t('partner.confirmStake')}</h2>
              
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">{t('partner.actionRequired')}</span>
                </div>
                <p className="text-sm text-neutral-300">
                  {t('partner.sendExactly', { amount: String(PARTNER_TIERS[selectedTier!].stakeAmount / 1_000_000) })}
                </p>
                <code className="block mt-3 p-3 bg-neutral-800 rounded-lg text-emerald-400 text-sm break-all">
                  {STAKING_WALLET}
                </code>
                <p className="text-xs text-neutral-500 mt-3">
                  {t('partner.stakingManualNote')}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStakeStep("select")}
                  className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleStake}
                  disabled={staking}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {staking ? t('partner.processing') : t('partner.sentTokens')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <p className="mt-4 text-red-400 text-sm">{error}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {(["bronze", "silver", "gold"] as PartnerTier[]).map((tier) => {
                  const info = PARTNER_TIERS[tier];
                  const isSelected = selectedTier === tier;
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={`border rounded-xl p-6 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30"
                          : tier === "gold"
                          ? "border-amber-500 bg-amber-500/10 hover:border-amber-400"
                          : tier === "silver"
                          ? "border-slate-400 bg-slate-400/10 hover:border-slate-300"
                          : "border-amber-700 bg-amber-700/10 hover:border-amber-600"
                      }`}
                    >
                      <div className="text-lg font-semibold text-white mb-2 capitalize">{tier}</div>
                      <div className="text-2xl font-bold text-white mb-4">{(info.stakeAmount / 1_000_000)}M $UNSYS</div>
                      <div className="text-sm text-neutral-400">
                        {t('partner.earnRevenueShare', { percent: String(info.revenueShare * 100) })}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <h3 className="font-semibold text-white mb-4">{t('partner.connectWallet')}</h3>
                
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={connectWallet}
                    className="flex-1 px-4 py-3 bg-[#635BFF] text-white rounded-lg hover:bg-[#5851E1] flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    {t('partner.connectPhantom')}
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-neutral-900 px-2 text-neutral-500">{t('partner.orEnterManually')}</span>
                  </div>
                </div>

                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => {
                    setWalletAddress(e.target.value);
                    setWalletConnected(!!e.target.value);
                  }}
                  placeholder={t('partner.walletPlaceholder')}
                  className="w-full mt-4 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500"
                />

                {error && (
                  <p className="mt-4 text-red-400 text-sm">{error}</p>
                )}

                <button
                  onClick={() => {
                    if (!selectedTier) {
                      setError(t('partner.selectTierFirst'));
                      return;
                    }
                    if (!walletAddress) {
                      setError(t('partner.enterWalletAddress'));
                      return;
                    }
                    setStakeStep("verify");
                    setError(null);
                  }}
                  disabled={!selectedTier || !walletAddress}
                  className="w-full mt-6 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {t('partner.continueToStake')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-8 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <h3 className="font-semibold text-white mb-2">{t('partner.howItWorks')}</h3>
                <ol className="text-sm text-neutral-400 space-y-1 list-decimal list-inside">
                  <li>{t('partner.step1')}</li>
                  <li>{t('partner.step2')}</li>
                  <li>{t('partner.step3')}</li>
                  <li>{t('partner.step4')}</li>
                  <li>{t('partner.step5')}</li>
                  <li>{t('partner.step6')}</li>
                </ol>
              </div>
            </>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
          >
            {t('partner.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  const { partner, stats } = partnerData;
  if (!partner || !stats) return null;

  const tierInfo = PARTNER_TIERS[partner.tier];
  const inviteLink = `${window.location.origin}/register?ref=${partner.referralCode}`;
  const daysRemaining = stats.unlockDate
    ? Math.max(0, Math.ceil((new Date(stats.unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${DASHBOARD_BACKGROUND})` }}
    >
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {t('partner.partnerDashboard')}
              <span
                className={`text-sm px-3 py-1 rounded-full ${
                  partner.tier === "gold"
                    ? "bg-amber-500/20 text-amber-400"
                    : partner.tier === "silver"
                    ? "bg-slate-400/20 text-slate-300"
                    : "bg-amber-700/20 text-amber-600"
                }`}
              >
                {tierInfo.label}
              </span>
            </h1>
            <p className="text-neutral-400 mt-1">
              {t('partner.stakedInfo', { amount: (partner.stakeAmount / 1_000_000).toFixed(0), percent: String(tierInfo.revenueShare * 100) })}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <Link2 className="w-4 h-4" />
              <span className="text-sm font-medium">{t('dashboard.yourInviteLink')}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={copyReferralLink}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">{t('partner.referralCode')}: {partner.referralCode}</p>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">{t('partner.revenue')}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${stats.unclaimedRevenue.toFixed(2)}
            </div>
            <div className="text-sm text-neutral-400">
              {t('partner.unclaimedLifetime', { lifetime: stats.lifetimeEarnings.toFixed(2) })}
            </div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{t('partner.referrals')}</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.referralCount}</div>
            <div className="text-sm text-neutral-400">{t('partner.usersReferred')}</div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-4">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">{t('partner.payoutMethod')}</span>
            </div>
            {partner.stripeAccountStatus === "connected" ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>{t('partner.stripeConnected')}</span>
              </div>
            ) : (
              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                className="px-4 py-2 bg-[#635BFF] text-white rounded-lg hover:bg-[#5851E1] disabled:opacity-50 flex items-center gap-2"
              >
                {connectingStripe ? t('common.connecting') : t('partner.connectStripeBtn')}
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {partner.unstakeRequestedAt && (
          <div className={`mb-8 rounded-xl p-6 border ${
            stats.isUnstakeLocked 
              ? "bg-amber-500/10 border-amber-500/30" 
              : "bg-red-500/10 border-red-500/30"
          }`}>
            <div className="flex items-center gap-2 text-white mb-2">
              <AlertTriangle className={`w-5 h-5 ${stats.isUnstakeLocked ? "text-amber-400" : "text-red-400"}`} />
              <span className="font-medium">
                {stats.isUnstakeLocked ? t('partner.unstakeInProgress') : t('partner.readyToCompleteUnstake')}
              </span>
            </div>
            <p className="text-sm text-neutral-400 mb-2">
              {stats.isUnstakeLocked 
                ? t('partner.daysRemainingUnstake', { days: String(daysRemaining) })
                : t('partner.lockupEnded')
              }
            </p>
            <p className="text-xs text-neutral-500 mb-4">
              {t('partner.planAccessRevoked')}
            </p>
            {!stats.isUnstakeLocked && (
              <button
                onClick={confirmUnstake}
                disabled={unstaking}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
              >
                {unstaking ? t('partner.processing') : t('partner.completeUnstake')}
              </button>
            )}
          </div>
        )}

        <div className="mb-8">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 mb-4"
          >
            {showHowItWorks ? t('partner.hideHowItWorks') : t('partner.showHowItWorks')}
          </button>
          
          {showHowItWorks && (
            <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
              <h3 className="font-semibold text-white mb-4">{t('partner.howProgramWorks')}</h3>
              <div className="space-y-4 text-sm text-neutral-400">
                <div>
                  <div className="font-medium text-white mb-1">{t('partner.staking')}</div>
                  <p>{t('partner.stakingDesc')}</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">{t('partner.referralsLabel')}</div>
                  <p>{t('partner.referralsDesc')}</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">{t('partner.revenueShare')}</div>
                  <p>{t('partner.revenueShareDesc', { bronze: String(PARTNER_TIERS.bronze.revenueShare * 100), silver: String(PARTNER_TIERS.silver.revenueShare * 100), gold: String(PARTNER_TIERS.gold.revenueShare * 100) })}</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">{t('partner.payouts')}</div>
                  <p>{t('partner.payoutsDesc')}</p>
                </div>
                <div>
                  <div className="font-medium text-white mb-1">{t('partner.unstaking')}</div>
                  <p>{t('partner.unstakingDesc', { days: String(UNSTAKE_LOCKUP_DAYS) })}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!partner.unstakeRequestedAt && (
          <button
            onClick={() => setShowUnstakeConfirm(true)}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            {t('partner.wantToUnstake')}
          </button>
        )}

        {showUnstakeConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-900 rounded-xl p-6 max-w-md border border-neutral-800">
              <h3 className="text-xl font-bold text-white mb-4">{t('partner.unstake')}</h3>
              <p className="text-neutral-400 mb-4">
                {t('partner.unstakeWarning')}
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {t('partner.lockupBegins')}
                </p>
                <p className="text-xs text-amber-400/70 mt-2">
                  {t('partner.contactForReturn')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnstakeConfirm(false)}
                  className="flex-1 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={requestUnstake}
                  disabled={unstaking}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                >
                  {unstaking ? t('partner.processing') : t('partner.requestUnstake')}
                </button>
              </div>
            </div>
          </div>
        )}

        {partnerData.referredUsers && partnerData.referredUsers.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">{t('partner.referredUsers')}</h3>
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">{t('partner.username')}</th>
                    <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">{t('partner.joined')}</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerData.referredUsers.map((u) => (
                    <tr key={u.user_id} className="border-b border-neutral-800 last:border-0">
                      <td className="px-4 py-3 text-white">{u.username}</td>
                      <td className="px-4 py-3 text-neutral-400 text-sm">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
