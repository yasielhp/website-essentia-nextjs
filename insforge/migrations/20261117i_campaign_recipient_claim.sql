-- WhatsApp campaigns, step 12b: a recipient is claimed before its message is
-- sent. The sender moves a row queued -> sending (stamping claimed_at) with a
-- conditional UPDATE, so two processes cannot both send to it, and a row left
-- in `sending` by a killed process is told apart from one still being sent:
-- a resume fails those older than ten minutes as "[unconfirmed] interrupted"
-- (the message may have gone out, so it is never sent again on its own).
-- campaign_recipients was empty when this ran (2026-11-17). There is no status
-- CHECK on the table, so `sending` needs no constraint change.
-- Rollback: ALTER TABLE campaign_recipients DROP COLUMN claimed_at;

BEGIN;

ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMIT;
