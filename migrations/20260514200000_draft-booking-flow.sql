-- date y time son nullable en drafts (aún no seleccionados)
ALTER TABLE bookings ALTER COLUMN date DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN time DROP NOT NULL;

-- Crea un draft booking y devuelve el UUID
CREATE OR REPLACE FUNCTION public.create_draft_booking(
  p_contact_id   UUID,
  p_user_id      UUID,
  p_service_id   TEXT,
  p_service_title TEXT,
  p_duration     TEXT,
  p_first_name   TEXT,
  p_last_name    TEXT,
  p_email        TEXT,
  p_phone        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO bookings (
    contact_id, user_id, service_id, service_title, duration,
    first_name, last_name, email, phone, status
  ) VALUES (
    p_contact_id, p_user_id, p_service_id, p_service_title, p_duration,
    p_first_name, p_last_name, p_email, p_phone, 'draft'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Actualiza fecha y hora de un draft
CREATE OR REPLACE FUNCTION public.update_booking_datetime(
  p_booking_id UUID,
  p_date       DATE,
  p_time       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE bookings
  SET date = p_date, time = p_time
  WHERE id = p_booking_id AND status = 'draft';
END;
$$;

-- Confirma un draft → pasa a pending
CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE bookings
  SET status = 'pending'
  WHERE id = p_booking_id AND status = 'draft';
END;
$$;
