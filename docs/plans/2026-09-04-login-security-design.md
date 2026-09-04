# Endurecer el login

**Fecha:** 2026-09-04
**Estado:** diseño validado, listo para implementar

## El problema

`signInWithPassword` en `app/actions/auth.ts` pasa el email y la contraseña al
SDK de Insforge y devuelve lo que le contesten. No hay tope de intentos, no
queda rastro de quién intentó entrar, y la validación con Zod vive solo en el
navegador — donde no protege de nada, porque una Server Action es un endpoint
HTTP que cualquiera puede llamar directamente.

Un atacante con una lista de correos puede probar contraseñas a la velocidad
que le permita la red.

## Decisiones tomadas

| Decisión                  | Elegido                                                 | Por qué                                                                                                                                       |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué se le dice al usuario | Contador visible ("te quedan 3 intentos")               | Mejor UX para el cliente que se equivoca. Confirma qué emails existen; el tope por IP es lo que evita que eso sea explotable a escala.        |
| Dónde vive el estado      | Postgres en Insforge                                    | Sin dependencias nuevas, durable, correcto en serverless. Redis habría añadido servicio, env vars y factura para el tráfico de esta web.      |
| Backoff vs bloqueo        | Los dos: backoff en los intentos 3–5, bloqueo al quinto | El backoff mata la fuerza bruta rápida; el bloqueo es el techo.                                                                               |
| Recuperar acceso          | Enlace por email **y** caducidad a los 30 min           | Sin la caducidad, quien no reciba el correo queda fuera, y cualquiera puede bloquear la cuenta de un cliente a propósito de forma indefinida. |
| Tope por IP               | 20 fallos / 15 min                                      | Holgado para una wifi compartida, corta el barrido de cuentas.                                                                                |

Descartado por YAGNI: CAPTCHA (añade un tercero y el backoff ya cubre el caso)
y 2FA (es otra funcionalidad, no endurecer el login).

## Datos

### `auth_events`

Auditoría y fuente del contador a la vez. Una fila por intento, con éxito o sin
él.

| columna      | tipo                              | para qué                                                                                   |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`         | uuid PK                           |                                                                                            |
| `email`      | text, ya normalizado a minúsculas | la clave del contador por cuenta                                                           |
| `user_id`    | uuid null → `auth.users`          | solo si el email existía                                                                   |
| `ip`         | inet null                         | de `x-forwarded-for`; null en local                                                        |
| `user_agent` | text null                         | investigación                                                                              |
| `outcome`    | text                              | `success` \| `bad_password` \| `unknown_email` \| `locked` \| `rate_limited` \| `unlocked` |
| `created_at` | timestamptz                       |                                                                                            |

Índices en `(email, created_at DESC)` y `(ip, created_at DESC)`. Sin RLS, como
`booking_events`: se lee solo con la service key.

### `account_locks`

Estado del bloqueo, una fila viva por email.

| columna                    | tipo             | para qué                                                         |
| -------------------------- | ---------------- | ---------------------------------------------------------------- |
| `email`                    | text PK          |                                                                  |
| `locked_at` / `expires_at` | timestamptz      | caducidad a 30 min                                               |
| `unlock_token`             | uuid UNIQUE      | _es_ la credencial del enlace, como `contacts.unsubscribe_token` |
| `unlocked_at`              | timestamptz null | consumido = token quemado                                        |
| `attempts`                 | int              | cuántos fallos lo provocaron, para el email                      |

### Cómo se cuenta

- **Por cuenta:** fallos de ese email desde el más reciente entre el último
  `success` y `now() - 15 min`. Un login correcto pone el contador a cero sin
  borrar nada del rastro.
- **Por IP:** fallos de esa IP en los últimos 15 minutos, tope 20.
- **Backoff:** se deriva del contador, sin columna propia.

### Limpieza

`auth_events` crece sin fin. La poda de filas de más de 90 días se cuelga del
cron que ya existe (`app/api/cron/booking-reminders/route.ts`), no de uno nuevo.

## Flujo del servidor

`signInWithPassword` pasa a ser la puerta. El orden importa: cada paso corta
antes de gastar el siguiente.

1. **Validar en servidor** con `signInSchema`, ahora endurecido: `email`
   `.trim().toLowerCase().max(160)`, `password` `.min(1).max(200)`. El tope de
   longitud evita que un payload de megabytes llegue al hash. Si falla, se
   vuelve sin tocar la base de datos.
2. **Leer la IP** de `headers()` → `x-forwarded-for`, primer valor.
3. **Tope por IP.** 20 o más fallos en 15 minutos: registrar `rate_limited` y
   devolver. Ni se toca el contador de la cuenta ni se llama al SDK.
4. **¿Bloqueada?** Fila en `account_locks` con `unlocked_at IS NULL` y
   `expires_at > now()`: registrar `locked` y devolver. Si ya expiró, se borra
   y se sigue.
5. **Backoff.** 2 fallos previos → esperar 2 s; 3 → 5 s; 4 → 8 s. La espera va
   antes de llamar al SDK, así el atacante paga el tiempo aunque acierte.
6. **Llamar al SDK.**
7. **Éxito:** registrar `success`, borrar el lock si lo hubiera, seguir con
   `profiles` (role + preferred_language) como hasta ahora.
8. **Fallo:** mirar `profiles.email` para marcar el evento como `bad_password`
   o `unknown_email` — distinción solo de auditoría, el usuario ve lo mismo.
   Registrar. Si el contador llega a 5: crear el lock con `expires_at = now() +
30 min` y su `unlock_token`, enviar el email y devolver `locked`. Si no,
   devolver `bad_credentials` con los intentos que quedan.

### Contrato de vuelta

El action deja de devolver el `message` crudo del SDK y devuelve un código
estable. El texto lo pone el cliente desde `messages/`, así sale traducido y no
filtra la redacción interna del SDK.

```ts
type SignInError =
  | { code: "invalid"; fields: Record<string, string> }
  | { code: "bad_credentials"; remaining: number }
  | { code: "locked" }
  | { code: "ip_rate_limited" }
  | { code: "unverified" }
  | { code: "generic" };
```

### Desbloqueo

`/unlock-account?token=<uuid>` es un Server Component que llama a
`unlockAccount(token)`:

- Token inexistente o ya usado → "enlace no válido o ya utilizado".
- Caducado → borra el lock y dice que el bloqueo ya había expirado.
- Válido → `unlocked_at = now()`, evento `unlocked`, email de confirmación y
  botón a `/sign-in`.

El token se quema al usarse y no inicia sesión: solo levanta el bloqueo.

## UI

`sign-in-form.tsx` mantiene su validación de cliente — ahora es la primera de
dos, no la única. El estado `error` pasa de `string` a `SignInError`, y un
`switch` sobre `code` elige la clave de traducción.

- `bad_credentials` usa plural ICU para "1 intento" / "3 intentos".
- Con 2 intentos o menos el aviso se pinta en ámbar, no en rojo, para que el
  cliente lea la advertencia antes de quemar el último.
- `locked` deshabilita el botón de enviar: no tiene sentido reintentar contra
  un muro.
- El backoff ocurre dentro del action, así que el `loading` que ya existe cubre
  la espera.

La página de desbloqueo lleva `robots: { index: false }`: una página de token
no se indexa.

## Emails

Dos plantillas nuevas en `app/emails/templates/`, ambas sobre `emailBase()` y
en el idioma de `profiles.preferred_language`, cayendo a inglés:

- `account-locked.ts` — cuántos intentos, desde cuándo, botón de desbloqueo y
  el aviso de cambiar la contraseña si no ha sido el titular.
- `account-unlocked.ts` — confirmación corta, sin enlace.

## Traducciones

Claves nuevas en `messages/en/auth.json` y `messages/es/auth.json` a la vez:
`signIn.errorAttempts`, `errorLocked`, `errorRateLimited`, y el bloque
`unlockAccount.*`. Los textos de los emails viven en las plantillas, que es el
patrón del proyecto.

Hay que reiniciar `bun run dev` tras añadirlas: Turbopack no recompila el
import dinámico de `i18n/request.ts` y las claves salen crudas.

## Riesgos asumidos

1. El backoff duerme dentro de la Server Action, o sea que ocupa una lambda de
   Vercel hasta 8 segundos. Irrelevante con este tráfico; no lo sería con
   decenas de miles de intentos simultáneos.
2. Dos consultas extra por intento de login. Los índices lo hacen barato, pero
   deja de ser gratis.
3. Mostrar el contador confirma qué emails existen en la base de datos. Se
   eligió a sabiendas; el tope por IP es lo que impide explotarlo a escala.

## Fuera de alcance

**`createProfile` corre en el navegador** (`sign-up-form.tsx`) con el cliente
anónimo. `profiles` tiene RLS y no hay política de INSERT para usuarios
normales, solo `admin_insert_profile`, así que el insert falla en silencio: el
código no mira el error. El 04-09-2026 había 6 usuarios de `auth.users` sin
fila en `profiles`, y una cuenta creada durante las pruebas reprodujo el fallo.
Arreglarlo es mover la creación del perfil a la Server Action con la service
key, y decidir qué hacer con los huérfanos existentes.

## Añadido después

El restablecimiento de contraseña se endureció el mismo día, con los mismos
contadores: tres códigos pedidos por dirección y diez por conexión cada quince
minutos, cinco códigos erróneos antes de cerrar el restablecimiento, y la misma
espera creciente. Quedarse sin intentos **no** bloquea la cuenta: ese formulario
no pide contraseña, así que un bloqueo ahí sería una forma de dejar fuera a
cualquier cliente a voluntad.

De paso se cerraron dos agujeros que no eran de ritmo: `redirectTo` lo ponía el
cliente, y el formulario decía si la dirección existía — una petición por
dirección bastaba para llevarse la lista de clientes.

El registro siguió el mismo día. `verifyEmail` tenía la misma fuerza bruta de
seis dígitos y `resendVerificationEmail` el mismo `redirectTo` del cliente y el
mismo cero topes; ambos comparten ahora los contadores del restablecimiento,
con presupuestos propios. `signUp` también tiene tope — tres por dirección y
cinco cuentas por conexión cada quince minutos — porque limitar solo el botón
de reenvío no cerraba nada: ese formulario manda el mismo correo, así que
bastaba con volver a registrar la dirección de la víctima.

Los cuatro contadores resultaron ser la misma pregunta, así que se juntaron en
`countRecent`, y los dos flujos de código de seis dígitos comparten política a
través de `CodeFlow`. `toPlainError` desapareció: ninguna acción de auth
devuelve ya la frase cruda del SDK.

**Ojo:** la verificación por correo está desactivada en el proyecto de Insforge,
así que `signUp` devuelve `requireEmailVerification: false` y la pantalla del
código no se alcanza. El tope de `verifyEmail` está puesto pero hoy es código
muerto; si algún día se activa la verificación, ya está cubierto.
