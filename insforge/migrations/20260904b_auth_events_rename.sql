-- `login_events` was never only about logging in.
--
-- It already carried `unlocked`, which is somebody following a link in an
-- email, and it is about to carry the password-reset attempts too: the code
-- requests and the wrong codes, which are the same brute force in a different
-- doorway. A table named for one of the doors it watches invites the next
-- person to build a second one beside it.
--
-- Renamed while it is empty, so nothing moves but the name.
ALTER TABLE IF EXISTS login_events RENAME TO auth_events;

ALTER INDEX IF EXISTS login_events_email_idx RENAME TO auth_events_email_idx;
ALTER INDEX IF EXISTS login_events_ip_idx    RENAME TO auth_events_ip_idx;
