-- Independent basis channel vectors on session embeddings. Path stays in
-- `vector`. Combinations (spaces) are mixed at read time, not stored.

alter table public.session_embeddings
  add column if not exists channel_vectors jsonb not null default '{}'::jsonb;

comment on column public.session_embeddings.channel_vectors is
  'Unit 96-d basis vectors keyed by channel (path, audio, eeg, video, screen). Mix into named spaces at read time.';
