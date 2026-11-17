-- A second WhatsApp consent: marketing (plan, "Decisiones tomadas durante la
-- ejecucion").
--
-- whatsapp_opted_in_at covers the booking confirmation and reminder, which is
-- all the public checkbox promises. News and offers need their own opt-in
-- (separate purposes under the GDPR, a specific opt-in for Meta's MARKETING
-- templates), so they get their own column and their own checkbox.
-- whatsapp_opted_out_at stays one column: a STOP blocks both uses.
--
-- upsert_contact is written from the LIVE definition (pg_get_functiondef,
-- 2026-11-17, after 20261117b). Same rule per purpose as the newsletter: ticked
-- stamps the date once and clears an earlier opt-out, null touches nothing.
-- The 8-argument signature goes away; callers that name their arguments keep
-- working through the defaults. No explicit ACL, so the new function has none.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opted_in_at timestamptz;
DROP FUNCTION IF EXISTS public.upsert_contact(text, text, text, text, text, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text, p_first_name text, p_last_name text, p_phone text,
  p_language text DEFAULT 'en'::text, p_gender text DEFAULT NULL::text,
  p_newsletter boolean DEFAULT NULL::boolean, p_whatsapp boolean DEFAULT NULL::boolean,
  p_whatsapp_marketing boolean DEFAULT NULL::boolean
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
                        newsletter_subscribed, newsletter_subscribed_at,
                        whatsapp_opted_in_at, whatsapp_marketing_opted_in_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END,
          CASE WHEN p_whatsapp THEN now() ELSE NULL END,
          CASE WHEN p_whatsapp_marketing THEN now() ELSE NULL END)
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
    whatsapp_opted_in_at = CASE WHEN p_whatsapp AND contacts.whatsapp_opted_in_at IS NULL
                                THEN now() ELSE contacts.whatsapp_opted_in_at END,
    whatsapp_marketing_opted_in_at = CASE WHEN p_whatsapp_marketing AND contacts.whatsapp_marketing_opted_in_at IS NULL
                                          THEN now() ELSE contacts.whatsapp_marketing_opted_in_at END,
    whatsapp_opted_out_at = CASE WHEN COALESCE(p_whatsapp, false) OR COALESCE(p_whatsapp_marketing, false) THEN NULL
                                 ELSE contacts.whatsapp_opted_out_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
