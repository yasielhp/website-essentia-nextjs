-- `upsert_contact` existed twice: the original four-argument version and the
-- five/six-argument one that 20260521150000 introduced. `CREATE OR REPLACE`
-- cannot replace a function whose signature changed, so it created a second
-- one and left the first behind.
--
-- PostgREST cannot choose between them, so every four-argument call answered
-- "Could not choose the best candidate function" — which is why bookings taken
-- from the dashboard were saved with no `contact_id` and a client's history
-- looked empty on their own page. The public flow and the MCP tool pass
-- `p_language`, so they matched the newer one and were never affected.
--
-- The newer function defaults both extra arguments, so dropping the old one
-- leaves four-argument callers working rather than broken.
DROP FUNCTION IF EXISTS public.upsert_contact(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT
);
