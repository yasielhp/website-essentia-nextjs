# Campañas de email desde el dashboard

**Fecha:** 2026-09-05
**Estado:** diseño validado, listo para implementar

## El problema

El centro no tiene forma de escribir a sus clientes en bloque. Los emails que
salen hoy son todos transaccionales — una reserva, un recordatorio, una
cancelación — y cada uno lo dispara un evento, no una persona. Si Yuli quiere
anunciar un horario nuevo, una promoción de otoño o la apertura en Baobab
Suites, tiene que hacerlo a mano desde Gmail o no hacerlo.

Lo que hace falta es una sección del dashboard donde el administrador elija a
quién escribe (por idioma, por servicio reservado, por tiempo sin venir), redacte
el mensaje en los dos idiomas, lo programe o lo envíe, y después vea qué pasó:
cuántos llegaron, cuántos rebotaron, cuántos lo abrieron.

## Lo que ya existe y se reutiliza

- `sendEmailBatch` en `app/emails/send.ts`: `resend.batch.send` en lotes de 100.
- Webhook firmado de Resend en `app/api/webhooks/resend/route.ts`, que hoy
  solo actualiza `booking_events`.
- `contacts` con `newsletter_subscribed`, `preferred_language`, `gender` y
  `unsubscribe_token`; página pública `/newsletter/unsubscribe` por token.
- `emailBase()` y los helpers de `app/emails/templates/_base.ts`.
- Crons en `vercel.json` protegidos por `CRON_SECRET`.
- Formularios de 3 pasos en `dashboard/bookings/new` como patrón de UI.

Estado de los datos el día del diseño: 104 contactos, 27 en español, **0 con
`newsletter_subscribed = true`**.

## Qué cubre Resend y qué no

| Necesidad                                           | Resend           | Cómo                                                                                                    |
| --------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| Envío masivo                                        | Sí               | `batch.send`, 100 por petición, 2 peticiones/s                                                          |
| Entregado, rebotado, spam, abierto, clic            | Sí, vía webhook  | `email.delivered`, `bounced`, `complained`, `opened`, `clicked`. Traen `tags` y `email_id`              |
| Programar                                           | Sí               | `scheduledAt`, pero cancelar obliga a anular cada email                                                 |
| Condiciones sobre reservas, servicio, última visita | **No**           | Resend solo segmenta por propiedades de su Audience; no ve `bookings`. La segmentación vive en Insforge |
| Estadísticas agregadas por campaña                  | Solo en su panel | Por API lo fiable es agregar los webhooks nosotros                                                      |
| Baja                                                | Sí               | Cabecera `List-Unsubscribe` + nuestro token                                                             |

## Decisiones tomadas

| Decisión                     | Elegido                                                                       | Por qué                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dónde vive el envío          | Segmentación en Insforge + `batch.send` con `tags` + webhook propio           | Control total sobre las condiciones, cero sincronización de contactos, reutiliza webhook, token de baja y batch existentes. Resend Broadcasts queda sin usar |
| Universo de destinatarios    | Todos los contactos, con la casilla de newsletter como filtro opcional        | Decisión del cliente. Se añade la casilla en todos los formularios que faltan para que el consentimiento empiece a acumularse                                |
| Redacción del contenido      | Bloques estructurados (asunto, título, cuerpo, imagen, botón) en EN y ES      | Siempre en marca, nunca se rompe en Gmail/Outlook, sin editor pesado. HTML crudo o Tiptap descartados                                                        |
| Condiciones en V1            | Idioma, newsletter, servicio reservado, última reserva, nunca reservó, manual | Las que responden a las campañas reales del centro. Género, origen y ubicación caben luego sin cambiar esquema porque las condiciones son JSON               |
| Cuándo se envía              | Inmediato + programado con cron propio cada 15 min                            | Cancelar una programada es cambiar un estado. `scheduledAt` de Resend obligaría a anular 100 emails uno a uno                                                |
| Fuente de verdad de la lista | `contacts`, no la Audience de Resend                                          | `newsletter.ts` sigue igual para no tocar el footer, pero deja de ser necesario para campañas                                                                |

Fuera de esta versión: automatizaciones (30 días sin reservar, cumpleaños),
A/B de asunto, doble opt-in, condiciones de género/origen/ubicación, casilla en
el formulario de contacto público y en la herramienta MCP `create_booking`.

## Datos

Migración `insforge/migrations/20260905_campaigns.sql`. Sin RLS, como
`booking_events`: se lee solo con service key desde acciones restringidas a
`admin`.

### `campaigns`

| columna                                                                                                                     | tipo          | para qué                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `id`                                                                                                                        | uuid PK       |                                                                           |
| `name`                                                                                                                      | text          | nombre interno, no lo ve el cliente                                       |
| `status`                                                                                                                    | text          | `draft` · `scheduled` · `sending` · `sent` · `cancelled` · `failed`       |
| `audience`                                                                                                                  | jsonb         | condiciones + ids manuales, ver abajo                                     |
| `content`                                                                                                                   | jsonb         | `{ en: {...}, es: {...} }`, ver "Contenido"                               |
| `scheduled_at`, `sent_at`                                                                                                   | timestamptz   |                                                                           |
| `created_by`                                                                                                                | uuid          | FK `auth.users`, `ON DELETE SET NULL`                                     |
| `created_at`, `updated_at`                                                                                                  | timestamptz   |                                                                           |
| `recipients_count`, `delivered_count`, `opened_count`, `clicked_count`, `bounced_count`, `complained_count`, `failed_count` | int default 0 | contadores desnormalizados que mantiene el webhook; el panel lee una fila |

Forma de `audience`:

```json
{
  "language": "any | en | es",
  "newsletter": null | true,
  "services": ["massage", "..."],
  "lastBooking": null | { "op": "gt" | "lt", "days": 60 },
  "neverBooked": false,
  "manualIds": ["uuid", "..."]
}
```

### `campaign_recipients`

Una fila por destinatario, escrita al enviar. Es la audiencia congelada.

| columna                                              | tipo        | para qué                                                                                     |
| ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `id`                                                 | uuid PK     |                                                                                              |
| `campaign_id`                                        | uuid        | FK `campaigns`, `ON DELETE CASCADE`                                                          |
| `contact_id`                                         | uuid        | FK `contacts`, `ON DELETE SET NULL`                                                          |
| `email`                                              | text        | tal y como se envió                                                                          |
| `language`                                           | text        | la versión que recibió                                                                       |
| `status`                                             | text        | `queued` · `sent` · `delivered` · `opened` · `clicked` · `bounced` · `complained` · `failed` |
| `provider_id`                                        | text        | id de Resend; así el webhook encuentra la fila                                               |
| `error`                                              | text        |                                                                                              |
| `sent_at`, `delivered_at`, `opened_at`, `clicked_at` | timestamptz |                                                                                              |

Índices: `(campaign_id, status)`, `(provider_id)`, único `(campaign_id, contact_id)`
para que reenviar no duplique.

### `contacts`, dos columnas nuevas

| columna                    | para qué                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `email_bounced_at`         | lo pone el webhook en rebote duro o queja. Excluido de toda campaña hasta que el staff lo limpie a mano |
| `newsletter_subscribed_at` | cuándo consintió. Prueba RGPD                                                                           |

### RPC

- `upsert_contact` gana `p_newsletter boolean DEFAULT NULL`: `true` marca y
  sella `newsletter_subscribed_at`; `NULL` no toca nada. Nunca pone `false`.
- `record_campaign_event(p_provider_id, p_event, p_at, p_error)`: actualiza la
  fila de `campaign_recipients` solo si el estado avanza
  (`sent < delivered < opened < clicked`; `bounced` y `complained` son
  terminales) y, solo si actualizó, incrementa el contador correspondiente en
  `campaigns`. Los reintentos de Resend no cuentan dos veces. En rebote o queja
  sella también `contacts.email_bounced_at`.

## Segmentación

`app/lib/campaigns/audience.ts`, módulo de servidor sin `"use server"`, exporta
`resolveAudience(audience): Promise<Recipient[]>`.

Dos consultas: una a `contacts` con los filtros simples (idioma, newsletter,
`email_bounced_at IS NULL`, email no nulo) y otra agregada a `bookings` por
`contact_id` que devuelve `last_booking_date`, `service_ids[]` y
`bookings_count`. Los filtros de reservas se aplican en TypeScript sobre las
dos listas. Sin SQL dinámico ni funciones nuevas; si algún día duele, se mueve
a un RPC con la misma firma.

Reglas fijas, no configurables:

- Excluidos siempre: sin email, con `email_bounced_at`, y quienes se dieron de
  baja cuando la campaña pide `newsletter: true`.
- Solo cuentan reservas con `status` distinto de `cancelled`.
- Idioma del destinatario: `contacts.preferred_language`, fallback `en`. Una
  campaña "solo ES" deja fuera a los `en`.
- La selección manual se **une** al resultado del filtro, nunca lo sustituye, y
  respeta las exclusiones fijas.
- Deduplicación por email en minúsculas.

Vista previa: la acción `previewAudience(accessToken, audience)` devuelve
`{ count, byLanguage: { en, es }, sample }` con los primeros 20. Mismo
`resolveAudience` que usa el envío, así lo que el admin ve es lo que sale.

La audiencia se congela al enviar, no al programar: una campaña programada se
resuelve en el cron para incluir contactos nuevos.

## Contenido

Plantilla `app/emails/templates/campaign.ts`, función que devuelve HTML string
envuelta en `emailBase()` con `locale`.

Por idioma (`content.en` / `content.es`):

| campo                | reglas                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `subject`            | obligatorio, máx. 120                                                                                                  |
| `preheader`          | opcional, máx. 150                                                                                                     |
| `title`              | obligatorio                                                                                                            |
| `body`               | texto plano. Línea en blanco = párrafo, `**negrita**`, `[texto](url)` = enlace. Parser propio, todo lo demás se escapa |
| `imageUrl`           | opcional, ancho completo bajo el título. Subida a Insforge Storage desde el formulario o URL pegada. Solo `https://`   |
| `ctaText` + `ctaUrl` | opcionales, los dos o ninguno. Botón `rounded-full` petroleum-700. Solo `https://`                                     |

Variable `{{first_name}}` en asunto, título y cuerpo; sin nombre, "Hola".

Pie fijo, no editable, en el idioma del destinatario: "Recibes este email
porque eres cliente de Essentia. Darse de baja", con enlace
`/newsletter/unsubscribe?token=<unsubscribe_token>`. Cada email lleva además la
cabecera `List-Unsubscribe` con esa URL; Gmail y Apple Mail muestran su propio
botón de baja, mejor para la reputación que el clic en "spam".

Validación con `campaignContentSchema` en `app/lib/schemas.ts`. Una campaña
"solo ES" exige solo `es`; "ambos" exige los dos.

Vista previa en el dashboard: iframe con `srcdoc` del HTML renderizado para un
contacto ficticio, pestañas EN/ES, ancho móvil y escritorio, acción
`renderCampaignPreview`.

Email de prueba: `sendTestCampaign` envía las versiones al correo del admin
logueado con asunto `[PRUEBA] …`, `blindCopy: false`, sin escribir en
`campaign_recipients`.

## Envío

### `sendEmailBatch`

Se amplía para aceptar `blindCopy`, `tags` y `headers` por email y devolver los
ids de Resend en orden. Las campañas van con `blindCopy: false`: hoy se copia al
admin en cada email, y 104 copias en la bandeja de la oficina no son una copia
de seguridad, son ruido. Los chunks de 100 salen en secuencia con 600 ms de
pausa, no en paralelo, por el límite de 2 peticiones/s.

### `dispatchCampaign(campaignId)` en `app/lib/campaigns/dispatch.ts`

1. `UPDATE campaigns SET status = 'sending' WHERE id = $1 AND status IN ('draft', 'scheduled') RETURNING *`.
   Cero filas = otro proceso ya la tiene. Bloquea doble clic y cron solapado
   sin locks.
2. `resolveAudience` e inserta `campaign_recipients` en `queued`.
3. Por chunk: renderiza el HTML por destinatario e idioma, `batch.send` con
   `tags: { campaign_id }`, guarda `provider_id` y pasa las filas a `sent`. Un
   chunk rechazado (429, 5xx) se reintenta una vez tras 2 s; si vuelve a
   fallar, sus filas quedan `failed` con el mensaje y se sigue con el siguiente.
4. Al terminar: `status = 'sent'`, `sent_at`, `recipients_count`, `failed_count`.

Reanudación: el cron también toma campañas en `sending` desde hace más de 10
min y envía solo las filas `queued`. Un timeout de Vercel a mitad no duplica
correos. Más de 2 h en `sending` la marca `failed`.

### Cron `/api/cron/campaigns`

Cada 15 min en `vercel.json`, `maxDuration = 60`, protegido por `CRON_SECRET`
como los existentes. Despacha `scheduled` con `scheduled_at <= now()` y reanuda
las `sending` colgadas. "Enviar ahora" desde el dashboard llama a
`dispatchCampaign` directamente.

### Webhook

En `app/api/webhooks/resend/route.ts`, tras verificar la firma: si
`data.tags.campaign_id` existe, llama a `record_campaign_event`; si no, sigue
con `booking_events` como hoy. Un `provider_id` desconocido se ignora con 200.

Configuración manual en Resend: activar los eventos `opened` y `clicked` en el
webhook y el tracking de aperturas y clics en el dominio. Sin eso solo llegan
entregas y rebotes.

## Dashboard

Sección `Campañas` en la navegación, solo `admin`, bajo
`app/(dashboard)/dashboard/campaigns/`.

- `page.tsx`: tarjetas (enviadas este mes, tasa de entrega, tasa de apertura) y
  tabla: nombre, estado con color, destinatarios, entregados %, abiertos %,
  clics %, fecha. Filtro por estado. Botón "Nueva campaña".
- `new/` y `[id]/edit/`: formulario en 3 pasos, patrón de `bookings/new`:
  1. **Audiencia**: condiciones + selector manual con buscador, contador en
     vivo ("Llegará a 43 personas, 31 EN y 12 ES") y lista de muestra.
  2. **Contenido**: pestañas EN/ES, campos de la sección anterior, vista previa
     en iframe a la derecha.
  3. **Revisar**: resumen; "Enviarme prueba", "Guardar borrador", "Enviar
     ahora" con confirmación que repite el número de destinatarios, "Programar"
     con fecha y hora. Audiencia vacía deshabilita el envío, y el servidor lo
     rechaza igual.
- `[id]/page.tsx`: detalle tras envío. Contadores grandes: enviados,
  entregados, abiertos, clics, rebotados, spam, fallidos. Desglose por idioma.
  Tabla de destinatarios con estado y buscador, rebotados arriba. Acciones:
  "Duplicar" (copia a borrador), "Cancelar" solo en `scheduled`, "Reintentar
  fallidos" que reenvía solo las filas `failed`. Nota fija bajo aperturas:
  Apple Mail las infla; la entrega es el hecho.

Ficha de contacto `contacts/[id]`: bloque "Campañas recibidas" con estado por
campaña, y aviso rojo con botón "Limpiar rebote" si `email_bounced_at`.

Traducciones en `messages/{en,es}/dashboard.json` y `booking.json`, con los
mismos nombres de estado que `booking_events`.

## Casillas de consentimiento

Todas opcionales. Marcada pone `true` y sella la fecha; sin marcar **no toca**
el valor: un cliente que reserva de nuevo sin marcarla no pierde ni gana
suscripción.

| Dónde                                                | Estado hoy         | Cambio                                                                           |
| ---------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Reserva pública, `details-step.tsx`                  | solo casilla legal | casilla bajo la legal; viaja por `upsert_contact(p_newsletter)`                  |
| `/sign-up`                                           | sin casilla        | casilla; pone `profiles.newsletter_subscribed` y sincroniza `contacts` por email |
| Dashboard `contacts/new`                             | sin campo          | toggle igual al de la ficha                                                      |
| Dashboard `bookings/new`, paso cliente               | sin campo          | toggle; el staff pregunta al cliente en persona                                  |
| Registro Running Club y Education Programs           | sin casilla        | casilla, misma acción                                                            |
| Footer, hero del blog, ficha de contacto, `/account` | ya existe          | ninguno                                                                          |
| Formulario de contacto público, MCP `create_booking` | sin casilla        | fase 2                                                                           |

## Seguridad

- Todas las acciones bajo `requireRole(accessToken, ["admin"])`. Staff y
  partner no ven la ruta ni pueden llamar a las acciones.
- El texto del admin se escapa antes de convertirse en HTML; solo `**`,
  `[](url)` y saltos de línea generan etiquetas. URLs de enlaces e imagen solo
  `https://`.
- El token de baja va en la URL; el email, nunca.
- `RESEND_API_KEY` ausente marca la campaña `failed` con un error claro. Hoy
  `sendEmail` finge éxito en silencio; una campaña no puede permitírselo.
- Cron con `CRON_SECRET` y webhook con firma Svix, ambos ya existentes.

## Verificación

No hay tests automáticos en el repo. Se valida así:

1. `bun run build && bun run format && bun run lint`, sin errores ni avisos.
2. Migración aplicada con `npx @insforge/cli@latest db query`.
3. Campaña de prueba con audiencia manual de 2 contactos propios, uno EN y uno
   ES. Comprobar en el panel de Resend que salen con `tags.campaign_id` y la
   cabecera `List-Unsubscribe`.
4. Webhook: una entrega y una apertura mueven la fila y los contadores una sola
   vez aunque Resend reintente.
5. Rebote: enviar a `bounced@resend.dev`; comprobar `email_bounced_at` y que la
   siguiente vista previa lo excluye.
6. Programar a 15 min vista; el cron la despacha. Programar otra y cancelarla
   antes; no sale.
7. Reanudación: marcar una campaña `sending` a mano con filas `queued` y fecha
   de hace 15 min; el cron la termina sin duplicar las ya `sent`.
