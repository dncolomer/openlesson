-- Collapse the product to embeddable knowledge verification protocols.
-- Drops Solve/Calibration flow tables, insight-craft storage, knowledge-region
-- product/type columns, leftover session kinds, and non-verification embedding
-- model rows. Historical SQL files stay as history.

-- Insight crafting (Learn/Solve insight loop)
DROP TABLE IF EXISTS public.insights CASCADE;

-- Non-verification protocol products. CASCADE drops leftover FKs on
-- sessions, knowledge_regions, and proof_of_work.
DROP TABLE IF EXISTS public.solve_flows CASCADE;
DROP TABLE IF EXISTS public.calibrate_flows CASCADE;

-- Extra public links that were not verification
DELETE FROM public.flow_links
WHERE flow_kind IS DISTINCT FROM 'verification'
  AND flow_kind IS DISTINCT FROM 'verify';

ALTER TABLE public.flow_links
  DROP CONSTRAINT IF EXISTS flow_links_flow_kind_check;
ALTER TABLE public.flow_links
  ADD CONSTRAINT flow_links_flow_kind_check
  CHECK (flow_kind IN ('verification', 'verify'));

-- Knowledge regions: no product/type, no solve/calibrate parent ids
ALTER TABLE public.knowledge_regions
  DROP COLUMN IF EXISTS product;
ALTER TABLE public.knowledge_regions
  DROP COLUMN IF EXISTS type;
ALTER TABLE public.knowledge_regions
  DROP COLUMN IF EXISTS calibrate_flow_id;
ALTER TABLE public.knowledge_regions
  DROP COLUMN IF EXISTS solve_flow_id;

-- Sessions: keep verification (and leftover learn canvas parents). Drop solve/calibrate.
DELETE FROM public.sessions
WHERE kind IN ('solve', 'calibrate', 'calibration');

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_kind_check
  CHECK (kind IN ('learn', 'verify'));

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS solve_flow_id;
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS calibrate_flow_id;

ALTER TABLE public.proof_of_work
  DROP COLUMN IF EXISTS calibrate_flow_id;

-- Embeddings: verification geometry/family only
DELETE FROM public.session_embeddings
WHERE flow_kind IN ('solve', 'calibrate', 'learn')
   OR embedding_model_id IN (
     'learn-flowcfg-v1-d96',
     'calibrate-flowcfg-v1-d96',
     'solve-flowcfg-v1-d96'
   );

UPDATE public.knowledge_regions
SET family_embedding_model_id = 'verify-flowcfg-v1-d96'
WHERE family_embedding_model_id IS DISTINCT FROM 'verify-flowcfg-v1-d96'
  AND family_embedding_model_id IS NOT NULL;

DELETE FROM public.embedding_models
WHERE id IN (
  'learn-flowcfg-v1-d96',
  'calibrate-flowcfg-v1-d96',
  'solve-flowcfg-v1-d96'
)
OR family IN ('learn', 'calibrate', 'solve');

