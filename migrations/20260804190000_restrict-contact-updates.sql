-- Stop anonymous visitors from rewriting the contact directory.
--
-- The table shipped with:
--
--   CREATE POLICY "anyone_update_contacts" ON contacts
--     FOR UPDATE TO anon, authenticated USING (true);
--
-- No condition at all: anyone reaching the public site could overwrite the
-- name, email, phone, gender or status of every contact in the database. The
-- Server Action guards do not cover it, because the browser writes straight to
-- the table with the anon key.
--
-- Only one legitimate anonymous write exists — promoting a lead to a client
-- once they complete a booking — and it becomes a function below.

-- ── The one anonymous write, as a function ────────────────────────────────────
--
-- SECURITY DEFINER so it works without the open policy, and narrow on purpose:
-- it only ever moves a lead forward. Guarding on the current status matters now
-- that `member` exists — the booking flow used to run a bare
-- `UPDATE ... SET status = 'client'`, which would quietly demote a member the
-- moment they booked a session.
CREATE OR REPLACE FUNCTION public.promote_contact_to_client(
  p_contact_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contacts
  SET status = 'client',
      updated_at = NOW()
  WHERE id = p_contact_id
    AND (status IS NULL OR status = 'lead');
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_contact_to_client(UUID) TO anon, authenticated;

-- ── Close the open policy ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anyone_update_contacts" ON contacts;

-- Staff edit contacts from the dashboard, in the browser, so the policy has to
-- allow it. Same roles as the existing `admin_read_contacts`: partners never
-- reach the contact screens, and their bookings create contacts through
-- `upsert_contact`, which needs no policy of its own.
CREATE POLICY "staff_update_contacts" ON contacts
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

-- ── A note on INSERT ──────────────────────────────────────────────────────────
--
-- `anyone_insert_contacts` is left in place. Every public path already creates
-- contacts through `upsert_contact`, which is SECURITY DEFINER, so in principle
-- the policy could go too — but creating a row is far less damaging than
-- rewriting all of them, and revoking it risks breaking a path not found in the
-- audit. Worth revisiting once the booking and registration flows have been
-- watched in production for a while.
