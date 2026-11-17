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

**Estado: riesgo ACEPTADO y documentado** (decisión del 2026-11-17). No se restringe el estampado a contactos recién creados: dejaría sin WhatsApp a casi todas las reservas de clientas ya conocidas.

**Qué pasa.** El formulario público llama a `upsert_contact` **desde el navegador** con la clave anon (`app/components/sections/booking/booking-submit.ts`), con `p_newsletter` y `p_whatsapp_marketing` (una sola casilla de novedades y ofertas). Después, `saveBookingConsents` estampa el consentimiento de los avisos de la cita al aceptar los Términos y la Política. La función es `SECURITY DEFINER`. Nada comprueba que quien rellena el formulario es el dueño del número ni del correo. Consecuencias, ahora **también para los avisos de la cita**, no solo para las novedades:

- Alguien puede reservar con **su** correo, el número de **otra persona** y los Términos aceptados: el centro escribiría a esa persona (confirmación y recordatorio), que nunca consintió. Antes de este cambio eso exigía marcar una casilla; ahora basta aceptar los Términos, que es obligatorio para reservar.
- Con el correo de otra persona, `upsert_contact` **sobrescribe el contacto**: nombre, teléfono e idioma (`phone = EXCLUDED.phone`, ver `insforge/migrations/20261117h_whatsapp_optout_clears_other_consent.sql`). Y como esa llamada deja el contacto recién escrito, **la ventana de 15 minutos de `saveBookingConsents` no protege**: la ventana existe para que nadie estampe un contacto antiguo sin pasar por el formulario, pero quien sí pasa por el formulario con el correo ajeno cumple la condición de "escrito hace menos de 15 minutos" por construcción. Limita el abuso a "quien rellena el formulario", no a "el dueño del contacto".
- Marcar la casilla de novedades con el correo de otra persona **limpia su baja** (`whatsapp_opted_out_at`) y le pone el consentimiento. Es un "gap aceptado" (comentario en `booking-submit.ts` y en `booking-consent.ts`), igual que con la newsletter. Los avisos de la cita **solos** no levantan una baja: `saveBookingConsents` solo estampa un contacto sin consentimiento y sin baja.
- Orden con una baja previa, **intencionado**: marcar novedades es un sí explícito, así que `upsert_contact` limpia la baja y retira los avisos (la baja es global), y a continuación se estampan de nuevo los avisos. Una clienta que se dio de baja de los avisos los recupera al marcar novedades. Fijado en `self-consent.test.ts`.
- Desmarcar la casilla de novedades más tarde no retira nada ("sin marcar no toca"): la retirada es el enlace del correo, BAJA o STOP, o el centro desde la ficha.

**Mitigaciones.**

1. **Nada sale sin una acción del centro o un pago.** La confirmación del equipo (o el pago online) es lo que dispara el primer WhatsApp; una reserva con datos ajenos no escribe a nadie por sí sola.
2. **La lista de supresión por número** (`whatsapp_suppressed_phones`, migración `20261117l`, **sin aplicar**): si la persona a la que se escribe contesta STOP o BAJA, su **número** queda excluido para siempre, aunque otro formulario lo vuelva a meter. Falla cerrado. Protege a quien responde STOP, pero no evita el **primer** mensaje.
3. **Contenido neutro de la plantilla**: una confirmación o un recordatorio de una cita no revela datos de salud ni nada sensible a quien lo reciba por error.

> **Sin la migración `20261117l` aplicada no se debe activar nada de WhatsApp con clientas.** Con el diseño actual el consentimiento de los avisos de la cita se obtiene con un gesto obligatorio (aceptar los Términos) y sin comprobar el número; la lista de supresión es la única barrera que queda cuando alguien responde BAJA. Mientras no esté aplicada, todo envío a clientas y toda campaña de WhatsApp fallan cerrados y no salen mensajes. Es el estado correcto hasta que se aplique.

**Mejora de fondo (decisión de producto).** Verificar la propiedad del número: un código de un solo uso (OTP) por WhatsApp o SMS, o una respuesta "SÍ" a un mensaje de utilidad, y no enviar más avisos hasta recibirla. Cuesta un mensaje por alta y requiere recibir respuestas entrantes (el webhook ya las recibe). Alternativa más barata: pedir el teléfono solo a clientas con cuenta verificada.

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

---

## (x) Avisos de cita: lo que conviene saber

El recordatorio fijo de WhatsApp se sustituyó por el tipo de campaña **aviso de cita** (`kind = 'appointment'`, solo WhatsApp). Nada de esto es un fallo; son los bordes del diseño, por si alguien los encuentra.

- **Un aviso puede llegar con hasta 15 minutos de retraso**, porque lo evalúa el cron de campañas (cada 15 minutos). No sirve para avisos de menos de unos pocos minutos.
- **Un aviso fuera de plazo se pierde.** Solo sale en los 45 minutos siguientes a su momento (antes de la cita) o en las 3 horas siguientes (después). Una reserva hecha cuando el momento ya pasó (reservada 3 horas antes con un aviso "24 horas antes") **no** recibe ese aviso; la confirmación inmediata la cubre. Si el cron cae más de 45 minutos en el momento de un aviso "antes", ese recordatorio no sale. El compromiso es deliberado: un recordatorio fuera de plazo es peor que ninguno, y sin el plazo una reserva a 30 minutos dispararía a la vez todas las campañas de 48 h, 24 h y 2 h, y una campaña pausada enviaría el atraso al reanudarse.
- **Reprogramar una reserva no reenvía el aviso.** El ciclo es el id de la reserva: una reserva movida a otro día no recibe otro aviso aunque el nuevo horario caiga en otro plazo.
- **Una reserva sin hora** empieza a medianoche en Canarias (`foldAppointments`), así que su aviso "antes" cae la noche anterior. El formulario siempre pide hora; solo podría darse en reservas importadas.
- **Dos contactos con el mismo teléfono** comparten audiencia: el primero gana y las reservas del segundo no se avisan (el índice único es por teléfono y ciclo).
- **Las reservas del equipo no registran consentimiento**, así que esas clientas no reciben avisos de cita hasta que se active "Avisos de la cita" en su ficha.
- **La columna `bookings.whatsapp_reminder_sent_at` está obsoleta.** Se creó para el recordatorio fijo (migración `20261117k`, ya aplicada). Quitarla es una migración aparte que decide el usuario; mientras tanto no cuesta nada.
- **Las reservas que lee un aviso de cita** son las de los últimos 31 días en adelante (el aviso "después" más largo es de 30 días). Las condiciones de la audiencia sobre el historial de reservas ("nunca reservó", "última reserva") no tienen sentido en este tipo y verían solo ese tramo.
- **La vista previa de la audiencia** de un aviso de cita cuenta a las clientas con el consentimiento de avisos de la cita, no las citas. Cuántas citas se avisarán depende de cuándo se activa.

---

## (xi) Los consentimientos no tienen un registro persistente

**Qué pasa.** Un consentimiento es hoy una fecha en la ficha (`whatsapp_opted_in_at`, `whatsapp_marketing_opted_in_at`, `newsletter_subscribed_at`) y el último estado de cada baja. No queda **quién** lo cambió, **cuándo exactamente**, **desde dónde** (formulario público, ficha, STOP, enlace del correo) ni **con qué texto** se pidió. Si se activa y se desactiva, la fecha anterior se pierde.

**Qué hay ahora.** Una traza mínima en el registro del servidor, sin migración: cada cambio hecho desde la ficha (`setWhatsAppConsent`, `setMarketingConsent`, quitar un número de la lista de bajas) escribe `console.info` con el id de quien actúa, el id del contacto, el uso y el sentido, sin correo ni teléfono. Vive lo que vivan los registros del servidor (días), no es consultable desde el dashboard.

**Mejora de fondo.** Una tabla de eventos de consentimiento (contacto, uso, acción, origen, quién, cuándo, versión del texto mostrado), escrita por el mismo código que hoy estampa las fechas, con RLS sin políticas como el resto. Es lo que pediría una inspección o una reclamación del RGPD para probar que alguien consintió, y lo que permitiría mostrar el historial en la ficha. Requiere una migración y decidir cuánto tiempo se conserva: queda para decisión del usuario.

---

## (xii) El `wa_id` de Meta puede no coincidir con el número guardado (México, Argentina)

**Qué pasa.** Un STOP se casa con el contacto y con la lista de bajas (`whatsapp_suppressed_phones`) comparando el `from` del mensaje entrante con el teléfono guardado, ambos normalizados a E.164 (`matchByPhone`, `suppressionRows`). En algunos países el identificador de WhatsApp (`wa_id`, que es lo que llega en `from`) no es el número tal como se marca: México añade un `1` tras el prefijo (`521…` para un número guardado como `+52…`) y Argentina un `9` (`549…` frente a `+54…` con o sin el `15`). Un STOP enviado desde uno de esos números **no encontraría al contacto**, y el número que entra en la lista **no sería el que buscan los envíos**, así que la baja no tendría efecto.

**A quién afecta.** A clientas con móvil mexicano o argentino. **Para España no aplica** (el `wa_id` es `34` más el número), ni para el resto de prefijos habituales aquí. No se ha comprobado contra Meta con un número real de esos países.

**Arreglo futuro.** Guardar el `wa_id` que Meta devuelve en cada envío (`contacts[].wa_id` de la respuesta de `/messages`) junto al contacto o al destinatario, y casar los STOP y la lista de bajas por ese valor en vez de por el teléfono tecleado. Requiere una columna nueva (migración) y escribirla en `sendTemplateMessage` y sus llamadores: queda para decisión del usuario.

---

## (xiii) Mensajes editables y avisos de reserva: lo que queda tras los arreglos de la auditoría

Cuatro cosas que la auditoría de los correos editables dejó a la vista y que no se arreglaron, o solo en parte.

**1. El editor de campañas ofrece "mostrar condicionalmente" y esos bloques nunca se envían.** Maily dibuja un bloque con `showIfKey` solo si existe un valor de *payload* con ese nombre, y `renderBodyFragment` (`app/emails/templates/campaign.ts`) fija `setVariableValues` pero no `payloadValues`. Un bloque de campaña marcado así se ve en el editor y no llega a nadie, sin aviso. En los mensajes transaccionales ya está resuelto (`app/lib/messages/safe-doc.ts`: se rechaza al guardar y se quita la condición al enviar); las campañas no se tocaron para no cambiar su comportamiento. Arreglo posible, a elegir: rechazarlo al guardar la campaña (lo mismo que pide el hallazgo (iv)), o pasar las variables del envío también como `payloadValues` para que la condición funcione de verdad. A 2026-11-17 ninguna campaña guardada lo usa.

**2. Asuntos legacy que siguen copiados.** Los cuatro asuntos de `notifyBookingCore` viven en `app/lib/messages/legacy-subjects.ts`, y el test guardián (`app/emails/defaults/defaults.test.ts`) compara los asuntos por defecto con esas mismas funciones. Los demás siguen escritos en su remitente y COPIADOS a mano en ese test, así que cambiar uno no obliga a cambiar el asunto por defecto del editor:

- `app/services/booking-payments.service.ts` (`booking_paid`)
- `app/services/bonus-payments.service.ts` (`bonus_purchase`)
- `app/actions/consent.ts` (`consent_request`)
- `app/api/cron/booking-reminders/route.ts` (`booking_reminder`, solo en español)
- `app/actions/booking-cancellation.ts:134` (segunda copia del asunto de `booking_cancelled` en español, la del enlace de cancelación de la clienta)

Arreglo: mover cada uno a `legacy-subjects.ts` y hacer que el remitente y el test lo lean de ahí (el texto que sale no cambia ni un byte).

**3. Qué hace Resend con un asunto vacío: no comprobado.** Un asunto personalizado que queda vacío al resolver sus variables ya no se envía vacío (`composeMessageEmail` usa el asunto por defecto y, si tampoco lo hubiera, el correo cae a `legacy`). Se dio por hecho que Resend rechaza un asunto vacío, pero no se probó contra la API, porque habría sido un envío real. Los asuntos legacy no pasan por esa limpieza: llevan el nombre del servicio tal como llega.

**4. El arreglo de fondo del hallazgo (iii).** `notifyBooking("received")` es una acción pública y hoy toma del *payload* el nombre, el servicio, el tipo de sesión, la hora y la duración que las plantillas legacy imprimen sin escapar. Desde esta auditoría la acción lee su entrada con `readBookingNotification` (`app/lib/bookings/notify.ts`): en `received` quita `<`, `>` y los caracteres de control de esos cinco campos y los recorta, sin rechazar el envío, y `amountDueEur` solo pasa si es un número. Eso corta el HTML, no el texto: quien llama sigue eligiendo qué pone el correo (hasta 200 caracteres de "servicio" que llegan a la dirección guardada en la reserva, con la marca del centro). El arreglo real es que `notifyBookingCore` lea nombre, servicio, tipo, hora y duración de la FILA de la reserva (`bookings` y `service_tiers`), como ya hace con el destinatario, y que del *payload* de la acción anónima solo se use el id; y, aparte, escapar en las plantillas legacy como pide el (iii). Los eventos del equipo (`confirmed`, `cancelled`, `rescheduled`) no se limpian: van con sesión y rol.

---

## (xiii) Un mensaje entrante puede llegar sin número: una baja así no se puede aplicar

**Qué pasa.** La referencia de Meta avisa de que `from` y `wa_id` **pueden omitirse** en un mensaje entrante, y de que a la persona se la identifique entonces por `from_user_id` / `user_id` (un identificador propio de Meta, no un teléfono). Todo lo que la ruta `/api/webhooks/whatsapp` hace con un mensaje entrante va **por número**: casar el STOP con el contacto, escribir la lista de bajas (`whatsapp_suppressed_phones`) y limpiar `whatsapp_unreachable_at`. Un STOP o BAJA que llegue sin `from` no tiene a quién aplicarse: **esa baja se pierde**.

**Qué hay ahora.** La ruta no se rompe: responde 200, no escribe nada para ese mensaje y deja **una línea `console.warn` por payload** con cuántos mensajes llegaron sin número, cuántos eran una baja que no se pudo aplicar y sus ids de mensaje (nunca el identificador de la persona). Los demás mensajes del mismo payload se tratan con normalidad. Si esa línea aparece con una baja, hay que darla de baja a mano desde la ficha.

**Arreglo futuro.** El mismo de (xii): guardar en cada envío el identificador que Meta devuelve para la destinataria (el `wa_id` y, donde exista, el identificador de usuario) junto al contacto o al destinatario, y casar las bajas, la lista y la marca de inalcanzable por ese valor cuando el número falte. La lista de bajas necesitaría además una segunda clave por identificador. Requiere migración: queda para decisión del usuario. No se ha visto todavía ningún mensaje real sin `from`.
