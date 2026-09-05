-- The campaign tables are for the service key alone.
--
-- `20260905_campaigns.sql` created them the way `booking_events` was created:
-- no RLS, on the understanding that only Server Actions holding the service
-- key would ever read them. That understanding is not what the database
-- enforces. The default schema privileges hand `anon` and `authenticated`
-- SELECT, INSERT, UPDATE and DELETE on every new table, so until this
-- migration the browser's public key could list `campaign_recipients`, which
-- is to say every newsletter address the business has, and could call
-- `record_campaign_event` to forge opens and clicks.
--
-- RLS with no policies closes both roles out entirely; `project_admin`, the
-- role behind the service key, bypasses RLS and is unaffected. This is the
-- shape `service_configs` already has. The webhook RPC loses EXECUTE for the
-- public roles the way `admin_set_user_password` did.
--
-- Two indexes change while we are here. `contact_id` is nullable and NULLs
-- are distinct in a unique index, so the old uniqueness on
-- (campaign_id, contact_id) stopped guarding a campaign the moment one of its
-- contacts was deleted; the address is the real key. And one Resend id must
-- map to one row, because `record_campaign_event` does `SELECT INTO` on it.
--
-- `upsert_contact` is deliberately left alone: the booking form calls it from
-- the browser and it must stay callable by `anon`.

-- 1. Shut the public roles out.
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- 2. Only the Resend webhook, running with the service key, may record events.
REVOKE EXECUTE ON FUNCTION public.record_campaign_event(text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;

-- 3. Dedupe by the real key. Emails are stored lowercased by the dispatcher,
--    so a plain column index is enough and ON CONFLICT can name it.
DROP INDEX IF EXISTS campaign_recipients_unique_contact;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_email
  ON campaign_recipients (campaign_id, email);

-- 4. One Resend id maps to one row.
DROP INDEX IF EXISTS campaign_recipients_provider_idx;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_provider_idx
  ON campaign_recipients (provider_id) WHERE provider_id IS NOT NULL;
