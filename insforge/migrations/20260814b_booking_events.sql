-- Everything that happens to a booking, in one trail.
--
-- `whatsapp_messages` answered one question — was the professional told? — and
-- answered it well enough that the next question arrived immediately: who moved
-- this to Thursday, did the client ever get the confirmation, did the payment
-- land. None of that left a trace anywhere. Emails went to Resend and were
-- forgotten; a time change was visible only as the new time.
--
-- So the table generalises rather than gains a sibling. One row per thing that
-- happened, whatever the channel, ordered by when it happened:
--
--   whatsapp | email     — something was sent to somebody
--   system                — somebody changed the booking
--   payment | calendar    — something happened to it elsewhere
--
-- `summary` is written when the row is created, already worded. A history that
-- rebuilds its own text years later lies as soon as a template changes; this
-- one keeps what was said at the time.
--
-- `status` serves every channel. WhatsApp walks `sent → delivered → read` on
-- Meta's callbacks; email stops at `sent`, because Resend tells us no more
-- until its own webhook exists; a time change is born `done`.
--
-- No RLS, like the table it replaces: it holds staff phone numbers and client
-- addresses, and is read only through the service key, by a staff role.
CREATE TABLE IF NOT EXISTS booking_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kept as a record even if the booking is later removed.
  booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,

  -- whatsapp | email | system | payment | calendar
  channel      text NOT NULL,
  -- assigned | unassigned | rescheduled | cancelled | confirmed | received |
  -- created | edited | deleted | paid | failed | synced | removed
  event        text NOT NULL,

  -- Who caused it. Null when nobody did: a payment webhook, a client following
  -- a cancellation link, an anonymous booking.
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- admin | staff | partner | client | anonymous | system
  actor_role   text,

  -- Who it was sent to. Only ever set on `whatsapp` and `email`.
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- A phone in E.164, or an email address.
  recipient    text,

  -- skipped | sent | delivered | read | failed | done
  status       text NOT NULL,
  error        text,
  -- Meta's `wamid`, Resend's id, Redsys' order number.
  provider_id  text,

  -- The line a human reads.
  summary      text NOT NULL,
  -- What changed, or the template parameters as sent.
  payload      jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at      timestamptz
);

-- The trail of one booking, newest first: the only read this table gets.
CREATE INDEX IF NOT EXISTS booking_events_booking_idx
  ON booking_events (booking_id, created_at DESC);

-- How Meta's status callbacks find their row.
CREATE INDEX IF NOT EXISTS booking_events_provider_idx
  ON booking_events (provider_id);

-- The WhatsApp log moves across whole. `language` travels into the payload
-- rather than into a column of its own: it was only ever the one value the
-- template is registered in.
INSERT INTO booking_events (
  booking_id, channel, event, recipient_id, recipient,
  status, error, provider_id, summary, payload,
  created_at, delivered_at, read_at
)
SELECT
  booking_id, 'whatsapp', event, staff_id, to_phone,
  status, error, provider_id, body_preview,
  jsonb_build_object('params', params, 'language', language),
  created_at, delivered_at, read_at
FROM whatsapp_messages;

DROP TABLE whatsapp_messages;
