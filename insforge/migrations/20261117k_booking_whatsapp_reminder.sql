-- WhatsApp reminder to the client, step 21: one stamp per booking, separate
-- from `reminder_sent_at` (the email's), so the two reminders are independent:
-- switching the email reminder off does not switch the WhatsApp one off, and
-- the cron claims this column with a conditional UPDATE before it sends, so two
-- overlapping runs cannot message the same client twice.
-- Additive and nullable: existing rows are untouched.
-- Rollback: ALTER TABLE bookings DROP COLUMN whatsapp_reminder_sent_at;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at timestamptz;
