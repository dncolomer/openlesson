-- Learning Map block kinds: Learn (default), calibration, verification, content.
-- Typed payload: linked owner flow id/token/href, or content file/link attachments.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS map_block jsonb;

COMMENT ON COLUMN public.blocks.map_block IS
  'Optional Learning Map block kind payload. Null/absent = Learn. { kind: calibration|verification|content, flow_id, flow_public_token, flow_href, attachments }.';

NOTIFY pgrst, 'reload schema';
