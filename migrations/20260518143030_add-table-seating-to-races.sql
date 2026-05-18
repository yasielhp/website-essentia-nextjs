-- Add seats_per_table to races (default 6 seats per table)
ALTER TABLE races ADD COLUMN IF NOT EXISTS seats_per_table INTEGER DEFAULT 6;

-- Add table_number and check-in tracking to race_registrations
ALTER TABLE race_registrations
  ADD COLUMN IF NOT EXISTS table_number INTEGER,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Auto-assign table number on insert based on registration order
CREATE OR REPLACE FUNCTION assign_table_number()
RETURNS TRIGGER AS $$
DECLARE
  v_seats_per_table INTEGER;
  v_reg_index       INTEGER;
BEGIN
  SELECT COALESCE(seats_per_table, 6)
    INTO v_seats_per_table
    FROM races
   WHERE id = NEW.race_id;

  SELECT COUNT(*) + 1
    INTO v_reg_index
    FROM race_registrations
   WHERE race_id = NEW.race_id;

  NEW.table_number := CEIL(v_reg_index::FLOAT / v_seats_per_table);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assign_table_number ON race_registrations;
CREATE TRIGGER tr_assign_table_number
  BEFORE INSERT ON race_registrations
  FOR EACH ROW
  EXECUTE FUNCTION assign_table_number();