# Alta del número de WhatsApp en Meta — guía para el cliente

Fecha: 2026-08-12

Esta guía es para la persona que es **propietaria de la cuenta de Meta Business
de Essentia**. Al terminar, hay que enviar dos datos al equipo técnico; con ellos
la web empieza a avisar por WhatsApp al profesional cada vez que se le asigna,
se le cambia o se le cancela una reserva.

Tiempo real de trabajo: unos 45 minutos. Entre medias hay dos esperas que no
dependen de ti: la verificación del negocio (horas o días) y la aprobación de la
plantilla (de minutos a unas horas).

Los nombres de los menús de Meta cambian cada pocos meses. Si no ves
exactamente el texto que aparece aquí, busca el equivalente más parecido.

---

## Antes de empezar

**El número es `+34 711 51 00 31`** (la eSIM nueva).

> ⚠️ **No instales WhatsApp ni WhatsApp Business en esa línea.** Meta solo
> permite dar de alta en su API un número que no tenga cuenta de WhatsApp. Si se
> instala, hay que borrar la cuenta antes, y se pierde su historial. Una vez dado
> de alta en la API, ese número deja de poder usarse en la app del móvil: pasa a
> ser un número de sistema, no un teléfono para chatear.

La SIM tiene que estar activa y en un dispositivo durante el alta: Meta manda un
SMS o hace una llamada de verificación **una sola vez**.

Necesitas:

- Una cuenta de **Meta Business** (business.facebook.com) con el negocio de
  Essentia dado de alta.
- Rol de **administrador** en esa cuenta.

---

## Paso 1 — Verificar el negocio

Sin negocio verificado, Meta limita mucho el envío de mensajes.

1. Entra en [business.facebook.com](https://business.facebook.com).
2. **Configuración del negocio** → **Centro de seguridad** (o **Información del
   negocio**) → **Verificación del negocio**.
3. Si pone «Verificado», sigue al paso 2.
4. Si no, inicia la verificación. Meta pide documentación del negocio (CIF,
   documento fiscal o factura de servicio con el nombre y la dirección) y un
   dato de contacto público que coincida.

La revisión tarda de unas horas a varios días. **Puedes seguir con los pasos 2 y
3 mientras tanto**; solo el envío real necesita la verificación.

---

## Paso 2 — Registrar el número

1. En business.facebook.com, abre **WhatsApp Manager**
   ([business.facebook.com/wa/manage](https://business.facebook.com/wa/manage)).
2. Si es la primera vez, Meta te pide crear una **cuenta de WhatsApp Business**
   (WABA). Créala a nombre de Essentia.
3. **Números de teléfono** → **Añadir número de teléfono**.
4. Escribe el número: país **España (+34)**, número **711510031**.
5. Rellena el **nombre para mostrar** — pon `Essentia Wellness Club` — y la
   **categoría** del perfil. Meta revisa el nombre para mostrar; tiene que
   parecerse al nombre real del negocio.
6. Elige **SMS** o **Llamada** para la verificación, y mete el código que
   llegue al dispositivo con la eSIM.

Cuando el número aparezca en la lista, está registrado.

---

## Paso 3 — Copiar el identificador del número ⭐

Este es **el primer dato que hay que enviar**.

1. Ve a **Configuración de la API** (en inglés, _API Setup_). Está en el panel
   de la app de WhatsApp, en
   [developers.facebook.com](https://developers.facebook.com) → tu app →
   **WhatsApp** → **Configuración de la API**.
2. Verás el número `+34 711 51 00 31` y, justo debajo, **Identificador del
   número de teléfono** (_Phone number ID_).
3. Cópialo.

> **Ojo, es el error más común:** ese identificador **no es el teléfono**. Es un
> número largo, de unos 15 dígitos, del estilo `123456789012345`. Si lo que
> copias se parece a `711510031` o a `+34711510031`, no es el dato correcto.

Copia también, si te aparece en la misma pantalla, el **Identificador de la
cuenta de WhatsApp Business** (_WhatsApp Business Account ID_). Es otro número
largo y ahorra tiempo si luego hay que diagnosticar algo.

---

## Paso 4 — Crear la plantilla del mensaje

WhatsApp no deja que un negocio escriba a alguien con texto libre: fuera de una
conversación abierta solo entrega **plantillas aprobadas por Meta**. Hay que
crear una, y tiene que quedar **exactamente** como está aquí — el sistema manda
los datos en este orden y con esta puntuación.

En **WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**:

| Campo         | Valor                                       |
| ------------- | ------------------------------------------- |
| **Nombre**    | `essentia_booking_update`                   |
| **Categoría** | **Utilidad** (_Utility_) — **no** Marketing |
| **Idioma**    | Español                                     |

Elegir **Utilidad** importa: es más barato y Meta lo aprueba mucho antes que
Marketing.

### 4.1 El cuerpo, en español

Pega este texto tal cual en el campo del cuerpo del mensaje:

```
Hola {{1}}, {{2}}. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}.
```

Las llaves dobles `{{1}}`…`{{5}}` son los huecos que la web rellena en cada
aviso. Meta pide un **ejemplo** de cada uno para poder revisar la plantilla.
Copia estos:

| Hueco   | Qué se rellena               | Ejemplo a escribir en Meta            |
| ------- | ---------------------------- | ------------------------------------- |
| `{{1}}` | Nombre del profesional       | `Yuli`                                |
| `{{2}}` | Qué ha pasado con la reserva | `se te ha asignado una sesión`        |
| `{{3}}` | Nombre del cliente           | `María López`                         |
| `{{4}}` | Servicio                     | `Terapias manuales — ESPIRA`          |
| `{{5}}` | Fecha y hora                 | `martes, 12 de agosto de 2026, 10:30` |

Con esos ejemplos, el revisor de Meta lee: «Hola Yuli, se te ha asignado una
sesión. Cliente: María López. Servicio: Terapias manuales — ESPIRA. Cuándo:
martes, 12 de agosto de 2026, 10:30.»

### 4.2 El botón

En la sección de botones, añade uno:

- Tipo: **Visitar sitio web**
- Formato de URL: **Dinámica**
- URL:

```
https://www.essentiawellnessclub.com/dashboard/bookings/{{1}}
```

- Ejemplo para la revisión: `3f7c1e02-9b4a-4f21-8f0e-2c5d7a91b334`
- Texto del botón: `Ver reserva`

El botón lleva al profesional directo a la ficha de esa reserva en el panel.

### 4.3 La misma plantilla en inglés

Cuando la hayas enviado, **añade el idioma inglés a la misma plantilla**
(botón **Añadir idioma**, no crear una plantilla nueva). Cuerpo:

```
Hi {{1}}, {{2}}. Client: {{3}}. Service: {{4}}. When: {{5}}.
```

Mismos ejemplos, mismo botón, misma URL.

Hacen falta los dos idiomas: cada profesional recibe el aviso en el idioma que
tiene puesto en su perfil, y si falta ese idioma el mensaje no sale.

### 4.4 Esperar la aprobación

El estado de la plantilla pasa a **En revisión** y luego a **Activa**. Suele
tardar de minutos a unas horas. Si sale **Rechazada**, Meta dice el motivo:
mándanos ese motivo y lo resolvemos.

---

## Paso 5 — Generar el token permanente ⭐

Este es **el segundo dato que hay que enviar**.

En la pantalla de **Configuración de la API** hay un token temporal que caduca a
las 24 horas. **No sirve** — hay que crear uno permanente:

1. **Configuración del negocio** → **Usuarios** → **Usuarios del sistema**.
2. **Añadir** → nombre, por ejemplo `essentia-web`, rol **Administrador**.
3. Selecciónalo → **Añadir activos** → pestaña **Cuentas de WhatsApp** → marca
   la cuenta de WhatsApp Business de Essentia → **Control total**.
4. **Generar token nuevo**:
   - App: la app de WhatsApp de Essentia
   - Caducidad: **Nunca**
   - Permisos: marca **`whatsapp_business_messaging`** y
     **`whatsapp_business_management`**
5. **Copia el token en ese mismo momento.** Es una cadena larga que empieza por
   `EAA…`. Meta **no lo vuelve a mostrar nunca**: si lo pierdes, hay que generar
   otro.

---

## Paso 6 — Enviarnos los dos datos

Hay que hacernos llegar:

1. El **identificador del número de teléfono** (paso 3)
2. El **token permanente** (paso 5)

**Cómo enviarlos, importa.** El token es una llave: quien lo tenga puede mandar
mensajes de WhatsApp en nombre de Essentia. **No lo mandes por correo, ni por
WhatsApp, ni por un chat de grupo** — quedan copias que no se pueden borrar.

Opciones buenas, de mejor a peor:

- Un enlace de un solo uso: [1ty.me](https://1ty.me) o
  [onetimesecret.com](https://onetimesecret.com). Pegas el token, te da un
  enlace, nos mandas el enlace. Al abrirlo una vez, se destruye.
- Dictarlo por teléfono. Es largo, pero funciona.

El identificador del número (el de 15 dígitos) no es secreto: ese puede ir por
donde quieras.

Si crees que el token se ha visto en algún sitio que no tocaba, dilo: se
invalida el viejo y se genera otro en dos minutos. No pasa nada.

---

## Lo que hacemos nosotros después

- Metemos las credenciales en el servidor y volvemos a desplegar la web.
- Rellenamos el teléfono móvil de cada profesional en su ficha del panel (sin
  ese dato no le llega nada).
- Hacemos una reserva de prueba y comprobamos que el aviso llega al móvil con el
  botón correcto.

Hasta que eso pase, **nada se rompe**: hoy el sistema ya registra cada aviso en
el panel sin enviarlo. Las reservas y los correos al cliente funcionan igual que
siempre, con número o sin él.

---

## Lista de comprobación

- [ ] No se ha instalado WhatsApp en la SIM del `711510031`
- [ ] Negocio verificado en Meta Business
- [ ] Número `+34 711 51 00 31` registrado y verificado en WhatsApp Manager
- [ ] Copiado el **identificador del número** (15 dígitos, no el teléfono)
- [ ] Plantilla `essentia_booking_update` creada, categoría **Utilidad**
- [ ] Plantilla con los 5 huecos del cuerpo y el botón de URL dinámica
- [ ] Idioma **español** e **inglés** en la misma plantilla
- [ ] Plantilla en estado **Activa** (aprobada)
- [ ] Token de usuario del sistema con caducidad **Nunca** y los dos permisos
- [ ] Los dos datos enviados por un canal seguro
