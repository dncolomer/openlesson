/**
 * Shared product-workspace auth flags for UI routes that used to copy
 * resolveWebAuth with different org-admin / AYCL-as-owner rules.
 */

export type ProductWorkspaceAuthFlags = {
  allowOrgAdmin: boolean;
  allowEvalMember: boolean;
  ayclAsOwner: boolean;
};

export const PRODUCT_AUTH_OWNER_OR_ORG_ADMIN: ProductWorkspaceAuthFlags = {
  allowOrgAdmin: true,
  allowEvalMember: false,
  ayclAsOwner: false,
};

export const PRODUCT_AUTH_EVAL_MEMBER_AYCL_OWNER: ProductWorkspaceAuthFlags = {
  allowOrgAdmin: false,
  allowEvalMember: true,
  ayclAsOwner: true,
};

export function resolveProductWorkspaceAuthMode(input: {
  isOwner: boolean;
  isOrgAdmin: boolean;
  evalAllowed: boolean;
  flags: ProductWorkspaceAuthFlags;
}): "ok" | "deny" {
  if (input.isOwner) return "ok";
  if (input.flags.allowOrgAdmin && input.isOrgAdmin) return "ok";
  if (input.flags.allowEvalMember && input.evalAllowed) return "ok";
  return "deny";
}

export function productWorkspaceAuthIsOwner(input: {
  cookieIsOwner: boolean;
  ayclAccess: boolean;
  flags: ProductWorkspaceAuthFlags;
}): boolean {
  if (input.ayclAccess && input.flags.ayclAsOwner) return true;
  return input.cookieIsOwner;
}

export function decideProductWorkspaceAccess(input: {
  isOwner: boolean;
  isOrgAdmin: boolean;
  evalAllowed: boolean;
  ayclAccess: boolean;
  flags: ProductWorkspaceAuthFlags;
}): { allowed: boolean; isOwner: boolean } {
  const isOwner = productWorkspaceAuthIsOwner({
    cookieIsOwner: input.isOwner,
    ayclAccess: input.ayclAccess,
    flags: input.flags,
  });
  const mode = resolveProductWorkspaceAuthMode({
    isOwner: input.isOwner,
    isOrgAdmin: input.isOrgAdmin,
    evalAllowed: input.evalAllowed,
    flags: input.flags,
  });
  return { allowed: mode === "ok" || isOwner, isOwner };
}
