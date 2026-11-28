-- Discard leftover TAP Verify sessions (kind=verify with no verify_flow_id)
-- and retired 64-d Path vectors. Proof of work is never deleted: session_id
-- on proof_of_work is ON DELETE SET NULL. Real Verify identity sessions
-- (verify_flow_id set) stay.

delete from public.session_embeddings
where dim = 64
   or dim <> 96
   or embedding_model_id = 'knowledgecfg-v1-d64'
   or embedding_model_id like '%d64';

delete from public.sessions
where kind = 'verify'
  and verify_flow_id is null;
