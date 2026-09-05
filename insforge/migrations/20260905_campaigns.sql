-- Email campaigns: one row per campaign, one per recipient, counters kept by
-- the Resend webhook so the dashboard reads a single row.
--
-- No RLS, like `booking_events`: read only through the service key from
-- Server Actions restricted to the admin role.

CREATE TABLE IF NOT EXISTS campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  -- draft | scheduled | sending | sent | cancelled | failed
  status           text NOT NULL DEFAULT 'draft',
  audience         jsonb NOT NULL DEFAULT '{}'::jsonb,
  content          jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  -- When dispatch claimed the row; the cron uses it to spot a stuck send.
  sending_started_at timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  recipients_count int  NOT NULL DEFAULT 0,
  delivered_count  int  NOT NULL DEFAULT 0,
  opened_count     int  NOT NULL DEFAULT 0,
  clicked_count    int  NOT NULL DEFAULT 0,
  bounced_count    int  NOT NULL DEFAULT 0,
  complained_count int  NOT NULL DEFAULT 0,
  failed_count     int  NOT NULL DEFAULT 0,
  last_error       text
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx
  ON campaigns (status, scheduled_at);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email        text NOT NULL,
  language     text NOT NULL,
  -- queued | sent | delivered | opened | clicked | bounced | complained | failed
  status       text NOT NULL DEFAULT 'queued',
  provider_id  text,
  error        text,
  sent_at      timestamptz,
  delivered_at timestamptz,
  opened_at    timestamptz,
  clicked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx
  ON campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS campaign_recipients_provider_idx
  ON campaign_recipients (provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_contact
  ON campaign_recipients (campaign_id, contact_id);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_subscribed_at timestamptz;

-- Consent from the booking form. NULL means "the form did not ask" or "the box
-- was left unticked": neither may unsubscribe somebody who said yes before.
--
-- The 6-argument overload has to go first: with a DEFAULT on the new seventh
-- argument, both versions would match today's 6-argument calls and Postgres
-- would refuse to pick one.
DROP FUNCTION IF EXISTS public.upsert_contact(text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_language text DEFAULT 'en',
  p_gender text DEFAULT NULL,
  p_newsletter boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language, gender,
                        newsletter_subscribed, newsletter_subscribed_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END)
  ON CONFLICT (email) DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    phone              = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    gender             = COALESCE(EXCLUDED.gender, contacts.gender),
    newsletter_subscribed = CASE WHEN p_newsletter THEN true
                                 ELSE contacts.newsletter_subscribed END,
    newsletter_subscribed_at = CASE WHEN p_newsletter AND NOT COALESCE(contacts.newsletter_subscribed, false)
                                    THEN now() ELSE contacts.newsletter_subscribed_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- One Resend callback, applied once. Moves the recipient forward only, and
-- bumps the campaign counter only when the row actually moved, so retries and
-- out-of-order deliveries cannot double count.
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  p_provider_id text,
  p_event text,        -- delivered | opened | clicked | bounced | complained
  p_at timestamptz,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row campaign_recipients%ROWTYPE;
  v_rank_now int;
  v_rank_new int;
BEGIN
  SELECT * INTO v_row FROM campaign_recipients WHERE provider_id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Terminal states never move again.
  IF v_row.status IN ('bounced', 'complained', 'failed') THEN RETURN false; END IF;

  v_rank_now := CASE v_row.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4 ELSE 0 END;
  v_rank_new := CASE p_event
    WHEN 'delivered' THEN 2 WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 9 WHEN 'complained' THEN 9 ELSE 0 END;

  IF v_rank_new = 0 OR v_rank_new <= v_rank_now THEN RETURN false; END IF;

  UPDATE campaign_recipients SET
    status = p_event,
    error = COALESCE(p_error, error),
    delivered_at = CASE WHEN p_event IN ('delivered','opened','clicked') THEN COALESCE(delivered_at, p_at) ELSE delivered_at END,
    opened_at    = CASE WHEN p_event IN ('opened','clicked') THEN COALESCE(opened_at, p_at) ELSE opened_at END,
    clicked_at   = CASE WHEN p_event = 'clicked' THEN COALESCE(clicked_at, p_at) ELSE clicked_at END
  WHERE id = v_row.id;

  -- Counters are "reached at least this state": a click implies an open and a
  -- delivery, so an opened row that jumps to clicked bumps only clicked, while
  -- a sent row that jumps straight to clicked bumps all three.
  UPDATE campaigns SET
    delivered_count  = delivered_count  + CASE WHEN v_rank_new >= 2 AND v_rank_now < 2 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    opened_count     = opened_count     + CASE WHEN v_rank_new >= 3 AND v_rank_now < 3 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    clicked_count    = clicked_count    + CASE WHEN v_rank_new >= 4 AND v_rank_now < 4 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    bounced_count    = bounced_count    + CASE WHEN p_event = 'bounced' THEN 1 ELSE 0 END,
    complained_count = complained_count + CASE WHEN p_event = 'complained' THEN 1 ELSE 0 END
  WHERE id = v_row.campaign_id;

  IF p_event IN ('bounced', 'complained') AND v_row.contact_id IS NOT NULL THEN
    UPDATE contacts SET email_bounced_at = COALESCE(email_bounced_at, p_at)
    WHERE id = v_row.contact_id;
  END IF;

  RETURN true;
END;
$function$;
