-- Allow `member` as a contact status.
--
-- The three values now form the lifecycle the dashboard already shows in its
-- Role column:
--
--   lead    started a booking and never finished
--   client  has booked
--   member  entitled to a subscription
--
-- `member` is what the "Add user" form assigns when Member is chosen, and it is
-- the list the subscription form draws from. It is deliberately separate from
-- the `memberships` table: being marked a member says this person may hold a
-- subscription, while a row in `memberships` is the subscription itself.

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IS NULL OR status IN ('lead', 'client', 'member'));
