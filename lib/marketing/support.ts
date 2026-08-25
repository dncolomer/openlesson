/** $UNSYS / staking / tokenomics copy — Support this Project only (not Vision, not main nav). */

export const SUPPORT_PAGE_TITLE = "Support this Project" as const;

export const UNSYS_PROGRAM_ID = "GSxEFVkssh6trQ97WZBsMGs1iahdJ6Z2fSPjQ617nKLN";
export const UNSYS_TOKEN_CA = "Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump";

export const TOKENOMICS_ROWS = [
  ["Passive Dividends", "Any amount", "Pro-rata USDC each epoch", "3mo (1.1x) / 6mo (1.25x) / 12mo (1.5x)"],
  ["Referral Partner T1", "1,000,000 UNSYS", "10% lifetime rev-share", "Refer users to earn"],
  ["Referral Partner T2", "2,000,000 UNSYS", "30% lifetime rev-share", "Refer users to earn"],
  ["Referral Partner T3", "5,000,000 UNSYS", "50% lifetime rev-share", "Refer users to earn"],
  ["Data Provider", "5,000,000 UNSYS + data", "80% of own token fees", "Requires admin validation"],
] as const;

export const SUPPORT_COPY = {
  eyebrow: "SUPPORT",
  title: SUPPORT_PAGE_TITLE,
  lead: "Participate in the Uncertain Systems ecosystem.",
  body: "We created $UNSYS on Solana so trading fees can help fund this project — staking, revenue sharing, referrals, and data-provider rewards all flow back into the learning automation stack.",
  stakingCta: "Open staking program",
  stakingHref: "https://staking.uncertain.systems",
  buyCta: "Buy $UNSYS",
  buyHref: `https://pump.fun/${UNSYS_TOKEN_CA}`,
  contractCta: "View contract",
  contractHref: "https://github.com/dncolomer/unsys_staking",
  tokenomicsHeading: "Tokenomics & Rewards",
} as const;
