/** Ordered public URLs for an org's custom aesthetic set. */

export type OrgAestheticActor = {
  organization_id?: string | null;
  is_org_admin?: boolean | null;
};

export type OrgAestheticGuard =
  | { ok: true; organizationId: string }
  | { ok: false; error: string; status: number };

export function readCustomAestheticUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Org admins may add or remove custom aesthetic images. A member who is not
 * that org's admin is refused, including a platform admin who is not the org admin.
 */
export function authorizeCustomAestheticEdit(
  profile: OrgAestheticActor | null | undefined,
): OrgAestheticGuard {
  const organizationId = String(profile?.organization_id || "").trim();
  if (!organizationId) {
    return { ok: false, error: "Organization not found", status: 404 };
  }
  if (profile?.is_org_admin !== true) {
    return {
      ok: false,
      error: "Only organization admins can update custom aesthetics",
      status: 403,
    };
  }
  return { ok: true, organizationId };
}

/** Append distinct URLs, preserving order. Existing URLs are not duplicated. */
export function addCustomAestheticUrls(
  current: readonly string[] | null | undefined,
  additions: readonly string[] | null | undefined,
): string[] {
  const urls = readCustomAestheticUrls(current);
  const seen = new Set(urls);
  for (const raw of additions ?? []) {
    const url = String(raw || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Drop one URL. Removing the last image yields an empty set. */
export function removeCustomAestheticUrl(
  current: readonly string[] | null | undefined,
  url: string,
): string[] {
  const target = String(url || "").trim();
  if (!target) return readCustomAestheticUrls(current);
  return readCustomAestheticUrls(current).filter((item) => item !== target);
}
