-- Durable public token for Knowledge Portal share URLs (always reconstructible in workspace UI).
-- Lookup remains on private_token_hash; public_token is the bearer shown/copied by owners.

alter table public.workspace_practice_portals
  add column if not exists public_token text;

create unique index if not exists workspace_practice_portals_public_token_key
  on public.workspace_practice_portals (public_token)
  where public_token is not null;
