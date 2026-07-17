"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { tierColor, tierLabel } from "@/lib/admin/tiers";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import {
  adminBackLinkClass,
  adminDangerBtnClass,
  adminLabelClass,
  adminPageTitleClass,
  adminPrimaryBtnClass,
} from "@/components/admin/styles";
import {
  fileToLogoPayload,
  validateLogoFile,
} from "@/lib/organization/logo-client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  kind?: string;
  billing_mode?: string;
  plan?: string;
  subscription_status?: string;
  current_period_end?: string | null;
  extra_lessons?: number;
  billing_email?: string | null;
  xai_api_key_id?: string | null;
  xai_api_key_name?: string | null;
  xai_api_key_status?: string | null;
  xai_collection_id?: string | null;
  xai_collection_status?: string | null;
}

interface Member {
  id: string;
  username: string | null;
  email: string | null;
  is_org_admin: boolean;
  created_at: string;
  plan: string;
  subscription_status: string;
}

interface Invite {
  id: string;
  token: string;
  created_by: string | null;
  created_by_username: string | null;
  used_by: string | null;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [generatingInvites, setGeneratingInvites] = useState(false);
  const [inviteCount, setInviteCount] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [savingBilling, setSavingBilling] = useState(false);
  const [editPlan, setEditPlan] = useState("inactive");
  const [editBillingMode, setEditBillingMode] = useState("subscription");
  const [editExtraLessons, setEditExtraLessons] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, [orgId]);

  const checkAdminAndLoad = async () => {
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

      loadOrganization();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadOrganization = async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load organization");
      } else {
        setOrganization(data.organization);
        setMembers(data.members || []);
        setInvites(data.invites || []);
        setEditName(data.organization.name);
        setEditSlug(data.organization.slug);
        setEditPlan(data.organization.plan || "inactive");
        setEditBillingMode(data.organization.billing_mode || "subscription");
        setEditExtraLessons(data.organization.extra_lessons ?? 0);
      }
    } catch (err) {
      console.error("Load organization error:", err);
      setError("Failed to load organization");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim() || !editSlug.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), slug: editSlug.trim() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to update organization");
      } else {
        setOrganization(data.organization);
        setEditing(false);
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: editPlan,
          billing_mode: editBillingMode,
          extra_lessons: editExtraLessons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update billing");
      } else {
        setOrganization(data.organization);
      }
    } catch (err) {
      console.error("Save billing error:", err);
      alert("Failed to save billing");
    } finally {
      setSavingBilling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${organization?.name}"? This will remove all members from the organization.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete organization");
      } else {
        router.push("/admin/organizations");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete organization");
    }
  };

  const handleGenerateInvites = async () => {
    setGeneratingInvites(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: inviteCount }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to generate invites");
      } else {
        setShowInviteModal(false);
        setInviteCount(1);
        loadOrganization();
      }
    } catch (err) {
      console.error("Generate invites error:", err);
      alert("Failed to generate invites");
    } finally {
      setGeneratingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return;
    
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to revoke invite");
      } else {
        loadOrganization();
      }
    } catch (err) {
      console.error("Delete invite error:", err);
      alert("Failed to revoke invite");
    }
  };

  const handleToggleOrgAdmin = async (memberId: string, currentStatus: boolean) => {
    setUpdatingMember(memberId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, is_org_admin: !currentStatus }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update member");
      } else {
        loadOrganization();
      }
    } catch (err) {
      console.error("Toggle org admin error:", err);
      alert("Failed to update member");
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this organization?`)) return;
    
    setUpdatingMember(memberId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, organization_id: null, is_org_admin: false }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      } else {
        loadOrganization();
      }
    } catch (err) {
      console.error("Remove member error:", err);
      alert("Failed to remove member");
    } finally {
      setUpdatingMember(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert("Invite link copied to clipboard!");
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    const err = validateLogoFile(file);
    if (err) {
      alert(err);
      return;
    }
    setUploadingLogo(true);
    try {
      const logo = await fileToLogoPayload(file);
      const res = await fetch(`/api/admin/organizations/${orgId}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to upload logo");
      } else if (organization) {
        setOrganization({ ...organization, logo_url: data.logo_url });
      }
    } catch (uploadErr) {
      console.error("Logo upload error:", uploadErr);
      alert("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <AdminLoading />;
  }

  if (error) {
    return <AdminError message={error} />;
  }

  if (!organization) {
    return <AdminError message="Organization not found" />;
  }

  const unusedInvites = invites.filter(i => !i.used_by);
  const usedInvites = invites.filter(i => i.used_by);

  const logoMark = (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
      {organization.logo_url ? (
        <Image
          src={organization.logo_url}
          alt={`${organization.name} logo`}
          width={64}
          height={64}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span className="text-xl font-medium text-neutral-500">
          {organization.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );

  const logoFileInput = (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        disabled={uploadingLogo}
        onChange={(e) => {
          void handleLogoUpload(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {uploadingLogo
        ? "Uploading…"
        : organization.logo_url
          ? "Change logo"
          : "Upload logo"}
    </label>
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/organizations" className={adminBackLinkClass}>
        &larr; Back to Organizations
      </Link>

      {/* Organization Header */}
      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className={`mb-2 block ${adminLabelClass}`}>Organization logo</label>
              <div className="flex items-center gap-4">
                {logoMark}
                <div className="min-w-0">
                  {logoFileInput}
                  <p className="mt-1 text-xs text-neutral-500">
                    Shown on invite links. PNG, JPEG, WebP, GIF, or SVG · max 2 MB.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Organization Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Slug</label>
              <input
                type="text"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditName(organization.name);
                  setEditSlug(organization.slug);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={adminPrimaryBtnClass}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {logoMark}
              <div className="min-w-0">
                <p className={`mb-2 ${adminLabelClass}`}>Organization</p>
                <h1 className={adminPageTitleClass}>{organization.name}</h1>
                <code className="mt-2 inline-block rounded bg-neutral-800/80 px-2 py-1 font-mono text-sm text-neutral-400">
                  {organization.slug}
                </code>
                <p className="mt-2 text-sm text-neutral-500">
                  Created {formatDate(organization.created_at)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {logoFileInput}
                  <span className="text-xs text-neutral-500">
                    Shown on invite links · max 2 MB
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className={adminDangerBtnClass}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Billing / xAI resources */}
      <div className="space-y-4 rounded-md border border-neutral-800 bg-neutral-950/75 p-5 backdrop-blur-sm sm:p-6">
        <p className={adminLabelClass}>Billing &amp; xAI</p>
        <h2 className="text-lg font-medium text-white">Plan and platform resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Plan tier</label>
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white"
            >
              <option value="inactive">Inactive</option>
              <option value="trial">3-Day Trial</option>
              <option value="regular_2026">Individual</option>
              <option value="pro_teams">Pro / Teams</option>
              <option value="api_metered">API Metered</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Billing mode</label>
            <select
              value={editBillingMode}
              onChange={(e) => setEditBillingMode(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white"
            >
              <option value="subscription">Subscription (Stripe)</option>
              <option value="partner">Partner (bypass Stripe)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2">PoW volume overage</label>
            <input
              type="number"
              min={0}
              value={editExtraLessons}
              onChange={(e) => setEditExtraLessons(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
          <span>
            Kind: <span className="text-neutral-200">{organization.kind || "team"}</span>
          </span>
          <span>
            Status:{" "}
            <span className={tierColor(organization.plan || "inactive")}>
              {tierLabel(organization.plan || "inactive")} / {organization.subscription_status || "—"}
            </span>
          </span>
          <span>
            xAI key:{" "}
            <span className="text-neutral-200 font-mono text-xs">
              {organization.xai_api_key_status || "pending"}
              {organization.xai_api_key_name ? ` (${organization.xai_api_key_name})` : ""}
            </span>
          </span>
          <span>
            Collection:{" "}
            <span className="text-neutral-200 font-mono text-xs">
              {organization.xai_collection_status || "pending"}
              {organization.xai_collection_id
                ? ` · ${organization.xai_collection_id.slice(0, 12)}…`
                : ""}
            </span>
          </span>
        </div>
        <button
          onClick={handleSaveBilling}
          disabled={savingBilling}
          className={adminPrimaryBtnClass}
        >
          {savingBilling ? "Saving…" : "Save billing"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <div className="text-2xl font-semibold text-white">{members.length}</div>
          <div className={`mt-1 ${adminLabelClass}`}>Members</div>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <div className="text-2xl font-semibold text-white">
            {members.filter(m => m.is_org_admin).length}
          </div>
          <div className={`mt-1 ${adminLabelClass}`}>Org Admins</div>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-950/75 p-4 backdrop-blur-sm sm:p-5">
          <div className="text-2xl font-semibold text-white">{unusedInvites.length}</div>
          <div className={`mt-1 ${adminLabelClass}`}>Pending Invites</div>
        </div>
      </div>

      {/* Members */}
      <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="text-sm font-medium text-white">Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">
            No members yet. Generate invite links below.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                <th className="p-4 text-left font-medium">User</th>
                <th className="p-4 text-left font-medium">Plan</th>
                <th className="p-4 text-left font-medium">Role</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="p-4">
                    <Link href={`/admin/users/${member.id}`} className="hover:text-white">
                      <div className="text-neutral-200">{member.username || member.email || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className={tierColor(member.plan)} title={tierLabel(member.plan)}>
                      {tierLabel(member.plan)}
                    </span>
                  </td>
                  <td className="p-4">
                    {member.is_org_admin ? (
                      <span className="px-2 py-1 text-xs rounded bg-white/[0.08] text-white border border-white/15">
                        Org Admin
                      </span>
                    ) : (
                      <span className="text-neutral-500 text-sm">Member</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggleOrgAdmin(member.id, member.is_org_admin)}
                        disabled={updatingMember === member.id}
                        className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors disabled:opacity-50"
                      >
                        {member.is_org_admin ? "Remove Admin" : "Make Admin"}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.username || member.email || "this user")}
                        disabled={updatingMember === member.id}
                        className="px-3 py-1 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 rounded transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invites */}
      <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <h2 className="text-sm font-medium text-white">Invite Links</h2>
          <button
            onClick={() => setShowInviteModal(true)}
            className={adminPrimaryBtnClass}
          >
            Generate Invites
          </button>
        </div>
        
        {invites.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">
            No invites generated yet. Click &quot;Generate Invites&quot; to create invite links.
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {/* Unused invites first */}
            {unusedInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/20">
                <div>
                  <code className="text-sm text-white bg-white/[0.06] px-2 py-1 rounded">
                    {invite.token}
                  </code>
                  <div className="text-xs text-neutral-500 mt-1">
                    Created {formatDate(invite.created_at)}
                    {invite.created_by_username && ` by ${invite.created_by_username}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyInviteLink(invite.token)}
                    className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleDeleteInvite(invite.id)}
                    className="px-3 py-1 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 rounded transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
            
            {/* Used invites */}
            {usedInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between opacity-60">
                <div>
                  <code className="text-sm text-neutral-500 bg-neutral-800 px-2 py-1 rounded line-through">
                    {invite.token}
                  </code>
                  <div className="text-xs text-neutral-500 mt-1">
                    Used by {invite.used_by_username || "Unknown"} on {formatDate(invite.used_at)}
                  </div>
                </div>
                <span className="px-2 py-1 text-xs bg-neutral-800 text-neutral-500 rounded">
                  Used
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Invites Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-md border border-neutral-800 bg-neutral-950/95 p-6 backdrop-blur-md">
            <p className={`mb-2 ${adminLabelClass}`}>Invites</p>
            <h2 className="mb-4 text-xl font-medium text-white">Generate Invite Links</h2>
            <div className="mb-6">
              <label className={`mb-2 block ${adminLabelClass}`}>Number of invites</label>
              <input
                type="number"
                min={1}
                max={50}
                value={inviteCount}
                onChange={(e) => setInviteCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-500">Each invite can only be used once (max 50)</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteCount(1);
                }}
                className="flex-1 rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white transition-colors hover:border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvites}
                disabled={generatingInvites}
                className={`flex-1 ${adminPrimaryBtnClass}`}
              >
                {generatingInvites ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
