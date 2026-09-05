-- Remember an unsubscribe as an unsubscribe.
--
-- `newsletter_subscribed = false` means two different things: "never asked"
-- and "asked to be left alone". Campaigns may go to the first group (the
-- centre writes to its clients) but never to the second, and the footer link
-- of every campaign email must actually work. One timestamp tells them apart;
-- saying yes again clears it.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at timestamptz;

-- Backfill: whoever is not subscribed today but was once on the Resend list
-- cannot be told apart from "never asked", so nobody is backfilled. From now
-- on the unsubscribe page writes the column.

-- A yes from the booking form clears an earlier no.
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_language text DEFAULT 'en',
  p_gender text DEFAULT NULL,
  p_newsletter boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language, gender,
                        newsletter_subscribed, newsletter_subscribed_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END)
  ON CONFLICT (email) DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    phone              = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    gender             = COALESCE(EXCLUDED.gender, contacts.gender),
    newsletter_subscribed = CASE WHEN p_newsletter THEN true
                                 ELSE contacts.newsletter_subscribed END,
    newsletter_subscribed_at = CASE WHEN p_newsletter AND NOT COALESCE(contacts.newsletter_subscribed, false)
                                    THEN now() ELSE contacts.newsletter_subscribed_at END,
    newsletter_unsubscribed_at = CASE WHEN p_newsletter THEN NULL
                                      ELSE contacts.newsletter_unsubscribed_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
