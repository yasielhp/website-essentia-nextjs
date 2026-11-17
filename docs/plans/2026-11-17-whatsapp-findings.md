# Hallazgos y decisiones pendientes (2026-11-17)

Lo que salió al construir los mensajes editables y el WhatsApp y que **no se ha arreglado**. Unos existían antes; otros son consecuencia de lo nuevo. Cada uno lleva el sitio exacto y una recomendación. Los números de línea son de la rama `feat/whatsapp-campaigns` a esta fecha.

Orden aproximado de importancia: del (v) al (iii) tocan privacidad o seguridad de datos de clientas; el (i) y el (ii) cambian lo que reciben las clientas; el resto es mantenimiento.

---

## (i) Clientas españolas reciben correos en inglés cuando el personal edita su reserva

**Qué pasa.** El formulario de edición de reservas llama a `notifyBooking` sin `locale` (`app/(dashboard)/dashboard/bookings/[id]/edit/save-booking.ts:288-299`), y `notifyBookingCore` aplica `"en"` por defecto (`app/lib/bookings/notify.ts:200`). Si el personal confirma, cancela o reprograma una reserva desde esa pantalla, la clienta recibe el correo (asunto incluido) en inglés aunque sea española. El alta de escritorio (`bookings/new/create-booking.ts:289`) y el MCP sí pasan el idioma.

**Lo que ya está bien.** El aviso por WhatsApp de la confirmación no sufre esto: usa el idioma del contacto cuando quien llama no lo dice (`notify.ts:392-395`).

**Datos.** `bookings` no tiene columna de idioma (comprobado en la BD viva). La fuente fiable es `contacts.preferred_language`, que rellenan el formulario público (`booking-submit.ts:86`), el alta de escritorio y el MCP. Ojo: la columna tiene `DEFAULT 'en'` (`insforge/migrations/20260615_contacts_preferred_language.sql`), así que un contacto sin idioma explícito se lee como inglés.

**Recomendación.** Que `notifyBookingCore` resuelva el idioma cuando `payload.locale` no llega, leyendo `contacts.preferred_language` por el contacto de la reserva (el patrón ya existe en `app/lib/bookings/for-staff.ts:398-411` y en `contactLocale`, `app/services/booking-payments.service.ts`) y usando español si no hay dato. Cambiar el `DEFAULT 'en'` es otra decisión: afecta a todo contacto nuevo.

---

## (ii) El correo de reserva pagada sale en cada pago, no solo en el primero

**Qué pasa.** `handleBookingPaid` envía `booking_paid` en cada pago (`app/services/booking-payments.service.ts:191`, fuera del `if (firstPayment)` de la línea 120). Un depósito seguido del resto produce **dos** correos de "reserva confirmada"; el segundo muestra solo lo cobrado en ese segundo pago. El WhatsApp equivalente sí se limita al primer pago (líneas 214-232), precisamente por esto.

**Recomendación.** Decidir con el centro: o el correo de confirmación sale solo en el primer pago, o el segundo pago manda un correo distinto ("hemos recibido el resto"). Cambiarlo toca la ruta de una reserva ya pagada: hay que hacerlo con la misma batería de pruebas de igualdad que se usó en los mensajes editables.

---

## (iii) Las plantillas legacy no escapan los datos de la reserva pública

**Qué pasa.** `bookingDetailsCard` (`app/emails/templates/_base.ts:169-232`) y las plantillas de reserva escriben `name`, `service`, `sessionType`, `date`, `time` y `duration` tal cual en el HTML (por ejemplo `booking-received.ts:47`, `booking-confirmed.ts:56`, `booking-reminder.ts:60`, `booking-confirmation.ts:40`). El nombre sale del formulario público, que solo limita la longitud a 80 caracteres (`app/lib/schemas.ts:106-107`). `notify.ts` envía a la dirección guardada en la reserva, que es la que escribió quien reservó: alguien puede reservar con el correo de **otra persona** y un nombre como un enlace HTML, y esa persona recibe un correo con la marca del centro con ese enlace dentro.

**Estado.** El camino de correos editables ya escapa estos valores (`app/lib/messages/fixed-blocks.ts`, y las variables del cuerpo con `renderVariables`). La ruta legacy no se tocó porque es lo que sale hoy byte a byte, y cambiarla modifica el HTML cuando el dato lleva `&`, `<`, `>`, `"` o `'`.

**Recomendación.** Escapar dentro de `bookingDetailsCard` y en cada plantilla legacy (un cambio pequeño con tests de igualdad para entradas normales). También conviene limitar los caracteres del nombre en el formulario. Prioridad alta: es la única inyección de contenido a un tercero.

---

## (iv) El editor de campañas ofrece HTML crudo y no se sanea al enviar

**Qué pasa.** El editor del cuerpo de una campaña (`app/(dashboard)/dashboard/campaigns/_form/content-step.tsx:184`) se monta sin la lista de bloques, así que ofrece el bloque `htmlCodeBlock` ("Custom HTML") de Maily, que escribe su texto en el correo **sin escapar**, variables incluidas. Y `campaignEmail` renderiza el documento sin pasarlo por `sanitizeDoc` (`app/emails/templates/campaign.ts:101`). Solo una administradora puede escribir una campaña, pero una variable como `{{first_name}}` dentro de un bloque HTML llevaría el texto de la destinataria sin escapar. También quedan sin filtrar enlaces con esquemas peligrosos y nodos que no son del editor, que `safe-doc.ts` sí rechaza en los mensajes editables.

**Recomendación.** (1) Pasar `sanitizeDoc` (con las variables del envío) en `campaignEmail`. (2) Rechazar al guardar una campaña lo que rechaza `findForbiddenNodes`. (3) Pasar al editor de campañas el mismo `blocks` que usa `app/components/dashboard/maily-editor.tsx`, o reutilizar ese editor. Las campañas ya guardadas pueden contener el bloque: el saneado al enviar las cubre.

---

## (v) Tablas sin RLS legibles con la clave del navegador

**Qué pasa.** Con RLS apagada, la clave `anon` que va en el navegador puede leer y escribir la tabla (los permisos por defecto del esquema la incluyen). Comprobado el 2026-11-17 en la BD viva: sin RLS están `booking_events` (558 filas con teléfonos y correos de clientas), `account_locks`, `auth_events`, `booking_calendar_mirrors`, `membership_plans`, `memberships`, `service_settings` y `service_tiers`. Ninguna tiene políticas. Se detectó ya el 2026-09-05 y solo se blindaron `campaigns` y `campaign_recipients`.

**Quién las lee**, para saber qué se rompería al activar RLS sin políticas (la clave de servicio se salta RLS):

| Tabla                                                     | Lectores                                                                                                                                                                                                                               | ¿Se rompe?                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `booking_events`                                          | Solo `getAdminClient()` (6 sitios, ver la migración `m`)                                                                                                                                                                               | No. Migración `20261117m` lista, **sin aplicar**                                    |
| `account_locks`, `auth_events`                            | Solo `app/lib/auth-security.ts` (clave de servicio)                                                                                                                                                                                    | No                                                                                  |
| `booking_calendar_mirrors`                                | Solo `app/lib/calendar-sync.ts`, `calendar-propagate.ts` y `app/api/google/calendar/sync-user/route.ts` (clave de servicio)                                                                                                            | No                                                                                  |
| `memberships` (nombre, apellido, correo, teléfono, notas) | **Cliente del navegador** en `app/(dashboard)/dashboard/subscriptions/page.tsx:207,224`, `subscriptions/new/page.tsx:348` (también inserta) y `transactions/page.tsx:474`; clave de servicio en `app/actions/contacts.ts:167` y el MCP | **Sí**: activar RLS sin políticas dejaría esas tres páginas del dashboard sin datos |
| `membership_plans`, `service_tiers`, `service_settings`   | Navegador, incluido el sitio público (`tier-selector.tsx`, `comparison-section.tsx`, `duration-step.tsx`, `confirm-step.tsx`, `bookable-services.client.ts`)                                                                           | **Sí**, y a propósito: son precios y ajustes públicos                               |

**Recomendación.**

1. Aplicar ya RLS sin políticas a las que solo lee la clave de servicio: `booking_events` (la `m`), `account_locks`, `auth_events`, `booking_calendar_mirrors`. Es una migración aditiva por tabla.
2. `memberships`: pasar las tres páginas a Server Actions con rol de administradora y **después** activar RLS. Hoy tiene 0 filas, pero cuando haya datos serán nombres, correos y teléfonos legibles por cualquiera con la clave del navegador.
3. Las tres de precios: política de solo lectura para `anon` (SELECT) y nada más; ninguna escritura sin rol.
4. Regla para tablas nuevas: `ENABLE ROW LEVEL SECURITY` sin políticas desde la migración que las crea (ya consta en `CLAUDE.md`).

---

## (vi) El consentimiento por casilla no verifica que el número sea de quien lo marca

**Qué pasa.** El formulario público llama a `upsert_contact` **desde el navegador** con la clave anon (`app/components/sections/booking/booking-submit.ts:80-98`), con `p_whatsapp` y `p_whatsapp_marketing`. La función es `SECURITY DEFINER`. Nada comprueba que quien marca la casilla es el dueño del número ni del correo. Consecuencias:

- Alguien puede reservar con **su** correo, el número de **otra persona** y la casilla marcada: el centro escribiría a esa persona, que nunca consintió.
- Con el correo de otra persona, la misma llamada **limpia su baja** (`whatsapp_opted_out_at`) y le pone el consentimiento. El propio código lo reconoce como "gap aceptado" (`booking-submit.ts:90-96`, comentario del código), igual que ya ocurre con la casilla de la newsletter.
- La función también sobrescribe el teléfono del contacto con el que llega (`phone = EXCLUDED.phone`, `insforge/migrations/20261117h_whatsapp_optout_clears_other_consent.sql`): quien conoce un correo puede cambiarle el número a ese contacto.

**Mitigación aplicada.** La lista de supresión por número (`whatsapp_suppressed_phones`, migración `20261117l`, **sin aplicar**): si la persona a la que se escribe contesta STOP o BAJA, su **número** queda excluido para siempre, aunque otro formulario lo vuelva a meter. Falla cerrado. Protege a quien responde STOP, pero no evita el **primer** mensaje a una persona que nunca consintió.

**Mejora de fondo (decisión de producto).** Doble confirmación del número: tras marcar la casilla, enviar un mensaje de WhatsApp (plantilla de utilidad) con un único gesto de confirmación, y no activar el consentimiento hasta recibirlo. Cuesta un mensaje por alta y requiere recibir respuestas entrantes (el webhook ya las recibe). Alternativas más baratas: pedir el teléfono solo a clientas con cuenta verificada, o activar solo el aviso de la cita (transaccional) y exigir confirmación para novedades y ofertas.

---

## (vii) Los menús de Maily pierden las plantillas de cabecera y pie

**Qué pasa.** `app/components/dashboard/maily-editor.tsx` (comentario de las líneas 22-35 y lista `MESSAGE_BLOCKS`, línea 36) construye el menú de barra con los bloques que exporta `@maily-to/core/blocks` uno a uno, para dejar fuera el bloque de HTML crudo. La lista por defecto del paquete no se exporta, así que no se puede filtrar: solo reemplazar. Quedan fuera las plantillas prediseñadas de cabecera y pie ("Components"), y también `logo`, `inlineImage`, `linkCard` y `repeat`, que se dejaron fuera a propósito (el último, porque no hace nada en estos correos y falla con un `each` hostil).

**Recomendación.** Es aceptable: los correos del centro ya llevan cabecera y pie fijos. Si hacen falta bloques que hoy no están (p. ej. `linkCard`), añadirlos a `MESSAGE_BLOCKS` **y** a `ALLOWED_NODES` de `app/lib/messages/safe-doc.ts` a la vez.

---

## (viii) Menciones de "Costa Adeje" y domicilio fiscal: no se tocaron

El cambio de dirección del centro (Rambla de Santa Cruz, 83, ya en pies de correo, ficha de contacto y schema.org) dejó varias referencias que **no** se cambiaron porque no está claro que deban cambiar:

| Dónde                                                                                                                                               | Qué dice                                                   | Duda                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messages/es/home.json:96` y `messages/en/home.json:96` (sección `theSpace`)                                                                        | "Encaramado en los acantilados de Costa Adeje…"            | La sección está apagada en la portada (`app/(site)/[locale]/(page)/page.tsx:52-56`, comentario TODO). Describe las instalaciones anteriores. Reescribir antes de reactivarla                    |
| `messages/es/experiences.json:21,56,65,88,108` y `messages/en/experiences.json` (mismas líneas)                                                     | Rutas del Club de Running "por Costa Adeje"                | Puede ser correcto si las rutas siguen allí: es la zona de las salidas, no la sede. Confirmar con el centro                                                                                     |
| `app/(site)/[locale]/(page)/experiences/running-club/page.tsx:54-55`                                                                                | Misma frase en el título de la página                      | Igual                                                                                                                                                                                           |
| `public/llms.txt:34`, `public/llms-full.txt:226-227`                                                                                                | Running Club en Costa Adeje                                | Igual; corregir a la vez que el sitio                                                                                                                                                           |
| `app/(dashboard)/dashboard/bookings/_shared/location-options.tsx:32`                                                                                | "Costa Adeje" como opción de lugar de una reserva          | Es una opción de dashboard, probablemente correcta                                                                                                                                              |
| **Domicilio fiscal**: `app/(site)/[locale]/(page)/(legal)/privacy/content-es.tsx:37,238`, `content-en.tsx:35,219` y `(legal)/legal/page.tsx:60,174` | "Calle Arure 29, San Isidro, 38611 Santa Cruz de Tenerife" | Es el domicilio del responsable del tratamiento y del aviso legal. **No** es la sede del centro y puede no haber cambiado. Si cambió, hay que actualizarlo aquí y en el registro de actividades |

**Recomendación.** Confirmar con el centro cada fila antes de tocarla. Ningún correo ni pie usa ya la dirección vieja.

---

## (ix) Deuda técnica menor acumulada

- **Tamaño de archivos.** `app/actions/campaigns.ts` (1324 líneas), `app/lib/campaigns/dispatch.ts` (709), `app/lib/campaigns/dispatch-whatsapp.ts` (567) y `app/(dashboard)/dashboard/campaigns/[id]/page.tsx` (533) son difíciles de revisar. Dividir por canal (email / WhatsApp) cuando se vuelva a tocar cada uno.
- **Límite de frecuencia en memoria por instancia.** `app/lib/campaigns/rate-limit.ts:1-8` guarda los usos en la memoria del proceso; en Vercel cada instancia tiene los suyos y se reciclan. Frena un botón atascado, no a alguien decidido. Lo usan la vista previa de mensajes (`app/actions/message-templates.ts:280`) y la prueba de WhatsApp (`app/actions/campaigns.ts:933`). Un límite real necesita un almacén compartido.
- **Los textos de los correos viven en dos sitios.** Cada correo legacy (`app/emails/templates/*`) y su default (`app/emails/defaults/*`). Un test guardián (`app/emails/defaults/defaults.test.ts`) lo mantiene en sintonía, pero la meta del plan es retirar las funciones legacy cuando el camino nuevo lleve probado de punta a punta en producción. Hasta entonces, cambiar un correo legacy exige cambiar su default.
- **Tests con `mock.module`.** Los tests de `notify.test.ts`, `callers.test.ts` y `route.test.ts` sustituyen módulos del proceso entero y los restauran al terminar. Funcionan con la ejecución secuencial de `bun test`; si algún día se paraleliza, hay que aislarlos.
- **Prueba que usa un proceso hijo.** `app/lib/messages/safe-doc.child.ts` existe solo para probar que un nodo `{"type":"render"}` no cuelga el servidor: un bucle síncrono no se puede cortar desde el propio test. No es código de la aplicación.
- **Dependencia de la versión de Maily.** `ALLOWED_NODES` (`app/lib/messages/safe-doc.ts`) se derivó de `@maily-to/core` 0.3.7 y `@maily-to/render` 0.2.3. Al actualizar cualquiera de los dos hay que releer qué tipos de nodo producen y despachan, porque el renderizador ejecuta cualquier `type` que sea un método de su clase.
- **Recordatorio por correo siempre en español.** El cron fija `locale = "es"` (`app/api/cron/booking-reminders/route.ts`), así que el correo del recordatorio en inglés y su asunto en inglés (el único default sin texto legacy detrás) no se usan hoy.
- **Bloques fijos tras el texto.** En un correo personalizado los bloques de datos (tarjeta de detalles, botones) salen después del texto del cuerpo, y un cuerpo editado sustituye también a la frase de cierre. El editor debería avisarlo. Y la etiqueta en mayúsculas que algunos correos legacy ponen sobre el título pasa a ser el primer párrafo del cuerpo, debajo del título.
