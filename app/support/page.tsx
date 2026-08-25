import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { MarketingPageShell, SectionHeading } from "@/components/marketing/MarketingChrome";
import { SUPPORT_PATH } from "@/lib/marketing/paths";
import {
  SUPPORT_COPY,
  SUPPORT_PAGE_TITLE,
  TOKENOMICS_ROWS,
  UNSYS_PROGRAM_ID,
  UNSYS_TOKEN_CA,
} from "@/lib/marketing/support";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: `https://uncertain.systems${SUPPORT_PATH}`,
});

export const metadata: Metadata = {
  title: SUPPORT_PAGE_TITLE,
  description: SUPPORT_COPY.body,
  alternates: { canonical: `https://uncertain.systems${SUPPORT_PATH}` },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function SupportThisProjectPage() {
  return (
    <MarketingPageShell>
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <SectionHeading eyebrow={SUPPORT_COPY.eyebrow} title="Support this Project" />
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {SUPPORT_COPY.lead}
        </p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          We created $UNSYS on Solana so trading fees can help fund this project — staking, revenue sharing,
          referrals, and data-provider rewards all flow back into the learning automation stack.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href={SUPPORT_COPY.stakingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            <ExternalLink size={16} />
            Open staking program
          </a>
          <a
            href={SUPPORT_COPY.buyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900/80 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
          >
            <ExternalLink size={16} />
            Buy $UNSYS
          </a>
          <a
            href={SUPPORT_COPY.contractHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950/60 px-5 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            View contract
          </a>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Token CA</p>
            <code className="mt-2 block break-all font-mono text-xs leading-relaxed text-zinc-300 sm:text-sm">
              {UNSYS_TOKEN_CA}
            </code>
          </div>
          <div className="border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Program</p>
            <code className="mt-2 block break-all font-mono text-xs leading-relaxed text-zinc-300 sm:text-sm">
              {UNSYS_PROGRAM_ID}
            </code>
          </div>
        </div>

        <h3 className="mt-12 text-center text-xl font-medium tracking-[-0.6px] text-white sm:text-2xl">
          Tokenomics &amp; Rewards
        </h3>
        <div className="mt-6 overflow-x-auto border border-zinc-800 bg-zinc-950/70">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                {["Program", "Stake Required", "You Earn", "Lock / Effort"].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-zinc-800 bg-zinc-900/60 p-3 text-left font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOKENOMICS_ROWS.map((row) => (
                <tr key={row[0]} className="transition hover:bg-zinc-900/40">
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      className={`border-b border-zinc-800/80 p-3 ${
                        index === 0 ? "font-medium text-zinc-200" : "text-zinc-400"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MarketingPageShell>
  );
}
