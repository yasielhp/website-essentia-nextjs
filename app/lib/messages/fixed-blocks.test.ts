import { describe, expect, test } from "bun:test";
import { casesFor } from "@/emails/defaults/legacy-cases";
import { MESSAGE_KEYS } from "./catalog";
import { fixedBlocks, fixedBlocksHtml } from "./fixed-blocks";

/**
 * The fixed blocks are copies and re-compositions of markup the legacy
 * templates print. Nothing but this test notices when one of them drifts, so
 * it checks the markup itself: every block must appear, character for
 * character once whitespace is normalised, in the HTML the legacy function of
 * its message produces, and the blocks must appear in the same order.
 */

const normalise = (html: string) =>
  html.replace(/\s+/g, " ").replace(/>\s+/g, ">").replace(/\s+</g, "<").trim();

describe("the fixed blocks are the legacy markup", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of ["es", "en"] as const) {
      for (const c of casesFor(key, locale)) {
        test(`${key}/${locale} (${c.label}): every block is in the legacy HTML, in order`, () => {
          const legacy = normalise(c.legacy);
          let from = 0;
          for (const block of fixedBlocks(key, c.fixed)) {
            const at = legacy.indexOf(normalise(block), from);
            expect(at).toBeGreaterThanOrEqual(0);
            from = at + 1;
          }
        });
      }
    }
  }
});

describe("hostile values in the booking data", () => {
  const HOSTILE = `"><script>alert(1)</script> & 'x'`;

  for (const key of MESSAGE_KEYS) {
    test(`${key}: nothing from the booking reaches the HTML unescaped`, () => {
      const [c] = casesFor(key, "es");
      const html = fixedBlocksHtml(key, {
        ...c!.fixed,
        service: HOSTILE,
        sessionType: HOSTILE,
        date: HOSTILE,
        time: HOSTILE,
        duration: HOSTILE,
        bonus: c!.fixed.bonus && {
          ...c!.fixed.bonus,
          amount: HOSTILE,
          expiresOn: HOSTILE,
        },
      });
      expect(html).not.toContain("<script");
      expect(html).not.toContain(`"><`);
      // Escaped, not dropped: the text is still there for a human to read.
      if (key !== "consent_request") {
        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(html).toContain("&amp;");
      }
    });
  }

  test("booking_received: an amount due that is not a number prints no payment sentence", () => {
    const [c] = casesFor("booking_received", "es");
    const withAmount = (amountDueEur: unknown) =>
      fixedBlocksHtml("booking_received", {
        ...c!.fixed,
        amountDueEur: amountDueEur as number,
      });
    for (const hostile of [
      "<img src=x onerror=alert(1)>",
      "45",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      { toString: () => "<b>45</b>" },
    ]) {
      const html = withAmount(hostile);
      expect(html).toBe(withAmount(null));
      expect(html).not.toContain("abonarás");
    }
    expect(withAmount(45)).toContain("abonarás <strong>45\u00a0€</strong>");
    expect(withAmount(0)).toContain("abonarás <strong>0\u00a0€</strong>");
  });

  test("the calendar link carries the raw title once, encoded, not escaped twice", () => {
    const [c] = casesFor("booking_confirmed", "es");
    const html = fixedBlocksHtml("booking_confirmed", {
      ...c!.fixed,
      service: "Masaje & Spa",
    });
    // The `&` in the title is encoded once, by URLSearchParams (`%26`). The
    // helper writes the URL into the href as it is, separators included, and
    // does not escape it as HTML: so the title is not escaped a second time.
    expect(html).toContain("?action=TEMPLATE&text=");
    expect(html).toContain("Masaje+%26+Spa");
    expect(html).not.toContain("&amp;amp;");
  });
});
