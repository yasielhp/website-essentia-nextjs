# Inventario de mensajes transaccionales (2026-11-17)

Lo escribió la Tarea 17 para que la Tarea 18 convierta cada email en un documento Maily por defecto sin perder una frase. El texto está copiado del código tal como está hoy. Fuente de las claves y variables: `app/lib/messages/catalog.ts`.

Forma común de todos: `emailBase()` (cabecera con logo, tarjeta blanca, pie con el nombre y la dirección del centro) salvo `booking_paid`, que escribe su propio HTML (ver más abajo).

## Qué es editable y qué no

| Plantilla                         | ¿Editable? | Motivo                                                                     |
| --------------------------------- | ---------- | -------------------------------------------------------------------------- |
| booking-received                  | Sí         | Cliente                                                                    |
| booking-confirmed                 | Sí         | Cliente (la confirma el staff desde el dashboard)                          |
| booking-confirmation              | Sí         | Cliente (la envía el webhook de Redsys tras el pago). Clave `booking_paid` |
| booking-rescheduled               | Sí         | Cliente                                                                    |
| booking-cancelled                 | Sí         | Cliente                                                                    |
| booking-reminder                  | Sí         | Cliente. Única que se puede apagar                                         |
| consent-request                   | Sí         | Cliente                                                                    |
| bonus-purchase                    | Sí         | Cliente                                                                    |
| staff-new-booking                 | No         | Aviso interno al profesional                                               |
| account-locked / account-unlocked | No         | Seguridad de la cuenta: el texto cuenta intentos y hora, no se retoca      |
| contact-message                   | No         | Entra al admin desde el formulario público                                 |
| campaign                          | No         | Es el renderizador de campañas, no un mensaje                              |

Confirmada la lista del plan: las cuatro de uso interno o de sistema quedan fuera. Desajuste: el plan tenía 7 claves y la realidad tiene 8 correos de clienta, porque `booking-confirmation` y `booking-confirmed` son correos distintos (ver "Desajustes").

## Cómo se invocan

| Clave               | Función (archivo)                                    | Llamadores                                                                                                                                                                                                                                                                                                                                          | Idioma                                                                                                                          |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| booking_received    | `bookingReceivedEmail` (booking-received.ts)         | `notify.ts`, evento `received`, solo desde el formulario público (`booking-submit.ts:~337`)                                                                                                                                                                                                                                                         | `payload.locale` (el formulario público siempre lo pasa)                                                                        |
| booking_confirmed   | `bookingConfirmedEmail` (booking-confirmed.ts)       | `notify.ts`, evento `confirmed`. Lo alcanzan el formulario de edición del dashboard (`bookings/[id]/edit/save-booking.ts:288`, cuando el estado pasa a confirmada), `bookings/new/create-booking.ts:276` y el MCP `create_booking` (`lib/bookings/for-staff.ts:280`). **No** sale del formulario público: `booking-submit.ts` solo envía `received` | `payload.locale`, por defecto `en` (`notify.ts:196`); el formulario de edición del dashboard no lo pasa (ver Hallazgos)         |
| booking_paid        | `bookingConfirmationEmail` (booking-confirmation.ts) | `app/services/booking-payments.service.ts` (`handleBookingPaid`, webhook Redsys)                                                                                                                                                                                                                                                                    | `contacts.preferred_language`, `es` salvo `en`                                                                                  |
| booking_rescheduled | `bookingRescheduledEmail` (booking-rescheduled.ts)   | `notify.ts`, evento `rescheduled`                                                                                                                                                                                                                                                                                                                   | `payload.locale`, por defecto `en` (`notify.ts:196`); el formulario de edición del dashboard no lo pasa (ver Hallazgos)         |
| booking_cancelled   | `bookingCancelledEmail` (booking-cancelled.ts)       | **Tres sitios**: `notify.ts` (evento `cancelled`, la cancela el staff: edición del dashboard y MCP `for-staff.ts:412`) y `app/actions/booking-cancellation.ts:150` (`cancelBookingByToken`, la cancela la clienta desde el enlace)                                                                                                                  | `notify.ts`: `payload.locale`, por defecto `en` (`notify.ts:196`); `cancelBookingByToken`: argumento `locale`, por defecto `es` |
| booking_reminder    | `bookingReminderEmail` (booking-reminder.ts)         | `app/api/cron/booking-reminders/route.ts`, en lote con `sendEmailBatch`                                                                                                                                                                                                                                                                             | **Fijo `es`**: la reserva no guarda el idioma                                                                                   |
| consent_request     | `consentRequestEmail` (consent-request.ts)           | `app/actions/consent.ts` (reenvío manual desde la ficha del contacto)                                                                                                                                                                                                                                                                               | `contacts.preferred_language`, `es` salvo `en`                                                                                  |
| bonus_purchase      | `bonusPurchaseEmail` (bonus-purchase.ts)             | `app/services/bonus-payments.service.ts` (`sendConfirmation`, webhook Redsys)                                                                                                                                                                                                                                                                       | `order.preferred_language`                                                                                                      |

El asunto NO vive en las plantillas: lo construye cada llamador (tabla de abajo). La Tarea 18 tiene que moverlo al registro.

## Datos que recibe cada plantilla y qué variable del catálogo es

| Clave               | Parámetros de la función                                                                 | Variables del catálogo                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| booking_received    | name, service, sessionType, date, time, duration, amountDueEur, cancelUrl, locale        | first_name, service, session_type, date, time, duration, amount_due, cancel_url                                                                                                                                                                                                                                                                     |
| booking_confirmed   | name, service, sessionType, date, time, duration, dateIso, cancelUrl, consentUrl, locale | `notify.ts`, evento `confirmed`. Lo alcanzan el formulario de edición del dashboard (`bookings/[id]/edit/save-booking.ts:288`, cuando el estado pasa a confirmada), `bookings/new/create-booking.ts:276` y el MCP `create_booking` (`lib/bookings/for-staff.ts:280`). **No** sale del formulario público: `booking-submit.ts` solo envía `received` |
| booking_paid        | name, serviceName, date, time, duration, dateIso, locale, paidEur, owedEur, consentUrl   | first_name, service, date, time, duration, amount_paid, amount_due, consent_url                                                                                                                                                                                                                                                                     |
| booking_rescheduled | name, service, sessionType, date, time, duration, dateIso, cancelUrl, locale             | first_name, service, session_type, date, time, duration, cancel_url                                                                                                                                                                                                                                                                                 |
| booking_cancelled   | name, service, sessionType, date, time, duration, locale                                 | first_name, service, session_type, date, time, duration                                                                                                                                                                                                                                                                                             |
| booking_reminder    | name, service, sessionType, date, time, duration, dateIso, cancelUrl, locale             | first_name, service, session_type, date, time, duration, cancel_url                                                                                                                                                                                                                                                                                 |
| consent_request     | name, url, locale                                                                        | first_name, consent_url                                                                                                                                                                                                                                                                                                                             |
| bonus_purchase      | name, service, sessions, amount, expiresOn, locale                                       | first_name, service, sessions, amount_paid, expires_on                                                                                                                                                                                                                                                                                              |

Regla de las variables de enlace: `cancel_url` solo donde hay bloque `cancel_link`, `consent_url` solo donde hay `consent_button` (lo fija un test). Los valores llegan ya formateados, **pero no con un único formato**: `{{date}}` vale lo que el llamador pase y la Tarea 18 NO unifica formatos (el texto que recibe hoy cada clienta no debe cambiar).

| Clave               | Formato de `date` hoy                                                                                        | Ejemplo ES                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| booking_received    | `lib/format-date` `formatLongDate` (desde `notify.ts:205`)                                                   | `jueves, 20 de agosto de 2026`                  |
| booking_confirmed   | igual                                                                                                        | igual                                           |
| booking_rescheduled | igual                                                                                                        | igual                                           |
| booking_cancelled   | `lib/format-date` en los dos llamadores (`notify.ts:205` y `booking-cancellation.ts:154`)                    | igual                                           |
| booking_reminder    | copia local `formatDate` del cron (`booking-reminders/route.ts:43`): mismas opciones que `lib/format-date`   | igual                                           |
| booking_paid        | `utils/format` `formatLongDate` (`booking-payments.service.ts:164`): día de dos cifras, sin día de la semana | `20 de agosto de 2026` (`05 de agosto de 2026`) |
| bonus_purchase      | no lleva `date`; `expires_on` usa `utils/format` `formatLongDate` (`bonus-payments.service.ts:190`)          | `20 de agosto de 2026`                          |

Importes: `amount_paid` y `amount_due` en `booking_paid` y `amount_paid` en `bonus_purchase` salen de `formatPrice` (`1.234,50 €` / `€1,234.50`). `amount_due` en `booking_received` es un número crudo dentro de la frase (`{importe} €`) y hoy no se usa (ver Hallazgos). `amount_paid` en `booking_paid` es lo cobrado en ESE pago (`received`), no lo acumulado en la reserva.

## Bloques fijos que añade el código

Los nombres son los de `FixedBlock` en el catálogo. Todos viven en `_base.ts` salvo donde se indica.

| Bloque            | Qué es                                                                                                                                                                                                                                                                                                                                                               | Dónde sale                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `details_card`    | `bookingDetailsCard()`: "Detalles de la sesión / Session details" con Servicio, Tipo de sesión (si hay), Fecha, Hora, Duración (si hay)                                                                                                                                                                                                                              | received, confirmed, rescheduled, cancelled, reminder. En `booking_paid` es una tarjeta propia que añade las filas Pagado / Pendiente de pago en el centro |
| `location`        | "Ubicación / Location" con `Rambla de Santa Cruz, 83 · 38004 Santa Cruz de Tenerife` (en `booking_paid`: "C/ La Noria 14", ver desajustes)                                                                                                                                                                                                                           | confirmed, reminder, paid                                                                                                                                  |
| `payment_note`    | Frase que solo existe si queda algo por pagar en el centro (ver texto abajo)                                                                                                                                                                                                                                                                                         | received (frase con el importe), paid (`owedNote`)                                                                                                         |
| `calendar_button` | `calendarButton(googleCalendarUrl(...))`: "Añadir al calendario / Add to Google Calendar". Solo si hay `dateIso`                                                                                                                                                                                                                                                     | confirmed, rescheduled, reminder, paid                                                                                                                     |
| `cancel_link`     | `cancellationLink()`: "¿No puedes venir? Cancela o cambia tu cita hasta 24 horas antes sin coste." + enlace "Cancelar mi cita" (EN: "Cannot make it? Cancel or change your appointment up to 24 hours before at no cost." / "Cancel my appointment"). Solo si hay `cancelUrl`                                                                                        | received, confirmed, rescheduled, reminder                                                                                                                 |
| `consent_button`  | `consentBlock()`: "Antes de tu primera sesión" + "Rellena tu consentimiento informado. Solo lo haces una vez y nos ayuda a cuidarte mejor." + botón "Rellenar consentimiento" (EN: "Before your first session" / "Please complete your informed consent. You only do it once and it helps us take better care of you." / "Complete consent"). Vacío si no hay enlace | confirmed, paid, consent_request                                                                                                                           |
| `bonus_card`      | Tarjeta "Tu bono / Your voucher" con Servicio, Sesiones, Importe pagado, Válido hasta (EN: Service, Sessions, Amount paid, Valid until)                                                                                                                                                                                                                              | bonus_purchase                                                                                                                                             |

Texto de `payment_note`:

- received, solo si `amountDueEur != null` (ES): `Has elegido pagar en el centro: el día de tu sesión abonarás <strong>{importe} €</strong>, el precio íntegro del tratamiento.` (EN): `You chose to pay at the centre: on the day of your session you will pay <strong>€{importe}</strong>, the full price of the treatment.` (aquí el importe es un número crudo, sin `formatPrice`). **Hoy esta frase no sale nunca**: el único llamador, `booking-submit.ts:345`, pasa `amountDueEur: null`. Se conserva porque es la ruta de "pagar en el centro", que existe en el código aunque la web hoy no la use.
- paid, solo si `owedEur > 0` (ES): `El resto se abona el día de la sesión.` (EN): `The balance is paid on the day of your session.`

## Texto actual por plantilla

Convención: **Asunto** lo pone el llamador. **Preheader** es el texto oculto de la bandeja. **Etiqueta** es la línea pequeña en mayúsculas sobre el título. **Título** es el `<h1>`. `{x}` marca un valor del código.

### booking_received

- Asunto ES: `Solicitud de reserva recibida — {service}` / EN: `Booking request received — {service}`
- Preheader ES: `Hemos recibido tu solicitud de reserva para {service} el {date}.` / EN: `We have received your booking request for {service} on {date}.`
- Etiqueta ES: `Solicitud recibida` / EN: `Request received`
- Título ES: `Gracias, {name}. Hemos recibido tu solicitud.` / EN: `Thank you, {name}. We have received your request.`
- Párrafo ES: `Estamos revisando tu solicitud y confirmaremos tu reserva en breve. Si tienes alguna pregunta, no dudes en contactarnos.` / EN: `We are reviewing your request and will confirm your booking shortly. If you have any questions, feel free to contact us.`
- Orden: etiqueta, título, párrafo, `details_card`, `payment_note`, párrafo de cierre, `cancel_link`
- Cierre ES: `Si necesitas cancelar o modificar tu solicitud, por favor contáctanos con al menos 24 horas de antelación.` / EN: `If you need to cancel or modify your request, please contact us at least 24 hours in advance.`

### booking_confirmed

- Asunto ES: `Tu reserva ha sido confirmada — {service}` / EN: `Booking confirmed — {service}`
- Preheader ES: `Tu reserva de {service} el {date} ha sido confirmada.` / EN: `Your {service} booking on {date} is confirmed.`
- Etiqueta ES: `Reserva confirmada` / EN: `Booking confirmed`
- Título ES: `Tu reserva ha sido confirmada, {name}.` / EN: `Your booking is confirmed, {name}.`
- Párrafo ES: `Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión.` / EN: `We look forward to seeing you. Here are the details of your upcoming session.`
- Orden: etiqueta, título, párrafo, `details_card`, `location`, `calendar_button`, `consent_button`, `cancel_link`, párrafo de cierre
- Cierre ES: `Si necesitas cancelar o cambiar la fecha, por favor contáctanos con al menos 24 horas de antelación.` / EN: `If you need to cancel or reschedule, please contact us at least 24 hours before your session.`

### booking_paid (booking-confirmation.ts)

- Asunto ES: `Tu reserva en Essentia está confirmada` / EN: `Your Essentia booking is confirmed` (sin el servicio)
- Preheader: **no tiene**. Esta plantilla no usa `emailBase()` y no escribe preheader.
- Etiqueta ES: `Reserva confirmada` / EN: `Booking Confirmed`
- Título ES: `Tu reserva ha sido confirmada, {name}` / EN: `Your booking is confirmed, {name}` (sin punto final, a diferencia de `booking_confirmed`)
- Párrafo ES: `Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión.` / EN: `We look forward to seeing you. Here are the details of your upcoming session.`
- Tarjeta: etiqueta `Detalles de la sesión` / `Session details`; filas Servicio, Fecha, Hora, Duración (no lleva tipo de sesión); si se pagó algo, fila `Pagado` / `Paid`; si queda algo, fila `Pendiente de pago en el centro` / `Due at the centre`. Importes con `formatPrice(x, locale)`.
- Ubicación ES: `Ubicación` + `C/ La Noria 14` + `Santa Cruz de Tenerife` / EN: `Location` + mismas líneas
- Orden: etiqueta, título, párrafo, tarjeta, ubicación, `payment_note`, `calendar_button`, `consent_button`, párrafo de cierre
- Cierre ES: `Si necesitas cancelar o cambiar la fecha, por favor contáctanos con al menos 24 horas de antelación.` / EN: `If you need to cancel or reschedule, please contact us at least 24 hours before your session.`
- Pie propio: `Essentia — Longevity Center & Social Wellness Club, Tenerife` + `C/ La Noria 14, Santa Cruz de Tenerife`
- Cabecera propia: texto `ESSENTIA` con espaciado, no el logo.

### booking_rescheduled

- Asunto ES: `Sesión reprogramada — {service}` / EN: `Booking rescheduled — {service}`
- Preheader ES: `Tu reserva de {service} ha sido reprogramada para el {date}.` / EN: `Your {service} booking has been rescheduled to {date}.`
- Etiqueta ES: `Sesión reprogramada` / EN: `Booking rescheduled`
- Título ES: `Tu reserva ha sido reprogramada, {name}.` / EN: `Your booking has been rescheduled, {name}.`
- Párrafo ES: `Hemos actualizado la fecha y/o la hora de tu sesión. Aquí tienes los nuevos detalles:` / EN: `We have updated the date and/or time of your session. Here are the new details:`
- Orden: etiqueta, título, párrafo, `details_card`, `calendar_button`, `cancel_link`, párrafo de cierre
- Cierre ES: `Si esta fecha no te viene bien, llámanos al <strong>+34 634 09 12 95</strong> y estaremos encantados de ayudarte.` / EN: `If this date does not work for you, please call us at <strong>+34 634 09 12 95</strong> and we will be happy to help.`

### booking_cancelled

- Asunto ES: `Reserva cancelada — {service}` / EN: `Booking cancelled — {service}` (el segundo llamador, `cancelBookingByToken`, repite el asunto ES `Reserva cancelada — {service}` sin variante EN: usa siempre el castellano aunque el correo vaya en inglés)
- Preheader ES: `Tu reserva de {service} el {date} ha sido cancelada.` / EN: `Your {service} booking on {date} has been cancelled.`
- Etiqueta ES: `Reserva cancelada` / EN: `Booking cancelled`
- Título ES: `Tu reserva ha sido cancelada, {name}.` / EN: `Your booking has been cancelled, {name}.`
- Párrafo ES: `Tu reserva ha sido cancelada. Si crees que es un error o deseas hacer una nueva reserva, por favor contáctanos.` / EN: `Your booking has been cancelled. If you believe this is a mistake or would like to make a new reservation, please contact us.`
- Orden: etiqueta, título, párrafo, `details_card`, párrafo de cierre
- Cierre ES: `Para reprogramar tu sesión o resolver cualquier duda, llámanos al <strong>+34 634 09 12 95</strong> con al menos 24 horas de antelación. Esperamos verte pronto.` / EN: `To reschedule or for any enquiries, please call us at <strong>+34 634 09 12 95</strong> at least 24 hours in advance. We hope to welcome you soon.`

### booking_reminder

- Asunto (cron, siempre ES): `Tu sesión del {fecha larga} — {service}`
- Preheader ES: `Tu sesión de {service} es el {date} a las {time}.` / EN: `Your {service} session is on {date} at {time}.`
- Etiqueta ES: `Tu próxima sesión` / EN: `Your next session`
- Título ES: `Te esperamos pronto, {name}.` / EN: `See you soon, {name}.`
- Párrafo ES: `Un recordatorio de tu cita. Ven con ropa cómoda y, si puedes, llega cinco minutos antes.` / EN: `A reminder of your appointment. Wear something comfortable and, if you can, arrive five minutes early.`
- Orden: etiqueta, título, párrafo, `details_card`, `location`, `calendar_button`, `cancel_link`. No hay párrafo de cierre.

### consent_request

- Asunto ES: `Completa tu consentimiento informado · Essentia` / EN: `Complete your informed consent · Essentia`
- Preheader ES: `Completa tu consentimiento informado antes de tu sesión.` / EN: `Please complete your informed consent before your session.`
- Etiqueta: no tiene
- Título ES: `Hola, {name}` / EN: `Hello, {name}` (el nombre puede ser `""`: queda `Hola, `)
- Párrafo ES: `Para poder atenderte con seguridad necesitamos que completes tu consentimiento informado. Solo lo haces una vez.` / EN: `To look after you safely we need you to complete your informed consent. You only do it once.`
- Orden: título, párrafo, `consent_button`

### bonus_purchase

- Asunto ES: `Tu bono de {sessions} sesiones está confirmado` / EN: `Your {sessions}-session voucher is confirmed`
- Preheader ES: `Tu bono de {sessions} sesiones está confirmado.` / EN: `Your {sessions}-session voucher is confirmed.`
- Etiqueta ES: `Bono confirmado` / EN: `Voucher confirmed`
- Título ES: `Gracias, {name}. Tu bono está confirmado.` / EN: `Thank you, {name}. Your voucher is confirmed.`
- Párrafo ES: `Ya tienes tu bono. Estos son sus datos.` / EN: `You now have your voucher. Here are its details.`
- Orden: etiqueta, título, párrafo, `bonus_card`, párrafo de cierre
- Cierre ES: `Para reservar tus sesiones con el bono, escríbenos a <a href="mailto:info@essentiawellnessclub.com">info@essentiawellnessclub.com</a> o llámanos al +34 634 09 12 95, y las acordamos contigo.` / EN: `To book your sessions with the voucher, write to us at <a href="mailto:info@essentiawellnessclub.com">info@essentiawellnessclub.com</a> or call +34 634 09 12 95, and we will arrange them with you.` (los dos datos salen de `app/constants/contact.tsx`)
- `{sessions}` en el asunto y el preheader es un número; `{service}` es la etiqueta del tramo (`service_tiers.label`).

## Desajustes entre el plan y la realidad

1. **Ocho claves, no siete.** `booking-confirmation.ts` (tras el pago online) y `booking-confirmed.ts` (la confirma el staff) son dos correos distintos con texto casi igual. Se añade `booking_paid`. La Tarea 18 necesita su propio default.
2. **`booking_paid` no usa `emailBase()`.** Tiene su cabecera de texto `ESSENTIA` (no el logo), su pie y sin preheader. Al pasarlo por `campaignEmail()`/`emailBase()` el aspecto cambia: hay que aceptarlo o conservarlo con un fallback.
3. **Dirección contradictoria.** `booking_paid` imprime `C/ La Noria 14, Santa Cruz de Tenerife` (ubicación, pie y evento de calendario). El resto de correos imprime `Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife` (`EMAIL_ADDRESS`). Una de las dos está mal y no lo decido yo: la Tarea 18 debe usar la dirección vigente y se le tiene que preguntar a la dueña. Con `emailBase()` el pie saldría con la Rambla.
4. **`name` no es siempre el nombre de pila.** En `notify.ts` (received, confirmed, rescheduled y cancelled por el staff) el llamador pasa `clientName`, que es `"{nombre} {apellido}"`. En reminder, paid, consent, bonus y en la cancelación por enlace (`booking-cancellation.ts:151`) es solo el nombre. Si `first_name` se rellena con el nombre de pila en todas, esos correos pasan de "Gracias, Ana García" a "Gracias, Ana". Es un cambio de texto visible: o se parte `clientName` o se mantiene el nombre completo donde hoy lo es. Lo decide la Tarea 18.
5. **Variables del plan que sobran o faltan.** `last_name` se elimina: ningún correo lo usa. `amount_due` en `booking_confirmed` y `bonus_purchase` no existe en la realidad (`booking_confirmed` no habla de importes; el bono trae `amount_paid`). Se añaden `amount_paid`, `sessions`, `expires_on`.
6. **`booking_cancelled` sí lleva tarjeta de detalles** y trae `session_type` y `duration` (el plan tenía `fixed: []`).
7. **Bloques fijos nuevos:** `location`, `payment_note` y `bonus_card`, que el plan no listaba.
8. **Orden del texto de cierre.** Solo cambia de sitio en tres correos. En `booking_confirmed`, `booking_rescheduled` y `booking_paid` el párrafo de cierre va hoy DESPUÉS de los bloques fijos (botón de calendario, consentimiento, enlace de cancelación). En `booking_received` va después de `details_card` y `payment_note` pero ANTES de `cancel_link`. En `booking_cancelled` y `bonus_purchase` ya es lo último (nada fijo detrás), y `booking_reminder` y `consent_request` no tienen cierre. El diseño del plan pone el cuerpo editable primero y los bloques fijos después (`afterBody`), así que en esos tres el cierre pasaría a ir antes del botón y en `received` antes de `details_card`. Decisión de la Tarea 18: mover el cierre al final del cuerpo editable o dejarlo fijo tras los bloques.
9. **La etiqueta en mayúsculas no tiene sitio.** `message_templates` solo tiene `subject`, `preheader`, `title` y `doc`. La línea pequeña ("Reserva confirmada") no cabe en ninguna: o va como primer párrafo del `doc` sin el estilo de mayúsculas, o se pierde. `consent_request` no la tiene.
10. **El asunto de la cancelación por enlace no tiene EN** (ver `booking_cancelled`).
11. **El recordatorio va siempre en castellano** (`locale = "es"` fijo en el cron), así que el default EN del recordatorio no se usará hasta que la reserva guarde el idioma.
12. **Escapado.** Los correos de reserva meten `{name}`, `{service}`, etc. sin escapar en el HTML (el nombre sale de un formulario público). `consent_request` y `bonus_purchase` sí escapan. El camino nuevo (`renderVariables`) escapa todo, lo que arregla el hueco, pero cambia la salida si un nombre lleva `&`.
13. **Camino de pago.** Resuelto en Hallazgos: normalmente NO se reciben `booking_paid` y `booking_confirmed` en la misma reserva.

## Hallazgos (fallos que ya existían; solo informe, no se tocan aquí)

1. **El formulario de edición de reservas manda el correo en inglés a quien sea.** `app/(dashboard)/dashboard/bookings/[id]/edit/save-booking.ts:288-299` llama a `notifyBooking` sin `locale`, y `notify.ts:196` aplica `"en"` por defecto. Una clienta española a la que el staff confirma, cancela o reprograma desde ahí recibe el correo en inglés (asunto incluido). `bookings/new/create-booking.ts:289` y el MCP sí lo pasan.
   - `bookings` no tiene ninguna columna de idioma (consultado en la BD viva: ni `lang` ni `locale`).
   - La fuente fiable es `contacts.preferred_language`: la rellenan el formulario público (`booking-submit.ts:86`), el alta de escritorio (`create-booking.ts:125`) y el MCP (`for-staff.ts:230`). Ojo: la columna tiene `DEFAULT 'en'` (`20260615_contacts_preferred_language.sql`), así que un contacto sin idioma explícito lee como inglés.
   - Arreglo propuesto: que `notifyBookingCore` resuelva el idioma cuando `payload.locale` falta, leyendo `contacts.preferred_language` por el `contact_id` de la reserva (el patrón ya existe en `for-staff.ts:398-411` y en `contactLocale` de `booking-payments.service.ts`), con `es` por defecto. Alternativa mínima: pasar `locale` desde `save-booking.ts` leyendo el contacto al cargar el formulario.
2. **`amount_due` en `booking_received` es una variable muerta hoy.** `booking-submit.ts:345` pasa `amountDueEur: null`, así que `payment_note` no sale. Se conserva en el catálogo (ruta de "pagar en el centro").
3. **Segundo pago, segundo "confirmada".** `handleBookingPaid` envía `booking_paid` en cada pago, no solo en el primero (`booking-payments.service.ts:155` va fuera de `if (firstPayment)`, línea 117). Un depósito y luego el resto producen dos correos de reserva confirmada, el segundo con la fila "Pagado" de ese pago.
4. **¿`booking_paid` y `booking_confirmed` en la misma reserva?** Normalmente no, por tres razones comprobadas:
   - `handleBookingPaid` pone `status: "confirmed"` él mismo (`booking-payments.service.ts:85`) y no llama a `notifyBooking`.
   - El correo `confirmed` del formulario de edición solo sale si el estado cambia (`save-booking.ts:272-278`). Una reserva pagada ya está `confirmed`, así que guardarla de nuevo no manda nada.
   - `confirmDraftBooking` (`booking-draft.ts:226`) deja la reserva en `pending` y solo registra el evento: no envía correo.
   - **Cuándo sí ocurre:** si el staff la cancela y la vuelve a confirmar desde el formulario de edición (cancelled a confirmed cuenta como cambio de estado), o si una reserva de escritorio/MCP, que ya recibió `confirmed` al crearse (`create-booking.ts:276`, `for-staff.ts:280`), llegara después a un pago Redsys. No he encontrado un enlace de pago para reservas de escritorio, así que esto último es una posibilidad no confirmada. El flujo web normal recibe `received` y después `booking_paid`.

## Elegibilidad para WhatsApp (decisión de la Tarea 17)

El texto del opt-in transaccional promete "la confirmación y el recordatorio de mi cita" (`messages/es/booking.json`, `whatsappOptIn`). Por eso son elegibles `booking_confirmed`, `booking_paid` (también es una confirmación) y `booking_reminder`. No lo son:

- `booking_received`, `booking_rescheduled`, `booking_cancelled`: fuera de lo prometido. Si el centro quiere avisar de cambios por WhatsApp, hay que ampliar el texto de la casilla antes (consentimiento).
- `consent_request` y `bonus_purchase`: no cuelgan de una reserva, y el remitente de la Tarea 21 resuelve el teléfono por la reserva.

`booking_paid` es elegible pero la Tarea 21 solo engancha `notifyBookingCore` y el cron: si quiere WhatsApp para el pago hay que engancharlo también en `handleBookingPaid`.
