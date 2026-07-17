"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  fileToLogoPayload,
  fileToPreviewUrl,
  validateLogoFile,
  type LogoPayload,
} from "@/lib/organization/logo-client";
import { AdminError } from "@/components/admin/AdminStatus";
import {
  adminBtnClass,
  adminInputClass,
  adminLabelClass,
  adminPageTitleClass,
  adminPrimaryBtnClass,
} from "@/components/admin/styles";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  pending_invites: number;
}

const PAGE_SIZE = 25;

export default function OrganizationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoPayload, setLogoPayload] = useState<LogoPayload | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadOrgs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const checkAdminAndLoadOrgs = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", authUser.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      loadOrganizations();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json();
      
      if (!res.ok) {
        const detail = typeof data.details === "string" ? ` (${data.details})` : "";
        setError((data.error || "Failed to load organizations") + detail);
      } else {
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error("Load organizations error:", err);
      setError("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setShowCreateModal(false);
    setNewOrgName("");
    setNewOrgSlug("");
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoPayload(null);
    setLogoError(null);
  };

  const handleLogoSelect = async (file: File | null) => {
    setLogoError(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoPayload(null);
    if (!file) return;

    const err = validateLogoFile(file);
    if (err) {
      setLogoError(err);
      return;
    }
    try {
      const payload = await fileToLogoPayload(file);
      setLogoPayload(payload);
      setLogoPreview(fileToPreviewUrl(file));
    } catch {
      setLogoError("Failed to read logo file");
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: newOrgSlug.trim().toLowerCase(),
          ...(logoPayload ? { logo: logoPayload } : {}),
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to create organization");
      } else {
        resetCreateForm();
        loadOrganizations();
      }
    } catch (err) {
      console.error("Create org error:", err);
      alert("Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = !searchQuery || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredOrgs.length / PAGE_SIZE);
  const paginatedOrgs = filteredOrgs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (error) {
    return <AdminError message={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`mb-2 ${adminLabelClass}`}>Teams</p>
          <h1 className={adminPageTitleClass}>Organizations</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {organizations.length} total organizations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={adminPrimaryBtnClass}
        >
          Create Organization
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t('admin.searchOrganizations')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={adminInputClass}
          />
        </div>
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
              <th className="text-left p-4 font-medium">Organization</th>
              <th className="text-left p-4 font-medium">Slug</th>
              <th className="text-right p-4 font-medium">Members</th>
              <th className="text-right p-4 font-medium">Pending Invites</th>
              <th className="text-left p-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-400">
                  Loading...
                </td>
              </tr>
            ) : paginatedOrgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-400">
                  No organizations found
                </td>
              </tr>
            ) : (
              paginatedOrgs.map((org) => (
                <tr key={org.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="p-4">
                    <Link href={`/admin/organizations/${org.id}`} className="flex items-center gap-3 hover:text-blue-400">
                      {org.logo_url ? (
                        <Image
                          src={org.logo_url}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-sm object-cover border border-neutral-700"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-neutral-700 bg-neutral-800 text-[10px] font-medium text-neutral-400">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="text-neutral-200 font-medium">{org.name}</div>
                    </Link>
                  </td>
                  <td className="p-4">
                    <code className="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
                      {org.slug}
                    </code>
                  </td>
                  <td className="p-4 text-right text-neutral-300">
                    {org.member_count}
                  </td>
                  <td className="p-4 text-right">
                    {org.pending_invites > 0 ? (
                      <span className="text-yellow-400">{org.pending_invites}</span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>
                  <td className="p-4 text-neutral-400 text-sm">
                    {formatDate(org.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={adminBtnClass}
          >
            Previous
          </button>
          <span className="text-neutral-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={adminBtnClass}
          >
            Next
          </button>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-md border border-neutral-800 bg-neutral-950/95 p-6 backdrop-blur-md">
            <p className={`mb-2 ${adminLabelClass}`}>New</p>
            <h2 className="mb-4 text-xl font-medium text-white">Create Organization</h2>
            <form onSubmit={handleCreateOrg}>
              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug || newOrgSlug === generateSlug(newOrgName)) {
                      setNewOrgSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder={t('organization.orgNamePlaceholder')}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-neutral-400 mb-2">Slug (URL identifier)</label>
                <input
                  type="text"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder={t('organization.orgSlugPlaceholder')}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div className="mb-6">
                <label className="block text-sm text-neutral-400 mb-2">Organization logo (optional)</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-neutral-500">Logo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      onChange={(e) => void handleLogoSelect(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-neutral-700"
                    />
                    <p className="mt-1 text-xs text-neutral-500">PNG, JPEG, WebP, GIF, or SVG · max 2 MB. Shown on invite links.</p>
                    {logoError && <p className="mt-1 text-xs text-red-400">{logoError}</p>}
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => void handleLogoSelect(null)}
                        className="mt-1 text-xs text-neutral-400 hover:text-white"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newOrgName.trim() || !newOrgSlug.trim()}
                  className={`flex-1 ${adminPrimaryBtnClass}`}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
