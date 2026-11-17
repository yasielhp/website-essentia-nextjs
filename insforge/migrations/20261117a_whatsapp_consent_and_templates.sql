BEGIN;

-- Consentimiento WhatsApp por contacto. Misma regla que la newsletter: el
-- formulario solo pone el opt-in; quitarlo lo hace el propio cliente (STOP /
-- BAJA por WhatsApp) o el admin desde la ficha.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at  timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at timestamptz;

-- Copia local de las plantillas de la cuenta de WhatsApp Business. Meta es la
-- fuente de verdad del estado (APPROVED / PENDING / REJECTED); nosotros
-- guardamos el cuerpo para previsualizar y mapear parámetros sin ir a la red.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id         text UNIQUE,                 -- id en Meta; null hasta que se crea allí
  name            text NOT NULL,               -- snake_case, único por idioma en Meta
  language        text NOT NULL DEFAULT 'es',  -- código Meta: es, en, en_US…
  category        text NOT NULL DEFAULT 'MARKETING', -- MARKETING | UTILITY
  status          text NOT NULL DEFAULT 'draft',     -- draft | PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  header_text     text,
  body            text NOT NULL,               -- con {{1}}, {{2}}… tal como lo ve Meta
  footer_text     text,
  buttons         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{type:'URL', text, url}] | [{type:'QUICK_REPLY', text}]
  param_count     int  NOT NULL DEFAULT 0,
  example_params  jsonb NOT NULL DEFAULT '[]'::jsonb, -- Meta exige ejemplos para aprobar
  rejection_reason text,
  synced_at       timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

-- Solo la clave de servicio la lee: RLS sin políticas, como campaigns.
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

COMMIT;
