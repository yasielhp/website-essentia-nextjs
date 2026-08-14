# Poner en marcha las notificaciones de WhatsApp al personal

Fecha: 2026-08-11

Guía operativa, paso a paso, para el día que exista el número de WhatsApp
Business. El diseño y el porqué de cada decisión están en
[`docs/plans/2026-08-10-whatsapp-staff-notifications-design.md`](plans/2026-08-10-whatsapp-staff-notifications-design.md);
aquí solo está lo que hay que hacer.

**No hay que escribir ni desplegar código.** Todo lo de esta guía es
configuración: Meta, la base de datos y variables de entorno.

---

## 0. Qué hace la función y qué no

Manda un WhatsApp **al profesional**, nunca al cliente, cuando una reserva suya:

| Evento        | Cuándo salta                                                     |
| ------------- | ---------------------------------------------------------------- |
| `assigned`    | se le asigna una reserva, nueva o hasta entonces sin profesional |
| `unassigned`  | se le retira porque pasa a otra persona                          |
| `rescheduled` | cambia de fecha u hora sin cambiar de profesional                |
| `cancelled`   | se cancela, desde el dashboard o por el propio cliente           |

**El admin recibe siempre una copia**, con el mismo texto y dirigido al
profesional por su nombre: se lee como «esto es lo que le ha llegado a Yuli»,
igual que el BCC que `sendEmail()` ya hace en todos los correos. Si el admin es
además el profesional asignado, recibe un solo mensaje, no dos.

**Todo sale en español.** El idioma no se deduce de `preferred_language`: es una
constante, `WHATSAPP_TEMPLATE_LANGUAGE` en `app/lib/whatsapp/client.ts`. Meta
rechaza un envío en un idioma que la plantilla no tenga registrado, y solo está
registrado el español; dejarlo depender de un campo editable desde el dashboard
convertiría un cambio de preferencia en un fallo de entrega. Para volver a tener
inglés hay que aprobar antes el cuerpo inglés en Meta.

Los correos actuales al cliente y el `staff-new-booking` siguen igual. WhatsApp
se suma, no sustituye.

## Estado a día de hoy

| Pieza                                           | Estado                                            |
| ----------------------------------------------- | ------------------------------------------------- |
| Código (`app/lib/whatsapp/`, puntos de llamada) | Terminado                                         |
| Tabla del historial                             | `booking_events` (`20260814b_booking_events.sql`) |
| Bloque en el detalle de reserva del dashboard   | Terminado                                         |
| Número dedicado                                 | Contratado: `+34 711 51 00 31` (eSIM)             |
| Número registrado en Meta                       | Hecho — `id` 1313219501872182, `CONNECTED`        |
| Token permanente                                | Hecho, en `.env.local`                            |
| Plantilla aprobada                              | Activa desde el 13-08-2026, categoría Utilidad    |
| Variables en Vercel                             | Puestas las seis, desplegadas                     |
| Teléfono en los perfiles del personal           | 3 de 6 (Yuli, Dolly, Jesús) + el admin            |
| Webhook de estados (`/api/webhooks/whatsapp`)   | Dado de alta y suscrito a `messages`              |
| Entrega verificada                              | 14-08-2026: `read` en ambos números               |

Mientras falten el token o el `PHONE_NUMBER_ID`, la función corre en seco: cada
evento escribe su fila con estado `skipped` y el texto que se habría mandado,
sin llamar a Meta. Sirve para dar por bueno el redactado antes de tocar nada.

---

## 1. Antes de empezar: el número

El número es **`+34 711 51 00 31`**, una eSIM nueva contratada para esto. No
aparece en ningún sitio del código: lo único que el código necesita de Meta es
el identificador del paso 2, no el teléfono.

> **No instales WhatsApp ni WhatsApp Business en esa línea.** El alta en la
> Cloud API exige que el número no tenga cuenta previa, y una vez registrado ahí
> deja de poder usarse en la app del móvil.

Requisitos del número que vayas a registrar:

- **No puede estar dado de alta en WhatsApp normal ni en WhatsApp Business (la
  app del móvil).** Si lo está, hay que borrar esa cuenta primero, y con ella se
  pierde su historial. Lo sano es un número nuevo dedicado.
- Tiene que poder recibir una llamada o un SMS de verificación una sola vez, en
  el alta.
- Puede ser fijo o móvil.
- No uses el número de atención al público que ya está en la web
  (`+34 634 09 12 95`) si ese teléfono tiene WhatsApp instalado.

Necesitas además una cuenta de **Meta Business** con el negocio verificado. La
verificación del negocio la pide Meta para subir los límites de envío y puede
tardar días: si va a hacer falta, empieza por ahí.

## 2. Registrar el número

1. Entra en [business.facebook.com](https://business.facebook.com) → **WhatsApp
   Manager**.
2. **Añadir número de teléfono**, y completa la verificación por SMS o llamada.
3. Ponle nombre para mostrar y categoría al perfil. El nombre lo revisa Meta.

Al terminar, en **WhatsApp** → **Configuración de la API** verás el número y,
justo debajo, su **Identificador del número de teléfono**. Ese identificador es
un número largo, del estilo `123456789012345`, y **no es el teléfono**: es lo
que va en `WHATSAPP_PHONE_NUMBER_ID`. Es el valor que confunde a todo el mundo.

## 3. Crear la plantilla

Sin plantilla aprobada no sale ni un mensaje: fuera de la ventana de 24 horas
Meta solo entrega plantillas. El código llama a **una** plantilla parametrizada
que cubre los cuatro eventos.

En **WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**:

| Campo     | Valor                               |
| --------- | ----------------------------------- |
| Nombre    | `essentia_booking_update`           |
| Categoría | `Utilidad` (UTILITY) — no Marketing |
| Idioma    | Español, y solo español             |

**Cuerpo tal y como está registrado**, con cinco variables:

```
Hola {{1}}, tienes una actualización sobre una reserva de Essentia Social Wellness Club. {{2}}. A continuación tienes los detalles de la reserva. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}. Puedes consultar todos los detalles en el botón de abajo.
```

Qué viaja en cada variable:

| Variable | Contenido                                 | Ejemplo para el formulario de Meta    |
| -------- | ----------------------------------------- | ------------------------------------- |
| `{{1}}`  | Nombre de pila del profesional            | `Yuli`                                |
| `{{2}}`  | La frase del evento                       | `Se te ha asignado una sesión`        |
| `{{3}}`  | Nombre del cliente                        | `María López`                         |
| `{{4}}`  | Servicio, con el tipo de sesión si lo hay | `Terapias manuales — ESPIRA`          |
| `{{5}}`  | Fecha y hora ya formateadas               | `martes, 12 de agosto de 2026, 10:30` |

Meta exige un ejemplo por variable para revisar la plantilla: usa los de la
columna de la derecha.

El texto de alrededor puede reescribirse sin tocar código, pero **los cinco
huecos tienen que seguir siendo cinco y en este orden**: Meta los coloca por
posición, y uno de más o de menos hace fallar todos los envíos. Y si `{{2}}`
deja de abrir frase, las cuatro frases de `messages.ts` vuelven a minúscula.

**Botón** — tipo **Visitar sitio web**, **URL dinámica**:

```
https://www.essentiawellnessclub.com/dashboard/bookings/{{1}}
```

Ejemplo para la revisión: cualquier UUID, por ejemplo
`3f7c1e02-9b4a-4f21-8f0e-2c5d7a91b334`.

Esa URL base se escribe **literal en Meta**; el código solo manda el id de la
reserva como parámetro del botón. Si el dominio de producción cambiara algún
día, hay que editar la plantilla en Meta y pasar otra revisión.

> Las cuatro frases del evento (`{{2}}`) están fijadas en
> `app/lib/whatsapp/messages.ts`, no en los ficheros de traducción. Es
> deliberado: tienen que coincidir con lo aprobado. Si cambias el redactado,
> cambia también la plantilla en Meta.

La aprobación de una plantilla de utilidad suele tardar de minutos a unas horas.

## 4. Sacar el token

Para probar, en **Configuración de la API** hay un token temporal que caduca a
las 24 horas. Vale para el primer envío de prueba y para nada más.

Para producción, token permanente de usuario del sistema:

1. **Configuración del negocio** → **Usuarios** → **Usuarios del sistema** →
   crear uno, rol **Administrador**.
2. **Añadir activos**, dos veces: la **app** de WhatsApp y la **cuenta de
   WhatsApp Business**, ambas con control total. Asignar solo la segunda deja un
   token que no puede llamar a la API.
3. **Generar token** → app correspondiente → permisos
   `whatsapp_business_messaging`, `whatsapp_business_management` y
   `business_management` → **caducidad: nunca**.
4. Copia el token en ese momento. No se vuelve a mostrar.

**El token es una credencial con la que se puede mandar mensajes en nombre del
centro.** No lo pegues en Slack, ni en un correo, ni en ningún fichero que vaya
a git. Va solo en `.env.local` (que está en `.gitignore`) y en las variables de
entorno de Vercel.

## 5. Rellenar el teléfono de cada profesional

Este paso es el que más silenciosamente rompe todo lo demás. Hoy **ninguno de
los 6 perfiles tiene teléfono**, y sin teléfono la función sale antes de llamar
a Meta y **sin dejar ninguna fila** en el dashboard: no hay error que mirar,
simplemente no pasa nada.

Para cada persona: **Dashboard** → **Usuarios** → abrir el perfil → campo
**Teléfono** → guardar.

Hazlo con los 3 perfiles de rol `staff` y con el `admin` si también tiene que
recibir avisos.

El formato da igual. `toE164()` en `app/lib/whatsapp/client.ts` acepta
`600 11 22 33`, `600-112-233`, `+34600112233` o `0034600112233`, y añade el
prefijo `+34` cuando el número tiene nueve dígitos y no trae ninguno. Un número
extranjero conserva su propio prefijo, siempre que se escriba con `+` o con
`00`.

El profesional tiene que tener WhatsApp activo en ese número. Si no, Meta acepta
el envío y luego lo marca como no entregable.

## 6. Poner las variables

### En local

El bloque ya está al final de `.env.local`. Rellena las dos primeras:

```
WHATSAPP_ACCESS_TOKEN=<el token>
WHATSAPP_PHONE_NUMBER_ID=<el identificador del paso 2>
WHATSAPP_TEMPLATE_NAME=essentia_booking_update
WHATSAPP_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=<una cadena larga que te inventas>
WHATSAPP_APP_SECRET=<el app secret de Meta>
```

Las dos últimas son del webhook del paso 7. Sin ellas los mensajes se envían
igual, pero se quedan para siempre en `Aceptado por Meta`.

Reinicia el servidor de desarrollo: Next.js lee el `.env` al arrancar y no
recarga los cambios en caliente.

### En producción

Vercel → proyecto → **Settings** → **Environment Variables**. Las mismas seis,
en **Production** (y en **Preview** solo si quieres que las ramas de prueba
manden mensajes de verdad — normalmente no).

**Un cambio de variables no se aplica solo: hay que volver a desplegar.**

Comprueba también que `NEXT_PUBLIC_APP_URL` en Vercel apunta al dominio real y
sin barra final. No interviene en el botón de la plantilla, pero sí en el resto
de enlaces absolutos del sistema.

## 7. Enganchar el webhook de estados

Un `sent` significa que Meta aceptó el mensaje, y nada más. Que el móvil lo
recibiera, que la persona lo abriera, o que el número resultara no tener
WhatsApp, Meta lo cuenta **solo** por webhook. Sin este paso, un aviso que no
llegó nunca es indistinguible de uno que sí, que es exactamente la avería que
costó una tarde entera de diagnóstico el 14 de agosto de 2026.

La ruta ya existe: `app/api/webhooks/whatsapp/route.ts`, servida en

```
https://www.essentiawellnessclub.com/api/webhooks/whatsapp
```

1. **Saca el app secret.** [developers.facebook.com](https://developers.facebook.com)
   → tu app → **Configuración** → **Básica** → **Clave secreta de la
   aplicación** → **Mostrar**. Va en `WHATSAPP_APP_SECRET`.
2. **Inventa el verify token.** Cualquier cadena larga y aleatoria; no la da
   Meta. Ponla en `WHATSAPP_VERIFY_TOKEN` y ten a mano la misma cadena.
3. **Despliega con las dos variables puestas.** El handshake del paso siguiente
   lo hace Meta contra producción, así que tienen que estar ya en Vercel.
4. **Da de alta el webhook.** En la app de Meta → **WhatsApp** → **Configuración**
   → **Webhooks** → **Editar**: la URL de arriba en _Callback URL_ y tu cadena
   en _Verify token_. Meta llama al `GET` en ese momento; si las cadenas
   coinciden, se guarda.
5. **Suscríbete al campo `messages`.** En la misma pantalla, **Administrar** →
   marca `messages`. Es el campo que trae los estados; sin él el webhook queda
   dado de alta y mudo.

6. **Comprueba que la cuenta de WhatsApp está suscrita a la app.** Este paso no
   existe en la interfaz de Meta y es el que se traga las horas:

   ```
   GET  https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps
   POST https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps
   ```

   con el `Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>`. El `WABA_ID` sale de
   la URL de WhatsApp Manager, en `selected_asset_id`. Si el `GET` devuelve
   `{"data":[]}`, la app tiene su URL y sus campos pero **ninguna cuenta le
   manda nada**: el asistente pinta el check verde en cuanto guardas la URL,
   aunque no haya nadie al otro lado. El `POST`, sin cuerpo, lo arregla. Pasó
   exactamente esto el 14-08-2026.

A partir de ahí cada fila del dashboard avanza sola:

```
Aceptado por Meta → Entregado → Leído
                  ↳ Fallido (con el motivo que dé Meta)
```

Los callbacks llegan desordenados y repetidos —un `read` puede adelantar a su
`delivered`—, así que la ruta solo deja avanzar, nunca retroceder.

Firma obligatoria: cada callback viene firmado con el app secret en
`X-Hub-Signature-256` y la ruta rechaza con `403` lo que no cuadre. Es una URL
pública que escribe en la base de datos; sin la firma cualquiera podría marcar
como leído un aviso perdido. Si `WHATSAPP_APP_SECRET` falta o es el de otra app,
**se rechaza todo** y las filas se quedan clavadas en `Aceptado por Meta`; el
motivo queda en los logs de Vercel como
`[webhooks/whatsapp] rejected: bad or missing signature`.

## 8. Probar

### Antes de tener credenciales — ensayo en seco

Ya funciona hoy, y merece la pena hacerlo para validar el redactado:

1. Crea una reserva con profesional asignado.
2. Reasígnala a otra persona.
3. Cámbiale la hora.
4. Cancélala.

En **Dashboard** → **Reservas** → abrir la reserva, el bloque **Notificaciones
de WhatsApp** debe mostrar cuatro filas en estado `skipped`, cada una con el
texto que se habría enviado. Si sale vacío, es que el profesional no tiene
teléfono en su perfil: vuelve al paso 5.

### Con credenciales — envío real

Repite la prueba con tu propio número puesto en un perfil de staff.

Qué esperar en el bloque del dashboard:

| Estado en el dashboard | Qué significa                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ |
| `Aceptado por Meta`    | La Cloud API lo cogió y devolvió un `wamid`. Aún no ha llegado a ningún móvil. |
| `Entregado`            | Llegó al teléfono. Lo confirma el webhook del paso 7.                          |
| `Leído`                | La persona lo abrió. También del webhook.                                      |
| `Fallido`              | Rechazado en el envío o no entregable después. La fila muestra el motivo.      |
| `Sin enviar`           | Falta el token o el `PHONE_NUMBER_ID`. No se llamó a Meta.                     |

Si una fila se queda en `Aceptado por Meta` y no pasa nunca a `Entregado`, el
problema es el webhook o el número de destino, no el envío. Empieza por el paso 7.

## 9. Si algo falla

Lo primero, siempre: leer el texto del error en la fila `failed` del dashboard.
El código guarda literal lo que responde Meta (`error_data.details`, o
`error.message`), así que ahí está el diagnóstico.

Los tropiezos habituales, por orden de frecuencia:

- **No aparece ninguna fila.** Ni el profesional ni ningún admin tienen
  teléfono en el perfil, o la reserva no tenía profesional asignado. No es un
  fallo de WhatsApp.
- **Falta la copia del admin.** El perfil con rol `admin` no tiene teléfono, o
  es el mismo número que el del profesional: entonces sale un solo mensaje a
  propósito.
- **Todo sale `skipped` con las variables puestas.** No reiniciaste el servidor
  local, o en Vercel no volviste a desplegar tras añadirlas.
- **La plantilla no existe.** El nombre en Meta no coincide exactamente con
  `WHATSAPP_TEMPLATE_NAME`, o le falta el español, que es el único idioma que el
  código pide.
- **Número de parámetros incorrecto.** El cuerpo de la plantilla no tiene las
  cinco variables, o al botón le falta la suya.
- **Token caducado o inválido.** Es el token temporal de 24 horas. Genera el
  permanente del paso 4.
- **Mensaje no entregable.** Ese número no tiene WhatsApp, o está mal escrito en
  el perfil. Ahora se ve: la fila pasa a `Fallido` con el motivo de Meta —
  típicamente `131026 Message undeliverable`.
- **Todo se queda en `Aceptado por Meta`.** El webhook del paso 7 no está dado
  de alta, no está suscrito al campo `messages`, o `WHATSAPP_APP_SECRET` no es
  el de esta app y la ruta rechaza cada callback. Míralo en los logs de Vercel.

Nada de esto rompe una reserva. `notifyStaffOnWhatsApp` no lanza excepciones y
todos los puntos de llamada envuelven la llamada: si WhatsApp cae, la reserva se
guarda igual y solo se pierde el aviso.

## 10. Volver atrás

Vacía `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` y vuelve a desplegar.
La función regresa al ensayo en seco: sigue registrando cada evento en el
dashboard y deja de mandar nada. No hace falta tocar código ni revertir ningún
commit.

## 11. Coste y límites

Las conversaciones de servicio iniciadas por el negocio con plantilla de
utilidad tienen una franquicia mensual holgada para el volumen de un centro como
este; a partir de ahí Meta cobra por conversación de 24 horas, no por mensaje.
Los cuatro eventos de una misma reserva a la misma persona en el mismo día caen
dentro de la misma conversación.

Cuenta que cada evento abre **dos** conversaciones, no una: la del profesional y
la copia del admin.

Un número recién registrado arranca con un límite bajo de destinatarios diarios,
que Meta va subiendo solo. Para tres profesionales y un admin, el límite inicial
sobra.

---

## Lista de comprobación

- [ ] Número dedicado, sin cuenta de WhatsApp previa
- [ ] Negocio verificado en Meta Business
- [ ] Número registrado y verificado en WhatsApp Manager
- [ ] Apuntado el **identificador del número** (no el teléfono)
- [ ] Plantilla `essentia_booking_update` creada en español
- [ ] Plantilla con las 5 variables del cuerpo y el botón de URL dinámica
- [ ] Plantilla **aprobada** por Meta
- [ ] Token permanente de usuario del sistema, sin caducidad
- [ ] Teléfono relleno en los 3 perfiles `staff`
- [ ] Teléfono relleno en el perfil `admin` — sin él no hay copia de nada
- [ ] Las 6 variables en `.env.local`, servidor reiniciado
- [ ] Las 6 variables en Vercel (Production), **redesplegado**
- [ ] Webhook dado de alta en Meta con la URL `/api/webhooks/whatsapp`
- [ ] Suscripción al campo `messages` marcada
- [ ] Prueba real: fila `Aceptado por Meta` en el detalle de la reserva
- [ ] La misma fila pasa a `Entregado` en segundos — si no, el webhook no llega
- [ ] Mensaje recibido en el móvil, con el botón apuntando a la reserva correcta
