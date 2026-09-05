-- A segment is a set of audience conditions with a name, kept so the admin
-- picks "Clientes ES sin visita en 60 días" from a list instead of rebuilding
-- it for every campaign. The campaign still stores its own copy of the
-- conditions: a segment edited next month must not rewrite what last month's
-- campaign went to.
--
-- Same access shape as `campaigns`: RLS on, no policies, service key only.
CREATE TABLE IF NOT EXISTS campaign_segments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  -- The conditions half of `campaigns.audience` (no manual picks).
  conditions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_segments_unique_name
  ON campaign_segments (lower(trim(name)));

ALTER TABLE campaign_segments ENABLE ROW LEVEL SECURITY;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS segment_id uuid REFERENCES campaign_segments(id) ON DELETE SET NULL;
