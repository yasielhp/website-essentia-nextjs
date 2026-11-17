-- WhatsApp campaigns, step 1: a channel per campaign and a phone per recipient.
-- Additive. campaign_recipients was empty when this ran (2026-11-17), and the
-- default channel is 'email', so the Resend webhook behaves exactly as before.
-- `language` stays NOT NULL: WhatsApp rows must still fill it.
-- Rollback of the function: restore the pre-change definition (it only differs
-- in the channel mapping, read_at and the email_bounced_at guard).

BEGIN;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email'; -- email | whatsapp

-- A WhatsApp recipient is a phone; email may be absent for walk-in clients.
ALTER TABLE campaign_recipients
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Not partial on purpose: the SDK's onConflict names columns only and cannot
-- target a partial index. Postgres never treats two NULLs as equal, so the
-- email rows (phone NULL) are not affected.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_phone_cycle
  ON campaign_recipients (campaign_id, phone, cycle);

-- Written from the LIVE definition (scratchpad fn-record_campaign_event.txt).
-- Two changes: Meta's `read`/`failed` map onto `opened`/`bounced` for WhatsApp
-- campaigns, and `email_bounced_at` is stamped only for email campaigns: a
-- number without WhatsApp says nothing about the inbox.
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  p_provider_id text, p_event text, p_at timestamptz, p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_row campaign_recipients%ROWTYPE;
  v_channel text;
  v_event text;
  v_rank_now int;
  v_rank_new int;
BEGIN
  SELECT * INTO v_row FROM campaign_recipients WHERE provider_id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT channel INTO v_channel FROM campaigns WHERE id = v_row.campaign_id;
  v_event := CASE
    WHEN v_channel = 'whatsapp' AND p_event = 'read'   THEN 'opened'
    WHEN v_channel = 'whatsapp' AND p_event = 'failed' THEN 'bounced'
    ELSE p_event END;

  -- Terminal states never move again.
  IF v_row.status IN ('bounced', 'complained', 'failed') THEN RETURN false; END IF;

  v_rank_now := CASE v_row.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4 ELSE 0 END;
  v_rank_new := CASE v_event
    WHEN 'delivered' THEN 2 WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 9 WHEN 'complained' THEN 9 ELSE 0 END;

  IF v_rank_new = 0 OR v_rank_new <= v_rank_now THEN RETURN false; END IF;

  UPDATE campaign_recipients SET
    status = v_event,
    error = COALESCE(p_error, error),
    delivered_at = CASE WHEN v_event IN ('delivered','opened','clicked') THEN COALESCE(delivered_at, p_at) ELSE delivered_at END,
    opened_at    = CASE WHEN v_event IN ('opened','clicked') THEN COALESCE(opened_at, p_at) ELSE opened_at END,
    read_at      = CASE WHEN v_channel = 'whatsapp' AND p_event = 'read' THEN COALESCE(read_at, p_at) ELSE read_at END,
    clicked_at   = CASE WHEN v_event = 'clicked' THEN COALESCE(clicked_at, p_at) ELSE clicked_at END
  WHERE id = v_row.id;

  -- Counters are "reached at least this state": a click implies an open and a
  -- delivery, so an opened row that jumps to clicked bumps only clicked, while
  -- a sent row that jumps straight to clicked bumps all three.
  UPDATE campaigns SET
    delivered_count  = delivered_count  + CASE WHEN v_rank_new >= 2 AND v_rank_now < 2 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    opened_count     = opened_count     + CASE WHEN v_rank_new >= 3 AND v_rank_now < 3 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    clicked_count    = clicked_count    + CASE WHEN v_rank_new >= 4 AND v_rank_now < 4 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    bounced_count    = bounced_count    + CASE WHEN v_event = 'bounced' THEN 1 ELSE 0 END,
    complained_count = complained_count + CASE WHEN v_event = 'complained' THEN 1 ELSE 0 END
  WHERE id = v_row.campaign_id;

  IF v_event IN ('bounced', 'complained')
     AND v_channel IS DISTINCT FROM 'whatsapp'
     AND v_row.contact_id IS NOT NULL THEN
    UPDATE contacts SET email_bounced_at = COALESCE(email_bounced_at, p_at)
    WHERE id = v_row.contact_id;
  END IF;

  RETURN true;
END; $function$;

COMMIT;
