-- Pago parcial al reservar (reunión 2026-11-02): la reserva guarda qué modo
-- eligió la clienta, cuánto ha pagado y cuándo se cobró el resto en el centro.
--
-- Compatible con el código ya desplegado: todas las columnas nuevas son
-- nullable o tienen default, y los valores de payment_status que escribe el
-- código actual (pending, paid, failed) siguen siendo válidos.

-- payment_status existe en la BD viva sin migración; se normaliza aquí.
UPDATE bookings SET payment_status = 'pending' WHERE payment_status IS NULL;
ALTER TABLE bookings
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending','deposit_paid','paid','failed','refunded'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS amount_paid_eur numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_settled_method text;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_mode_check
  CHECK (payment_mode IS NULL OR payment_mode IN ('deposit','full','bonus','none'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_balance_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_balance_method_check
  CHECK (balance_settled_method IS NULL OR balance_settled_method IN ('cash','card','transfer','other'));

-- Las reservas ya pagadas pagaron el importe completo.
UPDATE bookings SET amount_paid_eur = COALESCE(price_eur, 0), payment_mode = 'full'
  WHERE payment_status = 'paid' AND amount_paid_eur = 0;

COMMENT ON COLUMN bookings.payment_mode IS 'deposit | full | bonus | none — how the client chose to pay; null for rows older than 2026-11';
COMMENT ON COLUMN bookings.amount_paid_eur IS 'Sum actually collected so far (Redsys + counter). price_eur - amount_paid_eur is what is owed.';

-- Ajustes globales: una fila por clave. RLS sin políticas: solo el service key
-- lee y escribe.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings (key, value) VALUES
  ('payments', '{"depositPercent": 50, "fullPaymentDiscountPercent": 5, "requirePayment": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- La RPC de edición del dashboard necesita poder escribir el pago. Se reescribe
-- entera (misma firma) añadiendo las cinco claves a la lista blanca.
CREATE OR REPLACE FUNCTION update_booking_returning_previous(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
AS $fn$
  WITH previous AS (
    SELECT to_jsonb(b) AS snapshot
    FROM bookings b
    WHERE b.id = p_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE bookings SET
      service_id = CASE WHEN p_payload ? 'service_id'
        THEN p_payload->>'service_id' ELSE service_id END,
      service_title = CASE WHEN p_payload ? 'service_title'
        THEN p_payload->>'service_title' ELSE service_title END,
      tier_id = CASE WHEN p_payload ? 'tier_id'
        THEN NULLIF(p_payload->>'tier_id', '')::uuid ELSE tier_id END,
      price_eur = CASE WHEN p_payload ? 'price_eur'
        THEN NULLIF(p_payload->>'price_eur', '')::numeric ELSE price_eur END,
      duration = CASE WHEN p_payload ? 'duration'
        THEN p_payload->>'duration' ELSE duration END,
      date = CASE WHEN p_payload ? 'date'
        THEN NULLIF(p_payload->>'date', '')::date ELSE date END,
      time = CASE WHEN p_payload ? 'time'
        THEN p_payload->>'time' ELSE time END,
      location = CASE WHEN p_payload ? 'location'
        THEN p_payload->>'location' ELSE location END,
      location_address = CASE WHEN p_payload ? 'location_address'
        THEN p_payload->>'location_address' ELSE location_address END,
      staff_id = CASE WHEN p_payload ? 'staff_id'
        THEN NULLIF(p_payload->>'staff_id', '')::uuid ELSE staff_id END,
      notes = CASE WHEN p_payload ? 'notes'
        THEN p_payload->>'notes' ELSE notes END,
      first_name = CASE WHEN p_payload ? 'first_name'
        THEN p_payload->>'first_name' ELSE first_name END,
      last_name = CASE WHEN p_payload ? 'last_name'
        THEN p_payload->>'last_name' ELSE last_name END,
      email = CASE WHEN p_payload ? 'email'
        THEN p_payload->>'email' ELSE email END,
      phone = CASE WHEN p_payload ? 'phone'
        THEN p_payload->>'phone' ELSE phone END,
      status = CASE WHEN p_payload ? 'status'
        THEN p_payload->>'status' ELSE status END,
      payment_status = CASE WHEN p_payload ? 'payment_status'
        THEN p_payload->>'payment_status' ELSE payment_status END,
      payment_mode = CASE WHEN p_payload ? 'payment_mode'
        THEN NULLIF(p_payload->>'payment_mode', '') ELSE payment_mode END,
      amount_paid_eur = CASE WHEN p_payload ? 'amount_paid_eur'
        THEN COALESCE(NULLIF(p_payload->>'amount_paid_eur', '')::numeric, 0) ELSE amount_paid_eur END,
      balance_settled_at = CASE WHEN p_payload ? 'balance_settled_at'
        THEN NULLIF(p_payload->>'balance_settled_at', '')::timestamptz ELSE balance_settled_at END,
      balance_settled_method = CASE WHEN p_payload ? 'balance_settled_method'
        THEN NULLIF(p_payload->>'balance_settled_method', '') ELSE balance_settled_method END
    WHERE id = p_id AND EXISTS (SELECT 1 FROM previous)
    RETURNING 1
  )
  SELECT snapshot FROM previous
$fn$;
