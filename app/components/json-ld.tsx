/**
 * A schema.org block, serialised so it cannot break out of its own tag.
 *
 * `JSON.stringify` escapes what JSON needs and nothing else, so the `<` in a
 * value goes into the document as `<`. A blog title containing `</script>` —
 * typed by a member of staff, or arriving with an imported post — therefore
 * closed the tag early and everything after it became markup. The rest of the
 * page was then whatever the string happened to say.
 *
 * Escaping the four characters that matter to an HTML parser costs nothing and
 * leaves the JSON valid: `<` and friends parse back to the same string.
 * U+2028 and U+2029 are legal in JSON but not in JavaScript string literals,
 * and some parsers still trip on them.
 *
 * Every `application/ld+json` block on the site goes through here, so this is
 * the one place where a raw HTML sink exists and the one place to review.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
