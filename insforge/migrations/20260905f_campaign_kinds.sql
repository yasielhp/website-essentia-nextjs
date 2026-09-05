-- Beyond the one-off send: campaigns that run on their own.
--
-- `kind` says what the campaign is (standard, automated, autoresponder, split,
-- rss, dateBased) and `trigger` holds the kind's settings — which event, how
-- many days. An automated campaign is `active` rather than `sent`: the cron
-- evaluates it every run and mails whoever newly qualifies, once per `cycle`.
-- The cycle is "" for one-shot rules, the year for a birthday, the post id for
-- a blog announcement, so the unique index turns "did we already send this to
-- them for this occasion" into one insert.
--
-- `vars` carries per-recipient template values (a blog post's title and URL);
-- `variant` marks which half of an A/B test a recipient fell into.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS cycle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS vars jsonb;

DROP INDEX IF EXISTS campaign_recipients_unique_email;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_email
  ON campaign_recipients (campaign_id, email, cycle);

-- For date-based campaigns. Optional; staff fill it in when the client shares it.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthdate date;
