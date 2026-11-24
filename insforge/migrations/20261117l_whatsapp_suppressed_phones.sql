-- APPLIED to the live database on 2026-11-24 (table, RLS on, no policies, verified).
--
-- Phones that wrote STOP or BAJA to the centre's WhatsApp, kept by NUMBER.
-- Consent lives on a contact, but the public booking form also writes the
-- phone: somebody can book with their own email, a victim's number and the
-- box ticked, and the centre would message the victim. A STOP from that number
-- is the victim's answer, so it is remembered whether or not any contact
-- matches it, and nothing a form, a checkbox or upsert_contact does lifts it.
-- Only an administrator, from the contact's card, removes a number.
--
-- Every reader fails closed: until this is applied, a WhatsApp message to a
-- client or in a campaign is NOT sent (the read errors), and email never reads
-- it. RLS on and no policies, like `campaigns`: only the service key reads it.
--
-- Rollback: DROP TABLE whatsapp_suppressed_phones;

BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_suppressed_phones (
  phone      text PRIMARY KEY CHECK (phone ~ '^\+[0-9]{8,15}$'),
  reason     text NOT NULL DEFAULT 'stop',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_suppressed_phones ENABLE ROW LEVEL SECURITY;

COMMIT;
