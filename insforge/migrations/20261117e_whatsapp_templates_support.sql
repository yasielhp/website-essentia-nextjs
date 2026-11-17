-- Plantillas que Meta tiene y nosotros no sabemos enviar. El sync las guarda
-- con su motivo en lugar de saltarlas, para que el admin las vea marcadas.
-- `unsupported_reason` es NULL cuando el cliente puede enviarla (ver
-- templateSupport en app/lib/whatsapp/templates.ts); si no, uno de:
-- media_header | header_variable | named_params | button_type.
-- El selector de campañas filtra status = 'APPROVED' AND unsupported_reason IS NULL.
-- Una sola sentencia: el CLI de Insforge no admite BEGIN/COMMIT.
ALTER TABLE whatsapp_templates
  ADD COLUMN IF NOT EXISTS header_format text,
  ADD COLUMN IF NOT EXISTS unsupported_reason text;
