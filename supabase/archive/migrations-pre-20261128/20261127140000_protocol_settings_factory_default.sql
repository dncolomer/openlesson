-- Locked Default is the MAGI dark factory look. Named settings stay as they
-- are. custom_aesthetic_urls stay (topic-card stills).

UPDATE public.protocol_settings
SET
  style = '{
    "prompt": "",
    "generatedAt": null,
    "backgroundImage": null,
    "tokens": {
      "background": "#000000",
      "border": "rgba(255,255,255,0.3)",
      "text": "#ffffff",
      "muted": "rgba(255,255,255,0.4)",
      "panel": "#000000",
      "accent": "#ffffff",
      "overlay": "rgba(0,0,0,0.55)"
    },
    "canvas": {
      "background": "#0a0a0a",
      "stroke": "#e1e1e1",
      "zenMode": true,
      "gridMode": true
    }
  }'::jsonb,
  updated_at = now()
WHERE is_default;

UPDATE public.organizations
SET sidebar_style = '{
  "prompt": "",
  "generatedAt": null,
  "backgroundImage": null,
  "tokens": {
    "background": "#000000",
    "border": "rgba(255,255,255,0.3)",
    "text": "#ffffff",
    "muted": "rgba(255,255,255,0.4)",
    "panel": "#000000",
    "accent": "#ffffff",
    "overlay": "rgba(0,0,0,0.55)"
  },
  "canvas": {
    "background": "#0a0a0a",
    "stroke": "#e1e1e1",
    "zenMode": true,
    "gridMode": true
  }
}'::jsonb;
