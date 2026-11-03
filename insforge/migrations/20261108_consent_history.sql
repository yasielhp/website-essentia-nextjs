ALTER TABLE contact_consents ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contact_consents.history IS 'Earlier signed states, oldest first: signed_at, signed_name, data, image_consent, health_data_consent, signature_path, filled_by_role, version. The signature files stay in the private bucket; nothing here is ever deleted.';
