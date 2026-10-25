-- PR 5: leftover sensor media lives on workspace_proof_of_work (xAI file id).
-- ILE probes live on sessions.probes. Do not delete proof of work here.

drop table if exists public.session_audio cascade;
drop table if exists public.session_transcript cascade;
drop table if exists public.session_screenshots cascade;
drop table if exists public.session_tool cascade;
drop table if exists public.session_eeg cascade;
drop table if exists public.session_facial cascade;
drop table if exists public.session_analysis cascade;
drop table if exists public.probes cascade;
