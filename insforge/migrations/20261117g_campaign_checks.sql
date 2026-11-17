-- WhatsApp campaigns, step 1b: constraints the application layer relied on, and
-- the column that will mark numbers Meta reports as undeliverable.
-- campaigns and campaign_recipients were empty when this ran (2026-11-17), so
-- the checks validate trivially. Idempotent: each constraint is dropped first.

BEGIN;

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_channel_check,
  ADD CONSTRAINT campaigns_channel_check CHECK (channel IN ('email', 'whatsapp'));

ALTER TABLE campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_contact_point_check,
  DROP CONSTRAINT IF EXISTS campaign_recipients_phone_e164_check,
  ADD CONSTRAINT campaign_recipients_contact_point_check CHECK (email IS NOT NULL OR phone IS NOT NULL),
  ADD CONSTRAINT campaign_recipients_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\+[0-9]{8,15}$');

-- Stamped by the Meta webhook (Task 14) on error 131026; nothing writes it yet.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp_unreachable_at timestamptz;

COMMIT;

-- ROLLBACK (this migration and 20261117c). Run as one transaction.
--
-- BEGIN;
-- -- Restore record_campaign_event FIRST (before any DROP COLUMN) if WhatsApp campaigns exist, or it will
-- -- read a column that is gone. The previous definition is the function block in
-- -- insforge/migrations/20260905_campaigns.sql (also saved from the live DB as
-- -- fn-record_campaign_event.before.txt in the 2026-11-17 session scratchpad).
-- ALTER TABLE contacts DROP COLUMN IF EXISTS whatsapp_unreachable_at;
-- ALTER TABLE campaign_recipients
--   DROP CONSTRAINT IF EXISTS campaign_recipients_phone_e164_check,
--   DROP CONSTRAINT IF EXISTS campaign_recipients_contact_point_check;
-- ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_check;
-- DROP INDEX IF EXISTS campaign_recipients_unique_phone_cycle;
-- ALTER TABLE campaigns DROP COLUMN IF EXISTS channel;
-- ALTER TABLE campaign_recipients DROP COLUMN IF EXISTS phone, DROP COLUMN IF EXISTS read_at;
-- -- Fails if any WhatsApp row (or any row with a NULL email) exists: delete or
-- -- backfill those rows first.
-- ALTER TABLE campaign_recipients ALTER COLUMN email SET NOT NULL;
-- COMMIT;
