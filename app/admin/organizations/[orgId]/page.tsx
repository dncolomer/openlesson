"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
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

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "pro": return "text-purple-400";
      case "regular": return "text-blue-400";
      default: return "text-neutral-400";
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-red-400">Organization not found</div>
      </div>
    );
  }

  const unusedInvites = invites.filter(i => !i.used_by);
  const usedInvites = invites.filter(i => i.used_by);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/organizations" className="text-neutral-400 hover:text-white text-sm">
          &larr; Back to Organizations
        </Link>
      </div>

      {/* Organization Header */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 mb-6">
        {editing ? (
          <div className="space-y-4">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{organization.name}</h1>
              <code className="text-sm text-neutral-400 bg-neutral-800 px-2 py-1 rounded mt-2 inline-block">
                {organization.slug}
              </code>
              <p className="text-neutral-500 text-sm mt-2">
                Created {formatDate(organization.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{members.length}</div>
          <div className="text-neutral-400 text-sm">Members</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">
            {members.filter(m => m.is_org_admin).length}
          </div>
          <div className="text-neutral-400 text-sm">Org Admins</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{unusedInvites.length}</div>
          <div className="text-neutral-400 text-sm">Pending Invites</div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg mb-6">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">
            No members yet. Generate invite links below.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">User</th>
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">Plan</th>
                <th className="text-left p-4 text-neutral-400 text-sm font-medium">Role</th>
                <th className="text-right p-4 text-neutral-400 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                  <td className="p-4">
                    <Link href={`/admin/users/${member.id}`} className="hover:text-blue-400">
                      <div className="text-neutral-200">{member.username || member.email || "Unknown"}</div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className={getPlanColor(member.plan)}>{member.plan}</span>
                  </td>
                  <td className="p-4">
                    {member.is_org_admin ? (
                      <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
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
                        className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors disabled:opacity-50"
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
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Invite Links</h2>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
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
                  <code className="text-sm text-green-400 bg-green-900/20 px-2 py-1 rounded">
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
                    className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Generate Invite Links</h2>
            <div className="mb-6">
              <label className="block text-sm text-neutral-400 mb-2">Number of invites</label>
              <input
                type="number"
                min={1}
                max={50}
                value={inviteCount}
                onChange={(e) => setInviteCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
              />
              <p className="text-xs text-neutral-500 mt-1">Each invite can only be used once (max 50)</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteCount(1);
                }}
                className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvites}
                disabled={generatingInvites}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
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
