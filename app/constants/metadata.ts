export function getOgImage(locale: string) {
  const url = locale === "es" ? "/es/opengraph-image" : "/opengraph-image";
  const alt =
    locale === "es"
      ? "Essentia Wellness Club — Centro de Longevidad y Club Social de Bienestar en Tenerife"
      : "Essentia Wellness Club — Longevity Center & Social Wellness Club in Tenerife";
  return [{ url, width: 1200, height: 630, alt }];
}
