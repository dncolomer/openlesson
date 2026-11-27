-- Factory locked default is labeled Uncertain Systems.

UPDATE public.protocol_settings AS ps
SET
  name = 'Uncertain Systems',
  updated_at = now()
WHERE ps.is_default
  AND lower(ps.name) = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM public.protocol_settings other
    WHERE other.organization_id = ps.organization_id
      AND lower(other.name) = 'uncertain systems'
      AND other.id <> ps.id
  );
