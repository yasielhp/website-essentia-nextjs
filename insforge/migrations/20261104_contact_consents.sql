CREATE TABLE IF NOT EXISTS contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_consent boolean NOT NULL DEFAULT false,
  health_data_consent boolean NOT NULL DEFAULT false,
  signature_path text,
  signed_at timestamptz,
  signed_name text,
  filled_by_role text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS sin políticas: solo el service key lee y escribe. La firma vive en el bucket
-- privado `consents`, y `token` es el secreto del enlace público.
ALTER TABLE contact_consents ENABLE ROW LEVEL SECURITY;
