-- Every WhatsApp notification sent to a member of staff, sent or not.
--
-- The centre has no WhatsApp Business number yet, so the feature ships inert:
-- with no credentials configured, the row is still written with
-- `status = 'skipped'` and `body_preview` holds the text that would have gone
-- out. That is what lets the wording be signed off before Meta is involved,
-- and it becomes the delivery log once the number exists.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kept as a record even if the booking or the account is later removed.
  booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  staff_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- assigned | unassigned | rescheduled | cancelled
  event        text NOT NULL,
  to_phone     text NOT NULL,
  language     text NOT NULL DEFAULT 'es',
  -- The template parameters as sent, so a failed message can be replayed.
  params       jsonb NOT NULL,
  body_preview text NOT NULL,
  -- skipped | sent | failed
  status       text NOT NULL,
  error        text,
  -- The `wamid` Meta returns; null until a message actually leaves.
  provider_id  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_booking_idx
  ON whatsapp_messages (booking_id);

CREATE INDEX IF NOT EXISTS whatsapp_messages_created_idx
  ON whatsapp_messages (created_at DESC);
