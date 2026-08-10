/**
 * Long, human date for emails and messages: "lunes, 10 de agosto de 2026".
 *
 * Parsed field by field rather than through `new Date(dateStr)`, which reads a
 * bare `YYYY-MM-DD` as UTC midnight and so shows the previous day for anyone
 * behind Greenwich — the Canaries in winter included.
 */
export function formatLongDate(
  dateStr: string | null | undefined,
  locale: "en" | "es" = "en",
): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y) return "";
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );
}
