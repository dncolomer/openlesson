"use client";

import { useState } from "react";
import { trackLeadSubmitted } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";

type Audience = "enterprise" | "schools" | "hr";

interface LeadCaptureProps {
  audience: Audience;
  title?: string;
  subtitle?: string;
  submitText?: string;
  sourcePage?: string;
}

const SIZE_OPTIONS = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "500+", label: "500+" },
];

export function LeadCapture({
  audience,
  title,
  subtitle,
  submitText,
  sourcePage,
}: LeadCaptureProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    email: "",
    organization: "",
    role: "",
    size: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRoleOptions = (): string[] => {
    switch (audience) {
      case "enterprise":
        return [
          t("leadCapture.roleSalesLeader"),
          t("leadCapture.roleTrainingManager"),
          t("leadCapture.roleLAndDManager"),
          t("leadCapture.roleHRDirector"),
          t("leadCapture.roleExecutive"),
        ];
      case "schools":
        return [
          t("leadCapture.roleTeacher"),
          t("leadCapture.roleDepartmentHead"),
          t("leadCapture.rolePrincipal"),
          t("leadCapture.roleDistrictAdmin"),
          t("leadCapture.roleITAdmin"),
        ];
      case "hr":
        return [
          t("leadCapture.roleHRManager"),
          t("leadCapture.roleRecruiter"),
          t("leadCapture.roleTalentAcquisition"),
          t("leadCapture.roleHiringManager"),
          t("leadCapture.roleHRDirector"),
        ];
    }
  };

  const getDefaultTitle = (): string => {
    switch (audience) {
      case "enterprise":
        return t("enterprise.leadTitle");
      case "schools":
        return t("eval.requestDemo");
      case "hr":
        return t("eval.requestDemo");
    }
  };

  const getDefaultSubtitle = (): string => {
    switch (audience) {
      case "enterprise":
        return t("enterprise.leadSubtitle");
      case "schools":
        return t("leadCapture.schoolPilotSubtitle");
      case "hr":
        return t("eval.demoSubtitle");
    }
  };

  const getOrgLabel = (): string => {
    return audience === "schools" ? t("leadCapture.schoolName") : t("leadCapture.companyName");
  };

  const getOrgPlaceholder = (): string => {
    return audience === "schools" ? t("leadCapture.schoolPlaceholder") : t("leadCapture.enterprisePlaceholder");
  };

  const getSizeLabel = (): string => {
    return audience === "schools" ? t("leadCapture.numStudents") : t("leadCapture.teamSize");
  };

  const getThanksMessage = (): string => {
    return audience === "schools" ? t("leadCapture.thanksMessageSchool") : t("leadCapture.thanksMessageOrg");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          audience,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      trackLeadSubmitted({
        audience,
        page: sourcePage ?? window.location.pathname,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("leadCapture.genericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (submitted) {
    return (
      <div className="w-full">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <svg
            className="w-12 h-12 text-emerald-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">{t("leadCapture.thanksTitle")}</h3>
          <p className="text-sm text-slate-400">
            {getThanksMessage()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          {title || getDefaultTitle()}
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          {subtitle || getDefaultSubtitle()}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs text-slate-400 mb-1.5">
              {t("leadCapture.workEmail")} *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder={t("leadCapture.emailPlaceholder")}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Organization */}
          <div>
            <label htmlFor="organization" className="block text-xs text-slate-400 mb-1.5">
              {getOrgLabel()} *
            </label>
            <input
              type="text"
              id="organization"
              name="organization"
              required
              value={formData.organization}
              onChange={handleChange}
              placeholder={getOrgPlaceholder()}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-xs text-slate-400 mb-1.5">
              {t("leadCapture.yourRole")}
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
            >
              <option value="">{t("leadCapture.selectRole")}</option>
              {getRoleOptions().map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
              <option value="Other">{t("leadCapture.roleOther")}</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <label htmlFor="size" className="block text-xs text-slate-400 mb-1.5">
              {getSizeLabel()}
            </label>
            <select
              id="size"
              name="size"
              value={formData.size}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
            >
              <option value="">{t("leadCapture.selectSize")}</option>
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-xs text-slate-400 mb-1.5">
              {t("leadCapture.optionalNote")}
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={3}
              placeholder={t("leadCapture.messagePlaceholder")}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 text-sm font-medium text-slate-900 bg-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {isSubmitting ? t("leadCapture.submitting") : submitText || t("leadCapture.requestAccess")}
          </button>
        </form>
      </div>
    </div>
  );
}
