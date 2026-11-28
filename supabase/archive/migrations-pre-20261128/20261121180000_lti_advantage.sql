-- LTI 1.3 Advantage tool provider: platform registrations, OIDC state,
-- tool JWKS, launches, and course-bound knowledge regions.

create table if not exists public.lti_platforms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issuer text not null,
  client_id text not null,
  auth_login_url text not null,
  auth_token_url text not null default '',
  keyset_url text not null,
  deployment_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, client_id)
);

create index if not exists lti_platforms_organization_id_idx
  on public.lti_platforms (organization_id);

create table if not exists public.lti_oidc_state (
  state text primary key,
  nonce text not null,
  platform_id uuid not null references public.lti_platforms(id) on delete cascade,
  iss text not null default '',
  client_id text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists lti_oidc_state_expires_at_idx
  on public.lti_oidc_state (expires_at);

create table if not exists public.lti_tool_keys (
  kid text primary key,
  public_jwk jsonb not null,
  private_jwk jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lti_launches (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.lti_platforms(id) on delete cascade,
  deployment_id text not null default '',
  issuer text not null,
  sub text not null,
  context_id text not null default '',
  flow_token text,
  flow_kind text,
  region_id uuid,
  resource_link_id text not null default '',
  ags_endpoint jsonb,
  nrps_endpoint jsonb,
  identity text not null,
  instructor boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lti_launches_platform_sub_idx
  on public.lti_launches (platform_id, sub, created_at desc);

create table if not exists public.lti_context_regions (
  platform_id uuid not null references public.lti_platforms(id) on delete cascade,
  deployment_id text not null,
  context_id text not null,
  knowledge_region_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (platform_id, deployment_id, context_id)
);

alter table public.lti_platforms enable row level security;
alter table public.lti_oidc_state enable row level security;
alter table public.lti_tool_keys enable row level security;
alter table public.lti_launches enable row level security;
alter table public.lti_context_regions enable row level security;

drop policy if exists "Org members read LTI platforms" on public.lti_platforms;
create policy "Org members read LTI platforms"
  on public.lti_platforms for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Org admins write LTI platforms" on public.lti_platforms;
create policy "Org admins write LTI platforms"
  on public.lti_platforms for all
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  );

drop policy if exists "Org members read LTI context regions" on public.lti_context_regions;
create policy "Org members read LTI context regions"
  on public.lti_context_regions for select
  using (
    platform_id in (
      select id from public.lti_platforms
      where organization_id in (
        select organization_id from public.profiles where id = auth.uid()
      )
    )
  );

comment on table public.lti_platforms is
  'LMS LTI 1.3 platform registrations (Brightspace issuer + client_id).';
comment on table public.lti_tool_keys is
  'Tool RS256 keys for JWKS, Deep Linking responses, and AGS client assertions.';
