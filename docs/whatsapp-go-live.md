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

Los correos actuales al cliente y el `staff-new-booking` siguen igual. WhatsApp
se suma, no sustituye.

## Estado a día de hoy

| Pieza                                           | Estado                                     |
| ----------------------------------------------- | ------------------------------------------ |
| Código (`app/lib/whatsapp/`, puntos de llamada) | Terminado                                  |
| Tabla `whatsapp_messages`                       | Migrada (`20260810_whatsapp_messages.sql`) |
| Bloque en el detalle de reserva del dashboard   | Terminado                                  |
| Variables en `.env.local`                       | Bloque creado, las dos secretas vacías     |
| Variables en Vercel                             | **Pendiente**                              |
| Número registrado en Meta                       | **Pendiente**                              |
| Plantilla aprobada                              | **Pendiente**                              |
| Teléfono en los perfiles del personal           | **Pendiente — 0 de 6 perfiles lo tienen**  |

Mientras falten el token o el `PHONE_NUMBER_ID`, la función corre en seco: cada
evento escribe su fila con estado `skipped` y el texto que se habría mandado,
sin llamar a Meta. Sirve para dar por bueno el redactado antes de tocar nada.

---

## 1. Antes de empezar: el número

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
| Idiomas   | Español **y** Inglés, las dos       |

**Cuerpo en español**, con cinco variables y exactamente esta puntuación:

```
Hola {{1}}, {{2}}. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}.
```

**Cuerpo en inglés:**

```
Hi {{1}}, {{2}}. Client: {{3}}. Service: {{4}}. When: {{5}}.
```

Qué viaja en cada variable:

| Variable | Contenido                                 | Ejemplo para el formulario de Meta    |
| -------- | ----------------------------------------- | ------------------------------------- |
| `{{1}}`  | Nombre de pila del profesional            | `Yuli`                                |
| `{{2}}`  | La frase del evento                       | `se te ha asignado una sesión`        |
| `{{3}}`  | Nombre del cliente                        | `María López`                         |
| `{{4}}`  | Servicio, con el tipo de sesión si lo hay | `Terapias manuales — ESPIRA`          |
| `{{5}}`  | Fecha y hora ya formateadas               | `martes, 12 de agosto de 2026, 10:30` |

Meta exige un ejemplo por variable para revisar la plantilla: usa los de la
columna de la derecha.

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
2. **Añadir activos** → la cuenta de WhatsApp Business → control total.
3. **Generar token** → app correspondiente → permisos `whatsapp_business_messaging`
   y `whatsapp_business_management` → **caducidad: nunca**.
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
```

Reinicia el servidor de desarrollo: Next.js lee el `.env` al arrancar y no
recarga los cambios en caliente.

### En producción

Vercel → proyecto → **Settings** → **Environment Variables**. Las mismas cuatro,
en **Production** (y en **Preview** solo si quieres que las ramas de prueba
manden mensajes de verdad — normalmente no).

**Un cambio de variables no se aplica solo: hay que volver a desplegar.**

Comprueba también que `NEXT_PUBLIC_APP_URL` en Vercel apunta al dominio real y
sin barra final. No interviene en el botón de la plantilla, pero sí en el resto
de enlaces absolutos del sistema.

## 7. Probar

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

| Estado    | Qué significa                                                  |
| --------- | -------------------------------------------------------------- |
| `sent`    | Meta lo aceptó. Guarda el `wamid` del mensaje.                 |
| `failed`  | Meta lo rechazó. La fila muestra el error exacto que devolvió. |
| `skipped` | Falta el token o el `PHONE_NUMBER_ID`. No se llamó a Meta.     |

Un `sent` significa aceptado por Meta, no leído por la persona. La entrega final
se ve en WhatsApp Manager.

## 8. Si algo falla

Lo primero, siempre: leer el texto del error en la fila `failed` del dashboard.
El código guarda literal lo que responde Meta (`error_data.details`, o
`error.message`), así que ahí está el diagnóstico.

Los tropiezos habituales, por orden de frecuencia:

- **No aparece ninguna fila.** El profesional no tiene teléfono en el perfil, o
  la reserva no tenía profesional asignado. No es un fallo de WhatsApp.
- **Todo sale `skipped` con las variables puestas.** No reiniciaste el servidor
  local, o en Vercel no volviste a desplegar tras añadirlas.
- **La plantilla no existe.** El nombre en Meta no coincide exactamente con
  `WHATSAPP_TEMPLATE_NAME`, o falta el idioma concreto: el envío usa el
  `preferred_language` del perfil, así que un perfil en inglés necesita la
  versión inglesa aprobada.
- **Número de parámetros incorrecto.** El cuerpo de la plantilla no tiene las
  cinco variables, o al botón le falta la suya.
- **Token caducado o inválido.** Es el token temporal de 24 horas. Genera el
  permanente del paso 4.
- **Mensaje no entregable.** Ese número no tiene WhatsApp, o está mal escrito en
  el perfil.

Nada de esto rompe una reserva. `notifyStaffOnWhatsApp` no lanza excepciones y
todos los puntos de llamada envuelven la llamada: si WhatsApp cae, la reserva se
guarda igual y solo se pierde el aviso.

## 9. Volver atrás

Vacía `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` y vuelve a desplegar.
La función regresa al ensayo en seco: sigue registrando cada evento en el
dashboard y deja de mandar nada. No hace falta tocar código ni revertir ningún
commit.

## 10. Coste y límites

Las conversaciones de servicio iniciadas por el negocio con plantilla de
utilidad tienen una franquicia mensual holgada para el volumen de un centro como
este; a partir de ahí Meta cobra por conversación de 24 horas, no por mensaje.
Los cuatro eventos de una misma reserva al mismo profesional en el mismo día
caen dentro de la misma conversación.

Un número recién registrado arranca con un límite bajo de destinatarios diarios,
que Meta va subiendo solo. Para avisar a tres profesionales, el límite inicial
sobra.

---

## Lista de comprobación

- [ ] Número dedicado, sin cuenta de WhatsApp previa
- [ ] Negocio verificado en Meta Business
- [ ] Número registrado y verificado en WhatsApp Manager
- [ ] Apuntado el **identificador del número** (no el teléfono)
- [ ] Plantilla `essentia_booking_update` creada en español **y** en inglés
- [ ] Plantilla con las 5 variables del cuerpo y el botón de URL dinámica
- [ ] Plantilla **aprobada** por Meta
- [ ] Token permanente de usuario del sistema, sin caducidad
- [ ] Teléfono relleno en los 3 perfiles `staff` (y en el `admin` si procede)
- [ ] Las 4 variables en `.env.local`, servidor reiniciado
- [ ] Las 4 variables en Vercel (Production), **redesplegado**
- [ ] Prueba real: fila `sent` en el detalle de la reserva
- [ ] Mensaje recibido en el móvil, con el botón apuntando a la reserva correcta
