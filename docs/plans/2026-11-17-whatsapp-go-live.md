# Puesta en marcha de WhatsApp (2026-11-17)

Lista de pasos para el centro y para quien despliega. Está escrita con lo que hay en el código y en la base de datos viva el 2026-11-17.

**Estado de partida.** El centro no tiene todavía número ni cuenta de WhatsApp Business registrados. Todo lo que depende de Meta (enviar un mensaje, recibirlo, ver estados, la aprobación de una plantilla) está **sin probar**: el código está probado con la base de datos y Meta simulados, nunca contra Meta. Sin las variables de entorno de la sección 1 el sistema no envía nada y no falla: los avisos al personal se registran en el historial de la reserva y los mensajes a clientas simplemente no salen.

---

## 1. Pasos manuales en Meta

Los hace quien administra la cuenta de Meta del centro. Los nombres de pantalla de Meta cambian: lo que sigue es lo que el código necesita, no una guía de sus menús.

1. **Verificar el negocio** en Meta Business (verificación de empresa). Sin ella los límites de envío son muy bajos.
2. **Cuenta de WhatsApp Business (WABA) y número.** Registrar un número que no esté ya en WhatsApp normal ni en WhatsApp Business app, o migrarlo. Dar de alta el nombre visible. Anotar dos identificadores:
   - el **id de la cuenta de WhatsApp Business** (WABA), y
   - el **id del número de teléfono** (no es el teléfono).
3. **Método de pago** en la cuenta: Meta cobra cada mensaje de plantilla según su categoría y el país de la destinataria (ver el punto 5.5). Las tarifas las fija Meta y cambian.
4. **Aplicación de Meta con el producto WhatsApp** y un **token de acceso permanente** (usuario del sistema) con permisos de gestión de WhatsApp Business y de envío de mensajes. El token de prueba de 24 horas no sirve en producción.
5. **Variables de entorno en Vercel (Production)**, todas en el proyecto del sitio, y volver a desplegar:

| Variable                       | De dónde sale                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `WHATSAPP_ACCESS_TOKEN`        | El token permanente del punto 4                                                                       |
| `WHATSAPP_PHONE_NUMBER_ID`     | El id del número (punto 2)                                                                            |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | El id de la WABA (punto 2). Sin él el panel solo muestra plantillas ya sincronizadas y no puede crear |
| `WHATSAPP_APP_SECRET`          | "Secreto de la aplicación" de Meta. Firma cada callback; sin él la ruta del webhook los rechaza todos |
| `WHATSAPP_VERIFY_TOKEN`        | Un texto inventado por el centro. Se escribe igual en Meta al guardar el webhook                      |
| `WHATSAPP_TEMPLATE_NAME`       | Opcional. Plantilla de los avisos al personal; por defecto `essentia_booking_update`                  |
| `WHATSAPP_API_VERSION`         | Opcional. Por defecto `v21.0`                                                                         |
| `CRON_SECRET`                  | Ya existe para los crons; compruébalo                                                                 |

6. **Suscribir el webhook** de la aplicación en Meta:
   - URL de devolución: `https://www.essentiawellnessclub.com/api/webhooks/whatsapp`
   - Token de verificación: el valor de `WHATSAPP_VERIFY_TOKEN`.
   - Campos: **`messages`** (los estados `sent`, `delivered`, `read`, `failed` y los mensajes entrantes, que es como llega un STOP o BAJA) y **`message_template_status_update`** (aprobación o rechazo de plantillas). El código no lee ningún otro campo; en particular no hace falta `message_deliveries`.
7. **Límites.** Meta aplica un tope de destinatarios únicos por día que depende de la verificación del negocio y de la calidad del número, y que va subiendo. Pedir el aumento cuando se vaya a hacer una campaña grande. El código no conoce el tope: lo que Meta rechace llega como error por mensaje.
8. **Precios.** Meta cobra por categoría de plantilla y país. El panel no calcula costes: enlaza a https://developers.facebook.com/docs/whatsapp/pricing y enseña cuántas personas recibirán una campaña antes de enviarla.

---

## 2. Migraciones de la base de datos

Se aplican a mano a la única base viva (producción). Estado comprobado el 2026-11-17 con consultas de solo lectura.

| Archivo (`insforge/migrations/`)                     | Qué hace                                                                                             | Estado en la BD viva                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `20261117a_whatsapp_consent_and_templates.sql`       | Consentimiento en `contacts`, tabla `whatsapp_templates`                                             | **Aplicada**                                                           |
| `20261117b_upsert_contact_whatsapp.sql`              | `upsert_contact` con el parámetro de WhatsApp                                                        | **Aplicada** (la función viva ya es la de `h`)                         |
| `20261117c_campaign_channel.sql`                     | `campaigns.channel`, `campaign_recipients.phone`, índice único por teléfono, `record_campaign_event` | **Aplicada**                                                           |
| `20261117e_whatsapp_templates_support.sql`           | `whatsapp_templates.unsupported_reason`                                                              | **Aplicada**                                                           |
| `20261117f_whatsapp_marketing_consent.sql`           | `whatsapp_marketing_opted_in_at` y `upsert_contact` con dos consentimientos                          | **Aplicada**                                                           |
| `20261117g_campaign_checks.sql`                      | Restricciones de canal y teléfono, `whatsapp_unreachable_at`                                         | **Aplicada**                                                           |
| `20261117h_whatsapp_optout_clears_other_consent.sql` | Tras una baja, activar un uso retira el otro                                                         | **Aplicada**                                                           |
| `20261117i_campaign_recipient_claim.sql`             | `campaign_recipients.claimed_at` (reclamo por fila)                                                  | **Aplicada**                                                           |
| `20261117j_message_templates.sql`                    | Tabla `message_templates` (mensajes editables)                                                       | **Aplicada**                                                           |
| `20261117k_booking_whatsapp_reminder.sql`            | `bookings.whatsapp_reminder_sent_at`                                                                 | **Aplicada. Columna obsoleta, sin uso** (ver 5.1)                      |
| `20261117l_whatsapp_suppressed_phones.sql`           | Lista de números que escribieron STOP o BAJA                                                         | **Aplicada el 2026-11-24** (tabla con RLS y sin políticas, verificada) |
| `20261117m_booking_events_rls.sql`                   | Activa RLS en `booking_events`                                                                       | **NO aplicada. Decisión del usuario**                                  |
| `20261117n_profiles_email_guard.sql`                 | Impide que quien no es admin cambie el `email` de su propio perfil (amplía `profiles_guard_role`)    | **NO aplicada. Decisión del usuario**                                  |

No existe la `d`: la tabla de mensajes editables salió como `j` porque `d` a `i` estaban ocupadas.

Las tablas `whatsapp_templates`, `message_templates`, `campaigns` y `campaign_recipients` están vacías hoy.

### Cómo aplicar

El CLI no admite `BEGIN`/`COMMIT`, y una cadena que empieza por un comentario `--` se toma como una opción y **no aplica nada** (responde "No rows returned" como si hubiera ido bien). Los archivos conservan comentarios y `BEGIN; … COMMIT;`, así que se quitan al enviarlos. Desde la raíz del repo:

```bash
# 20261117l: ya aplicada el 2026-11-24 (no hace falta repetirla; es idempotente)
npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261117l_whatsapp_suppressed_phones.sql | grep -v -E '^(BEGIN|COMMIT);$')"

# 20261117m: solo si el usuario decide aplicarla (ver más abajo)
npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261117m_booking_events_rls.sql | grep -v -E '^(BEGIN|COMMIT);$')"

# 20261117n: solo si el usuario decide aplicarla (ver más abajo)
npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261117n_profiles_email_guard.sql | grep -v -E '^(BEGIN|COMMIT);$')"
```

Cada una se envía como una sola consulta. Verificar siempre después:

```bash
# l: debe devolver la tabla, con RLS activada y sin políticas
npx -y @insforge/cli@latest db query "SELECT c.relname, c.relrowsecurity, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS politicas FROM pg_class c WHERE c.relname = 'whatsapp_suppressed_phones'"

# m: relrowsecurity debe pasar a true
npx -y @insforge/cli@latest db query "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'booking_events'"

# n: debe devolver true
npx -y @insforge/cli@latest db query "SELECT pg_get_functiondef('public.profiles_guard_role'::regproc) LIKE '%NEW.email := OLD.email%' AS guards_email"
```

### `20261117l`: por qué es obligatoria

Guarda los **números** que han escrito STOP o BAJA, aunque no coincidan con ningún contacto. El consentimiento vive en el contacto, pero el formulario público de reserva también guarda el teléfono tal como se escribe: alguien puede reservar con su propio correo, el número de otra persona y la casilla marcada, y el centro escribiría a esa otra persona. Un STOP desde ese número es la respuesta de esa persona y se recuerda por número. Nada que haga un formulario, una casilla o `upsert_contact` lo levanta; solo una administradora, desde la ficha del contacto.

**Falla cerrado.** Mientras la tabla no exista, leerla da error y el código **no envía ningún WhatsApp**, ni a clientas ni en campañas (los correos no la leen). Es decir, aplicarla es lo que habilita el envío. Los avisos al personal por WhatsApp no leen esta tabla y no se ven afectados.

### `20261117m`: decisión del usuario

`booking_events` se creó sin RLS con el comentario "se lee solo con la clave de servicio", pero con RLS apagada la clave anon del navegador también puede leerla. Guarda en `summary` el nombre de la clienta y la fecha de la reserva, y en `recipient` el teléfono completo o el correo de cada destinataria.

Se comprobó (releyendo el código el 2026-11-17) que **es seguro activarla**:

- Todo lector y escritor usa `getAdminClient()` (clave de servicio, que se salta RLS): `app/actions/booking-events.ts:36`, `app/lib/booking-events/record.ts:42`, `app/api/webhooks/whatsapp/route.ts:504`, `app/api/webhooks/resend/route.ts:165`, `app/api/[transport]/tools/bookings.ts:169` (MCP) y `app/services/booking-payments.service.ts:57`.
- Ninguna página del dashboard ni componente del navegador la consulta.
- No hay función SQL, vista ni disparador que la lea (consulta a `pg_proc`, `pg_views` y `pg_trigger` sin resultados).
- Activar RLS sin políticas no cambia nada para la aplicación y cierra la lectura con la clave anon.

Reversible: `ALTER TABLE booking_events DISABLE ROW LEVEL SECURITY;`. Las demás tablas internas sin RLS son otro asunto, porque algunas sí las lee el navegador: ver `2026-11-17-whatsapp-findings.md`.

### `20261117n`: decisión del usuario

Hoy una usuaria con sesión puede reescribir el `email` de **su propio** perfil desde el navegador (política `users_update_own_profile`, privilegio de columna, y el trigger `profiles_guard_role` solo protege `role`). Ese correo se leía como dirección verificada, así que quien lo cambiara por el de otra persona podía darla de baja de la newsletter o registrar un consentimiento en su contacto. El código ya no se fía de esa columna para eso (el guard entrega aparte el correo de la sesión); la migración cierra la puerta por debajo: amplía `profiles_guard_role` para que, a quien no es admin, un `email` distinto se le devuelva al guardado, igual que ya hace con `role`.

**Es seguro aplicarla** (comprobado en `app/` el 2026-11-17): ninguna pantalla cambia `profiles.email` desde el navegador. La única escritura del navegador sobre `profiles` es la página "Mi cuenta" del panel (nombre, teléfono, idioma, avatar); el cambio de correo de una persona del equipo va por `updateUserProfile` con la clave de servicio, que el trigger deja pasar. Vuelta atrás: aplicar de nuevo `20260810e_profiles_guard_role_tolerates_api_key.sql`.

---

## 3. Plantillas de Meta

Se crean desde **Ajustes → Plantillas de WhatsApp** (el panel las envía a Meta y las sincroniza) y las aprueba Meta en minutos o días.

- **Cuerpo.** Variables como `{{1}}`, `{{2}}`…, consecutivas, **ni al principio ni al final del texto** (Meta lo rechaza; el panel también). Cada variable necesita un **ejemplo**; sin ejemplos Meta no la revisa.
- **Cabecera.** Sin cabecera o solo de texto **sin variables**. Una cabecera multimedia (imagen, vídeo, documento) o con variable hace que la plantilla salga marcada como no enviable (`media_header`, `header_variable`).
- **Botones.** Solo respuesta rápida o enlace con dirección **fija**. Un botón de enlace con valor variable (`{{1}}` en la dirección), de llamada u otro tipo no se puede enviar desde el panel (`button_type`, o `button_params` al enviar): ese valor no lo rellena nadie.
- **Categoría.** `UTILITY` para los avisos de la cita (confirmación, aviso de cita). `MARKETING` para campañas de novedades y ofertas. La categoría decide el precio y qué consentimiento hace falta; Meta puede reclasificarla.
- **Idioma por plantilla.** Cada plantilla tiene un idioma. Hace falta **una plantilla aprobada por cada idioma** que se vaya a usar, con el mismo nombre base distinto (p. ej. `cita_confirmada_es`, `cita_confirmada_en`). El panel solo ofrece las del idioma del envío (`es_ES` sirve para `es`).
- **Pie de baja.** Las plantillas de campaña deberían decir cómo darse de baja. Texto sugerido para el pie: "Responde BAJA para dejar de recibir estos avisos." (en inglés, "Reply STOP to stop receiving these messages."). El código reconoce exactamente las palabras `STOP` y `BAJA`, con o sin mayúsculas, acentos o puntuación alrededor (`CANCELAR` no cuenta a propósito: una clienta que lo escribe casi siempre se refiere a su cita).
- **Solo se envía** una plantilla con estado `APPROVED` y sin motivo de no soporte. Si una plantilla deja de estarlo (pausada, rechazada), la campaña que la usa no se puede activar ni programar, y el panel dice por qué.

---

## 4. Orden de puesta en marcha

1. Pasos de Meta (sección 1, puntos 1 a 4). Esperar la verificación del negocio si hace falta.
2. Aplicar la migración `l` y verificarla. Decidir sobre la `m` (sección 2).
3. Cargar las variables de entorno en Vercel y **volver a desplegar**.
4. Suscribir el webhook (punto 6). Comprobar que Meta lo acepta (devuelve el desafío si el token coincide).
5. En **Ajustes → Plantillas de WhatsApp**, crear las plantillas necesarias y esperar la aprobación; la tarjeta se actualiza sola desde Meta al llegar a ella (y un cron lo hace cada hora): comprobar que salen `APPROVED`.
6. En **Ajustes → Mensajes automáticos**, para cada aviso inmediato a la clienta (confirmación y confirmación de pago) y cada idioma, elegir la plantilla y mapear sus parámetros. Hasta que no hay fila de WhatsApp para un aviso, ese aviso no sale por WhatsApp. El recordatorio y los demás avisos con hora (48 h antes, 2 h antes, 24 h después de la visita…) **no** se configuran aquí: son campañas de tipo **aviso de cita** (paso 7).
7. En **Campañas**, crear uno o varios **avisos de cita** por WhatsApp: se elige cuándo (de 1 a 336 horas **antes** de la cita, o de 1 a 720 horas **después**), la plantilla y los parámetros, y se activa.
8. **Piloto** (siguiente sección). Solo después, abrir las casillas de WhatsApp a las clientas reales y crear campañas.

### Piloto con uno o dos contactos propios

1. Crear (o usar) dos contactos con teléfonos del equipo mediante el formulario público de reserva (la ficha del contacto tiene dos interruptores que guardan al instante, "Avisos de la cita" y "Novedades y ofertas", este último un solo consentimiento para correo y WhatsApp): aceptar los Términos y la Política (eso da el consentimiento de los avisos de la cita) y marcar la casilla opcional de novedades y ofertas (correo y WhatsApp a la vez). Una reserva creada desde el dashboard NO registra consentimiento: habría que activarlo en la ficha.
2. **Enviar prueba** desde el editor del mensaje y desde el paso de revisión de una campaña: el mensaje va al teléfono del perfil de quien pulsa, no a otro. Comprobar que llega, con los parámetros bien rellenados.
3. Hacer una **reserva real de prueba** con el teléfono de un contacto del piloto desde el formulario público (aceptando los Términos y la Política), y confirmarla desde el dashboard (o pagarla): llega el correo y, si hay fila de WhatsApp, el WhatsApp; la reserva muestra en su historial el estado `sent`, luego `delivered`, luego `read`.
4. **STOP.** Desde ese teléfono responder `BAJA` (o `STOP`). Comprobar que: la ficha del contacto muestra la baja y el número en la lista de exclusión; una nueva reserva con ese número, aceptando los Términos, **no** reactiva los avisos de la cita ni vuelve a recibir WhatsApp; una campaña de prueba lo deja fuera (`[skipped]` o fuera de la audiencia). Solo una administradora puede quitar el número, desde la ficha.
5. **Reintento.** Provocar un fallo (p. ej. un contacto cuyo número no tenga WhatsApp) y usar la acción de reintentar las fallidas de la campaña: **no** debe reenviar las filas que digan `[unconfirmed]` (pudieron llegar) ni `[skipped]` (se omitieron por falta de consentimiento); solo las demás. Un número sin WhatsApp (error 131026 de Meta) queda marcado como no alcanzable y se excluye de las campañas siguientes.
6. Campaña de prueba de 2 destinatarias: comprobar que la audiencia, el recuento y el informe (enviado, entregado, leído) coinciden con lo recibido.

---

## 5. Efectos que conviene conocer

1. **El recordatorio de WhatsApp ahora es un aviso de cita, y no hay ráfaga inicial.** El recordatorio fijo por WhatsApp se retiró (si no, una clienta recibiría dos). Un aviso de cita es una campaña automatizada que mira **cada reserva confirmada** de la clienta: avisa desde N horas antes del comienzo (o N horas después del final) y **solo si ese momento no es anterior a la activación de la campaña**. Activarlo no avisa a las reservas que ya estaban dentro de su ventana: solo las que lleguen a su momento a partir de ahí. Es un aviso **por reserva y por campaña**, aunque el cron corra solapado. **Retraso:** el cron de campañas corre cada 15 minutos, así que un aviso puede llegar hasta 15 minutos después de su momento. **Plazo:** un aviso solo sale en los **45 minutos** siguientes a su momento (antes de la cita) o en las **3 horas** siguientes (después de ella). Pasado ese plazo el aviso **se pierde**, no se manda tarde: así una reserva hecha 30 minutos antes no dispara de golpe los avisos de 48 h, 24 h y 2 h, y una campaña pausada varios días no manda el atraso al reanudarla. Si el cron cae más de 45 minutos justo en el momento de un aviso "antes", ese recordatorio no sale; la confirmación inmediata cubre las reservas de última hora. **Reprogramar** una reserva no reenvía el aviso (es uno por reserva y campaña). Una reserva sin hora se trata como si empezara a medianoche. **Consentimiento:** es un aviso transaccional, necesita "Avisos de la cita" (`whatsapp_opted_in_at`), no el de novedades y ofertas; las reservas que crea el equipo desde el dashboard no lo registran. La columna `bookings.whatsapp_reminder_sent_at` (migración `k`) queda **obsoleta y sin uso**: se deja en la base de datos, sin cambios. El correo del recordatorio no cambia.
2. **El idioma por defecto del contacto es inglés.** La columna `contacts.preferred_language` tiene `DEFAULT 'en'`. El idioma de un aviso por WhatsApp es el que declara quien lo envía, si no el del contacto, si no español. Un contacto sin idioma explícito se lee como inglés: sin fila de WhatsApp y plantilla aprobada **para cada idioma**, esos avisos quedan sin enviar. (El recordatorio por correo va siempre en español.)
3. **Una plantilla mal configurada deja una marca.** Si la plantilla elegida no es enviable (no aprobada, idioma que no coincide, parámetros que no cuadran, botón con valor), el aviso a la clienta **no sale** y la reserva muestra una entrada `skipped` con el motivo, una sola vez por aviso. Es la señal para corregir la fila.
4. **Límite por ejecución.** Una campaña de WhatsApp (un aviso de cita incluido) envía unos **450 mensajes por ejecución** del cron (10 por segundo durante 45 segundos), y el cron corre cada 15 minutos. Una campaña grande se completa en varias pasadas, sin duplicar envíos. Si Meta rechaza tres tandas seguidas por la misma causa, el envío se detiene (la campaña pasa a fallida, una automatización a pausada) con el motivo.
5. **Coste.** Cada mensaje de plantilla tiene un coste por categoría y país que fija Meta. El panel no lo calcula.
6. **Sin cuenta, nada se rompe.** Sin las variables, o con Meta caído, los avisos a clientas no salen y las reservas, pagos y correos siguen como siempre.

---

## 6. Política de privacidad: falta la cláusula para clientas

La política actual (`app/(site)/[locale]/(page)/(legal)/privacy/content-es.tsx` y `content-en.tsx`) solo menciona WhatsApp en el apartado 6 de comunicación de datos, para **el personal** ("Meta (notificaciones por WhatsApp a nuestro personal)"). No describe el WhatsApp a clientas: ni las finalidades, ni la base legal, ni cómo darse de baja. **Falta contenido y no está escrito en el sitio.**

**Estado.** La cláusula ya está **escrita en la política** (`privacy/content-es.tsx` y `content-en.tsx`, dentro del apartado 4, con un comentario `DRAFT` en el código) y en el desplegable "Información sobre protección de datos" del formulario de reserva (`messages/*/booking.json`, `detailsStep.purposeValue`, `legalBasisValue`, `optOutValue`). Está **en la rama, sin publicar**, y es un **borrador que debe REVISAR UN ABOGADO antes de publicarla**. La forma de darse de baja **no se escribe bajo las casillas** del formulario: se explica solo en ese desplegable (el consentimiento de novedades y ofertas se retira en cualquier momento, con el enlace de baja de cada correo y respondiendo BAJA por WhatsApp) y en la política. No se tocaron los Términos y condiciones (son un documento contractual): la casilla de consentimiento los cita junto a la política, y el abogado dirá si deben mencionar los avisos por WhatsApp.

El diseño que recoge es el que pidió el centro:

> **REVISAR POR UN ABOGADO**
>
> - Al reservar, **aceptar los Términos y la Política** permite enviar por **correo y WhatsApp** la confirmación y el recordatorio de la cita (finalidad: gestionar la reserva; base: ejecución del servicio reservado).
> - Las **novedades y ofertas** (por correo y por WhatsApp, una sola casilla opcional, sin marcar por defecto) se basan en el consentimiento y no condicionan la reserva.
> - **Baja:** respondiendo BAJA o STOP a un WhatsApp (detiene todos los mensajes de WhatsApp), con el enlace de los correos o escribiendo al centro. Un STOP guarda el número en una lista de exclusión que ningún formulario levanta.
> - Datos: teléfono y correo. Encargado: Meta Platforms Ireland Limited (WhatsApp Business Platform), con posibles transferencias internacionales.

Puntos que el abogado debería decidir: si aceptar los Términos y la Política basta como consentimiento de los avisos por WhatsApp o si debe ser una casilla propia (el centro decidió que basta), y el texto exacto de la base legal para los avisos de la cita; el plazo de conservación del consentimiento y de la lista de exclusión; si basta con la casilla o hace falta confirmar el número (ver hallazgo "el consentimiento por casilla no verifica la propiedad del número" en `2026-11-17-whatsapp-findings.md`); y la mención de las transferencias internacionales.

> **NO desplegar la página de privacidad con la cláusula nueva hasta la revisión legal.** El `DRAFT` del código es un comentario JSX que los usuarios no ven, así que el texto se publicaría tal cual. La cláusula y el desplegable del formulario están en la rama y no deben llegar a producción sin que un abogado los revise.

**La política debe publicarse (ya revisada) antes de activar WhatsApp con clientas:** hasta entonces, la casilla de términos ya promete los avisos por WhatsApp y la política publicada todavía no los describe.

**Pendiente para el abogado: el apartado "Datos de comunicaciones".** El apartado 2 de la Política ("Datos de comunicaciones" en `content-es.tsx`, "Communications data" en `content-en.tsx`) no nombra los mensajes de WhatsApp ni los estados de entrega y lectura que se guardan de cada uno (enviado, entregado, leído, fallido, en el historial de la reserva y en los informes de campañas). Que decida si deben constar ahí y con qué plazo de conservación.
