-- NOT APPLIED. For the owner to decide, then apply when deploying.
--
-- booking_events was created without RLS ("read only through the service
-- key"), but with RLS off the anon key can read it too. Its `summary` carries
-- the client's name and the date of the booking, and `recipient` a client's
-- full phone number or email.
--
-- Every reader and writer in the code uses getAdminClient() (the service key,
-- which bypasses RLS), so turning RLS on with no policies changes nothing for
-- the app and closes the anon read. See the grep in the commit message that
-- added this file: app/actions/booking-events.ts:36, app/lib/booking-events/
-- record.ts:42, app/api/webhooks/whatsapp/route.ts:504, app/api/webhooks/
-- resend/route.ts:165, app/api/[transport]/tools/bookings.ts:169 (MCP) and
-- app/services/booking-payments.service.ts:57. No SQL function, view or
-- trigger reads it (only the migration that creates it mentions it).
--
-- Rollback: ALTER TABLE booking_events DISABLE ROW LEVEL SECURITY;

BEGIN;

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

COMMIT;
