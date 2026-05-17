CREATE TABLE memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  email       text,
  phone       text,
  plan        text NOT NULL DEFAULT 'basic',
  status      text NOT NULL DEFAULT 'active',
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memberships_status_idx ON memberships (status);
CREATE INDEX memberships_plan_idx ON memberships (plan);

CREATE OR REPLACE FUNCTION update_memberships_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_memberships_updated_at();
