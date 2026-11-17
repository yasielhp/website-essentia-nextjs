-- WhatsApp consent on upsert_contact (plan Task 7).
--
-- Written from the LIVE definition (pg_get_functiondef, 2026-11-17), which
-- already clears newsletter_unsubscribed_at on re-subscription. The only change
-- is the new p_whatsapp parameter and the two whatsapp_* columns.
--
-- Same rule as the newsletter: ticked stamps whatsapp_opted_in_at (only if it was
-- empty) and clears an earlier opt-out; unticked/NULL touches nothing. Only a
-- STOP/BAJA reply or the dashboard toggle ever opts a contact out.
--
-- DROP + CREATE in one statement batch: Postgres runs a multi-statement string
-- in one implicit transaction, so the function is never missing. The old
-- 7-argument signature goes away (it would be ambiguous with the new one), but
-- callers that name their arguments (PostgREST) keep working through the
-- defaults. The function had no explicit ACL, so the new one keeps the same.
DROP FUNCTION IF EXISTS public.upsert_contact(text, text, text, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text, p_first_name text, p_last_name text, p_phone text,
  p_language text DEFAULT 'en'::text, p_gender text DEFAULT NULL::text,
  p_newsletter boolean DEFAULT NULL::boolean, p_whatsapp boolean DEFAULT NULL::boolean
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
                        newsletter_subscribed, newsletter_subscribed_at, whatsapp_opted_in_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END,
          CASE WHEN p_whatsapp THEN now() ELSE NULL END)
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
    whatsapp_opted_out_at = CASE WHEN p_whatsapp THEN NULL
                                 ELSE contacts.whatsapp_opted_out_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
