DROP INDEX IF EXISTS bonus_plans_tier_name_idx;

-- A bonus is now identified by its session type and its number of sessions, and
-- its title is derived from the latter ("Bono de 5 sesiones"). The name column
-- on both tables goes, along with the unique index that included it; a new
-- unique index on (tier_id, sessions) keeps the seed in 20261103 idempotent.
ALTER TABLE bonus_plans DROP COLUMN IF EXISTS name;

ALTER TABLE contact_bonuses DROP COLUMN IF EXISTS name;

CREATE UNIQUE INDEX IF NOT EXISTS bonus_plans_tier_sessions_idx ON bonus_plans (tier_id, sessions);
