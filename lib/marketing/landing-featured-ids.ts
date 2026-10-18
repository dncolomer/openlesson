/**
 * Hardcoded featured map ids (UUID v5). Safe for client Home catalog imports.
 * Order is Featured (Home hero) then the second Home row, then the rest.
 */

export const LANDING_FEATURED_MAP_IDS = [
  "2e2c7fdc-74be-541e-9d2a-8ee5e16716d2",
  "b3905da5-18ce-54b5-b673-ec802bfa8d99",
  "7e536e09-0b88-5544-9b10-a03b366dd640",
  "1db360dc-76db-5f1e-ab33-ab5a729ca170",
  "dffcf089-96d7-578e-b899-20482dfa2bea",
  "f5adeda2-29fd-5091-8d15-fd6a0df3d595",
  "a14afcb5-79a8-521f-b19c-d4b863e8a414",
  "75badb0c-6f5c-5bdc-8015-910a9bac90d0",
  "c61461de-625d-5913-a162-d4f7d62ee355",
  "f9ed7c85-c098-5a8c-bbc1-6de1f9983450",
  "fdb42248-e7b7-5e9b-8d2c-f63c955b2603",
  "b05c0fee-dabc-5927-b675-4e20a992e802",
  "17a93dbc-7f14-5ad5-853e-2bdba55452f2",
  "32b233ba-a49c-5aac-a1e9-91856ff99865",
  "0d20ad4f-d09c-5e1d-a94c-9a99392135ff",
  "d04bcaa7-5f70-59a3-a2c2-e7ed02662468",
  "1f80d2fb-57ad-5de3-98d4-54152293ad04",
  "7672d2fd-f9ad-5b07-922c-4d0150df8710",
  "f0b7b5c3-5dc4-5ae8-b33e-1648a928ba51",
  "6546b4b7-fc72-5059-932b-28c18e0d0fac",
  "e5dd94bc-78cf-5627-98cc-aa72352dc0fe",
  "a035547c-430e-58b6-9066-8e3d6b30e686",
  "a9c437e3-a804-513e-8b68-a2f5c5aa6778",
  "3498752b-5651-56a9-9627-1accc589a567",
] as const;

export type LandingFeaturedMapId = (typeof LANDING_FEATURED_MAP_IDS)[number];

export function orderLandingFeaturedMaps<T extends { id: string }>(
  items: readonly T[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of LANDING_FEATURED_MAP_IDS) {
    const item = byId.get(id);
    if (item) ordered.push(item);
  }
  return ordered;
}
