-- PR 9: knowledge regions attach to a registry embedding family and a
-- Learning Map or a Calibrate/Verify flow. Retired 64-d knowledgecfg rows
-- stay in the table but are not live Path points.

alter table public.custom_verification_models
  add column if not exists family_embedding_model_id text;

alter table public.custom_verification_models
  add column if not exists calibrate_flow_id uuid;

alter table public.custom_verification_models
  add column if not exists verify_flow_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'custom_verification_models_family_embedding_model_id_fkey'
  ) then
    alter table public.custom_verification_models
      add constraint custom_verification_models_family_embedding_model_id_fkey
      foreign key (family_embedding_model_id) references public.embedding_models(id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'custom_verification_models_calibrate_flow_id_fkey'
  ) then
    alter table public.custom_verification_models
      add constraint custom_verification_models_calibrate_flow_id_fkey
      foreign key (calibrate_flow_id) references public.workspace_calibration_flows(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'custom_verification_models_verify_flow_id_fkey'
  ) then
    alter table public.custom_verification_models
      add constraint custom_verification_models_verify_flow_id_fkey
      foreign key (verify_flow_id) references public.workspace_verification_flows(id) on delete set null;
  end if;
end $$;

update public.custom_verification_models
set family_embedding_model_id = 'learn-flowcfg-v1-d96'
where family_embedding_model_id is null
  and dim = 96;

update public.custom_verification_models
set family_embedding_model_id = null
where embedding_model_id = 'knowledgecfg-v1-d64'
   or dim = 64;

comment on column public.custom_verification_models.family_embedding_model_id is
  'Registry family (learn/calibrate/verify). Null means retired 64-d knowledgecfg — not a live Path point.';
comment on table public.custom_verification_models is
  'Knowledge regions. UI name stays Knowledge Region. Live Path regions use flowcfg-v1-d96.';
