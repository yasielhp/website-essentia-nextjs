import { TIME_ZONE } from "@/utils/format";

/** `03/11/2026`: day first, whatever the language, as the centre writes dates. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}
