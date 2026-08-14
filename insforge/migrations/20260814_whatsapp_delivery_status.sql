-- What Meta did with the message after it accepted it.
--
-- `status = 'sent'` only ever meant "the Cloud API took it", and that is where
-- the trail went cold: a number without WhatsApp, a template Meta throttles per
-- recipient, or a block on the business number all produce a `wamid` and then
-- silence. Those outcomes arrive on the status webhook and nowhere else, so
-- until now nothing in the centre could tell a delivered notification from one
-- that never reached a handset.
--
-- The lifecycle is carried by the existing `status` column rather than a second
-- one beside it — the dashboard already reads it, and a professional wants one
-- answer, not two. It now runs:
--
--   skipped | sent → delivered → read
--                  ↳ failed  (with `error` holding Meta's own words)
--
-- `provider_id` is how a callback finds its row, hence the index: it is the
-- `wamid` we stored at send time and the only id Meta quotes back.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_messages_provider_idx
  ON whatsapp_messages (provider_id);
