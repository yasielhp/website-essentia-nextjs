-- An unsubscribe link that only works for its own recipient.
--
-- The unsubscribe page took the address straight from the query string and
-- handed it to a public Server Action, so anyone who knew — or guessed — an
-- address could take that person off the list. An email address is not a
-- secret; it is printed on business cards.
--
-- Same shape as `bookings.cancel_token`: a random uuid that *is* the
-- credential, handed out only in the link, and resolvable to exactly one row.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS contacts_unsubscribe_token_key
  ON contacts (unsubscribe_token);
