-- Editable transactional messages, step 17: one row per message, channel and
-- locale. A missing row means "use the default in code", so nothing breaks
-- before the admin touches anything and a paid client never depends on a row.
-- `key` has no CHECK on purpose: the catalogue of keys lives in
-- app/lib/messages/catalog.ts, and adding a message must not need a migration.
-- RLS on and no policies, like `campaigns`: only the service key reads it.
-- (Named 20261117j because d..i were taken by the WhatsApp tasks.)
-- Rollback: DROP TABLE message_templates;

BEGIN;

CREATE TABLE IF NOT EXISTS message_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                  text NOT NULL,
  channel              text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  locale               text NOT NULL CHECK (locale IN ('en', 'es')),
  enabled              boolean NOT NULL DEFAULT true,
  subject              text,
  preheader            text,
  title                text,
  doc                  jsonb,
  whatsapp_template_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  whatsapp_params      jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel, locale)
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

COMMIT;
