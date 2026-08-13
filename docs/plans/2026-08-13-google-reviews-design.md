# Las reseñas dejan de ser nuestras y pasan a ser las de Google

Fecha: 2026-08-13

## El problema

La web enseña 12 testimonios guardados en la tabla `reviews`. Ninguno vino de un
cliente: son los de siembra que acompañaron al diseño, con nombres en inglés y
frases redondas. Alrededor de ellos hay un formulario público para dejar reseña,
una sección del dashboard para moderarlas, una página propia con marquee y un
carrusel en la home.

Mientras tanto la ficha de Google del negocio acumula **36 valoraciones reales,
todas de 5 estrellas**, escritas por personas con nombre y foto. Esa prueba
social existe, es verificable por cualquiera y no la estamos usando.

## La decisión

Quitar el sistema propio y leer de Google. Concretamente:

| Decisión                                | Alternativa descartada                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Places API (New)**, 5 reseñas         | Business Profile API da las 36 y permite responder, pero exige OAuth como propietario y que Google apruebe el acceso: días o semanas |
| **Borrar `/reviews` y `/reviews/new`**  | Mantener la página con las 5: un marquee de cuatro filas alimentado por cinco citas es una promesa que el contenido no cumple        |
| **Dejar la tabla `reviews` en la base** | Un `DROP TABLE`: limpia el esquema pero pierde las filas y no gana nada hoy                                                          |
| **Foto real del autor**                 | Iniciales: cero configuración, pero pierde justo la señal de «persona real» que motiva el cambio                                     |

El límite de cinco es de la API, no del negocio. Si algún día importan las 36,
la vía es Business Profile API, y por eso la capa de datos se aísla en un módulo
con una sola función: cambiar de fuente no debería tocar ningún componente.

## Cómo queda

### Capa de datos

`app/lib/google-places.ts` expone una función que, dado un idioma, devuelve
`{ rating, userRatingCount, googleMapsUri, reviews[] }`. Llama a
`GET places.googleapis.com/v1/places/{id}` con `X-Goog-FieldMask` — la API
antigua ya no admite clientes nuevos.

Envuelta en `unstable_cache` con TTL de 6 horas, como `fetchBlogPosts`. No es
solo rendimiento: la política de Places obliga a refrescar el contenido al menos
cada 30 días y prohíbe almacenarlo de forma permanente. Solo el `place_id` está
exento, así que nada de copiar las reseñas a la base de datos.

Sin `GOOGLE_PLACES_API_KEY` o sin `GOOGLE_PLACES_PLACE_ID`, la función devuelve
lista vacía y la home omite la sección entera en lugar de enseñar un hueco. Mismo
patrón inerte que las notificaciones de WhatsApp: sin credenciales no rompe.

### Idiomas

Cada idioma se pide por separado y **Google devuelve reseñas distintas, no
traducciones de las mismas cinco**: en español salen las de clientas locales, en
inglés las de visitantes. Es el comportamiento que queremos en un sitio
bilingüe, y sale gratis: basta con pasar `languageCode`.

### La home

El carrusel existente se conserva. `TestimonialItem` cambia poco: `age`
(«32 años») pasa a ser la antigüedad relativa que da Google («Hace 2 meses»), y
las iniciales dejan paso a la foto del autor.

Encima, una cabecera con la nota media y el total de valoraciones enlazando a la
ficha. Ese bloque es el que sostiene el resto: cinco citas sueltas convencen
menos que cinco citas respaldadas por 36 valoraciones que cualquiera puede ir a
comprobar.

### Atribución

La política de Places exige atribuir el contenido a Google y, si se muestra la
foto del autor, enlazar a su perfil. Ambas cosas van en el componente.

### Lo que deliberadamente no se hace

**No se añade `aggregateRating` al `LocalBusiness` del `schema.org`.** Google
prohíbe marcar como valoración propia las reseñas recogidas de otro sitio,
incluido el propio Google, y es motivo de acción manual. La nota media se enseña
en pantalla y no en los datos estructurados.

## Qué se borra

- `app/(site)/[locale]/(page)/reviews/` — página y formulario público
- `app/(dashboard)/dashboard/reviews/` — sección de moderación
- `app/actions/submit-review.ts`
- `app/components/sections/reviews/reviews-marquee.tsx`
- `messages/{en,es}/reviews.json`
- Las entradas de `/reviews` en `routing.ts`, `menu.tsx`, `footer.tsx`,
  `nav.tsx`, `sitemap-data.ts` y `breadcrumbs.ts`

`/reviews` y `/es/testimonios` están indexadas, así que se redirigen a la home en
vez de devolver 404.

Se conservan la tabla `reviews`, sus 12 filas y sus migraciones.

## Variables de entorno

```
GOOGLE_PLACES_API_KEY=      # clave de servidor, nunca NEXT_PUBLIC_
GOOGLE_PLACES_PLACE_ID=ChIJZU4IYbfhaKoRYck706lQXjQ
```

La clave está restringida en la consola de Google a Places API (New) y sin
restricción de aplicación: la llamada sale del servidor de Vercel, cuya IP
cambia, así que no cabe restringir por IP ni por dominio. La restricción de API
es la protección real — filtrada, solo sirve para consultar fichas.
