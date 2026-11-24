/**
 * An amount in euros as somebody at the centre types it, or null when it is
 * not one. Spanish first: "1.000" is one thousand (not one euro), "1.000,50"
 * is a thousand and fifty cents, "100,5" is a hundred and fifty cents. The
 * English forms ("1,000.50", "100.5") read too, because the field may be
 * prefilled in either language. At most two decimals: a fraction of a cent is
 * refused, never rounded away.
 */
export function parseEuroAmount(input: string): number | null {
  const text = input.replace(/[\s  €]/g, "");
  if (!/^[0-9.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let whole: string;
  let decimals = "";

  if (lastComma >= 0 && lastDot >= 0) {
    // Both: the last one is the decimal mark, the other groups thousands.
    const mark = lastComma > lastDot ? "," : ".";
    const group = mark === "," ? "." : ",";
    const parts = text.split(mark);
    if (parts.length !== 2) return null;
    const grouped = new RegExp(`^\\d{1,3}(?:\\${group}\\d{3})+$`);
    if (!grouped.test(parts[0]!)) return null;
    whole = parts[0]!.split(group).join("");
    decimals = parts[1]!;
  } else if (lastComma >= 0) {
    // A comma alone is the Spanish decimal mark.
    const parts = text.split(",");
    if (parts.length !== 2) return null;
    whole = parts[0]!;
    decimals = parts[1]!;
  } else if (lastDot >= 0) {
    // Dots in groups of three are thousands ("1.000", "12.345.678"); one dot
    // followed by one or two digits is a decimal point ("100.5", "99.99").
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
      whole = text.split(".").join("");
    } else {
      const parts = text.split(".");
      if (parts.length !== 2) return null;
      whole = parts[0]!;
      decimals = parts[1]!;
    }
  } else {
    whole = text;
  }

  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(decimals)) return null;
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0") || "0");
  return Number.isFinite(cents) ? Math.round(cents) / 100 : null;
}

/** An amount written back into such a field, in the reader's language. */
export function formatAmountInput(eur: number, locale: "es" | "en"): string {
  const fixed = (Math.round(eur * 100) / 100).toFixed(2);
  return locale === "es" ? fixed.replace(".", ",") : fixed;
}
