-- A login that remembers what happened to it.
--
-- `signInWithPassword` handed the email and the password to the SDK and
-- returned whatever came back. Nothing counted the failures, nothing recorded
-- them, and the Zod check lived only in the browser — where it protects
-- nobody, because a Server Action is an HTTP endpoint anyone can call.
--
-- Two tables, split by lifetime. `login_events` is the trail: append-only, one
-- row per attempt, never updated. `account_locks` is state: one live row per
-- address, updated and deleted. Keeping the counter inside the trail means the
-- count and the audit can never disagree — there is only one set of facts.

-- Every attempt to sign in, successful or not.
CREATE TABLE IF NOT EXISTS login_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Already lowercased by the caller. The address is the key, not the user:
  -- an attempt against an address nobody owns still has to be counted, or the
  -- IP ceiling is the only thing standing between an attacker and a list of
  -- which addresses exist.
  email      text NOT NULL,
  -- Set only when the address resolved to somebody. Kept if they later leave.
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- From `x-forwarded-for`. Null in local development, where there is no proxy
  -- in front and no ceiling worth enforcing.
  ip         inet,
  user_agent text,

  -- success       — the password was right
  -- bad_password  — the address exists, the password did not match
  -- unknown_email — nobody owns that address
  -- locked        — turned away at the door, the SDK was never called
  -- rate_limited  — the IP had already spent its allowance
  -- unlocked      — somebody followed the link in the email
  outcome    text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- The count for one account: failures since that address last succeeded.
CREATE INDEX IF NOT EXISTS login_events_email_idx
  ON login_events (email, created_at DESC);

-- The count for one connection: failures from that address in the last window.
CREATE INDEX IF NOT EXISTS login_events_ip_idx
  ON login_events (ip, created_at DESC);

-- The accounts currently shut, and the token that opens them.
--
-- One row per address rather than per user, for the same reason the trail is
-- keyed that way: an address that fails five times has to be stopped whether
-- or not it belongs to anybody.
CREATE TABLE IF NOT EXISTS account_locks (
  email        text PRIMARY KEY,

  locked_at    timestamptz NOT NULL DEFAULT now(),
  -- Thirty minutes on. Without an expiry, anybody could shut a client out of
  -- their own account permanently with five wrong guesses, and a client whose
  -- mail never arrives would have to phone the clinic.
  expires_at   timestamptz NOT NULL,

  -- The credential itself, handed out only in the email — same shape as
  -- `contacts.unsubscribe_token` and `bookings.cancel_token`. Burnt on use:
  -- `unlocked_at` is what makes the link single-use.
  unlock_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unlocked_at  timestamptz,

  -- How many failures earned the lock. The email says the number out loud, so
  -- the account holder can tell a fat-fingered password from an attack.
  attempts     integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS account_locks_unlock_token_key
  ON account_locks (unlock_token);

-- No RLS on either table, like `booking_events`: they hold addresses and IPs,
-- and are only ever read through the service key.
