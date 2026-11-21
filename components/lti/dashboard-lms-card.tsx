"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { LTI_DASHBOARD_PATH, type LtiToolUrls } from "@/lib/lti/tool-urls";

const inputClass =
  "w-full rounded-none border border-white/40 bg-black px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-white/70 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={labelClass}>{label}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-neutral-300">{value}</p>
      </div>
      <button
        type="button"
        className="mt-2 inline-flex h-8 shrink-0 items-center justify-center rounded-none border border-neutral-700 px-3 text-xs text-neutral-300 sm:mt-0"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function DashboardLmsCard({
  usageCardClass,
}: {
  usageCardClass: string;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<LtiToolUrls | null>(null);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [authLoginUrl, setAuthLoginUrl] = useState("");
  const [authTokenUrl, setAuthTokenUrl] = useState("");
  const [keysetUrl, setKeysetUrl] = useState("");
  const [deploymentIds, setDeploymentIds] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch(LTI_DASHBOARD_PATH)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || "Could not load LMS settings");
        }
        setTool(payload.tool || null);
        const first = Array.isArray(payload.platforms) ? payload.platforms[0] : null;
        if (first) {
          setIssuer(String(first.issuer || ""));
          setClientId(String(first.client_id || ""));
          setAuthLoginUrl(String(first.auth_login_url || ""));
          setAuthTokenUrl(String(first.auth_token_url || ""));
          setKeysetUrl(String(first.keyset_url || ""));
          setDeploymentIds(
            Array.isArray(first.deployment_ids) ? first.deployment_ids.join(", ") : "",
          );
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load LMS settings"));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(LTI_DASHBOARD_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer,
          client_id: clientId,
          auth_login_url: authLoginUrl,
          auth_token_url: authTokenUrl,
          keyset_url: keysetUrl,
          deployment_ids: deploymentIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Could not save LMS registration");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save LMS registration");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${usageCardClass} space-y-5`} data-dashboard-lms="">
      <div>
        <p className={labelClass}>{t("dashboard.ltiTitle")}</p>
        <h2 className="mt-2 text-xl font-medium text-white">{t("dashboard.ltiTitle")}</h2>
        <p className="mt-2 text-sm text-neutral-500">{t("dashboard.ltiSubtitle")}</p>
      </div>

      {tool ? (
        <div className="space-y-3 border border-white/10 p-4">
          <CopyRow label={t("dashboard.ltiDomain")} value={tool.domain} />
          <CopyRow label={t("dashboard.ltiLoginUrl")} value={tool.loginUrl} />
          <CopyRow label={t("dashboard.ltiRedirectUrl")} value={tool.launchUrl} />
          <CopyRow label={t("dashboard.ltiTargetLink")} value={tool.targetLinkUri} />
          <CopyRow label={t("dashboard.ltiJwks")} value={tool.jwksUrl} />
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={(event) => void save(event)} data-dashboard-lms-form="">
        <p className="text-sm text-neutral-400">{t("dashboard.ltiPasteHint")}</p>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiIssuer")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={issuer}
            onChange={(event) => setIssuer(event.target.value)}
            placeholder="https://lms.example.edu"
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiClientId")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiAuthLogin")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={authLoginUrl}
            onChange={(event) => setAuthLoginUrl(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiAuthToken")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={authTokenUrl}
            onChange={(event) => setAuthTokenUrl(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiKeyset")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={keysetUrl}
            onChange={(event) => setKeysetUrl(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("dashboard.ltiDeploymentId")}</span>
          <input
            className={`${inputClass} mt-1`}
            value={deploymentIds}
            onChange={(event) => setDeploymentIds(event.target.value)}
            placeholder="One id, or comma-separated"
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {saved ? <p className="text-sm text-neutral-300">{t("dashboard.ltiSaved")}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
        >
          {busy ? t("dashboard.ltiSaving") : t("dashboard.ltiSave")}
        </button>
      </form>
    </div>
  );
}
