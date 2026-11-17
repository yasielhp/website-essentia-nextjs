-- A STOP is global and turning one use on clears it, so the OTHER use must not
-- come back to life on a consent given before the STOP.
--
-- Rule (the dashboard action setWhatsAppConsent applies the same one): with an
-- opt-out in force, activating a use (a) clears the opt-out, (b) stamps that
-- use with a NEW now(), because the consent is from today, and (c) sets the use
-- that was not activated to NULL. With no opt-out nothing changes from
-- 20261117f: the date is stamped only if it was empty and the other use is left
-- alone. Activating both after a STOP stamps both with now().
--
-- Written from the LIVE definition (pg_get_functiondef, 2026-11-17, after
-- 20261117f). In ON CONFLICT DO UPDATE SET every expression sees the OLD row,
-- so contacts.whatsapp_opted_out_at below is the opt-out as it stood before
-- this call, whatever order the assignments are written in. The 9-argument
-- signature is unchanged; no explicit ACL.
DROP FUNCTION IF EXISTS public.upsert_contact(text, text, text, text, text, text, boolean, boolean, boolean);
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
    whatsapp_opted_in_at = CASE
      WHEN COALESCE(p_whatsapp, false) THEN
        CASE WHEN contacts.whatsapp_opted_out_at IS NOT NULL THEN now()
             ELSE COALESCE(contacts.whatsapp_opted_in_at, now()) END
      WHEN COALESCE(p_whatsapp_marketing, false) AND contacts.whatsapp_opted_out_at IS NOT NULL THEN NULL
      ELSE contacts.whatsapp_opted_in_at END,
    whatsapp_marketing_opted_in_at = CASE
      WHEN COALESCE(p_whatsapp_marketing, false) THEN
        CASE WHEN contacts.whatsapp_opted_out_at IS NOT NULL THEN now()
             ELSE COALESCE(contacts.whatsapp_marketing_opted_in_at, now()) END
      WHEN COALESCE(p_whatsapp, false) AND contacts.whatsapp_opted_out_at IS NOT NULL THEN NULL
      ELSE contacts.whatsapp_marketing_opted_in_at END,
    whatsapp_opted_out_at = CASE WHEN COALESCE(p_whatsapp, false) OR COALESCE(p_whatsapp_marketing, false) THEN NULL
                                 ELSE contacts.whatsapp_opted_out_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
