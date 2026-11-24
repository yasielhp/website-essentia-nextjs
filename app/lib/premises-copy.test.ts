import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms";
import { getPathname } from "../../i18n/navigation";

/**
 * The centre is open at Rambla de Santa Cruz, 83 and books online. Nothing the
 * public reads may still say booking is paused while it moves, or name the
 * places it used to be (Baobab Suites, Costa Adeje, Fañabé).
 */

const LEFTOVERS =
  /reservas online están pausadas|booking is paused|cambiamos de local|move premises|between premises|baobab|costa adeje|fañab/i;

const MESSAGES = join(import.meta.dir, "../../messages");

describe("no word of the move or of the old premises", () => {
  test("in the public translations, in either language (the dashboard's are the team's)", () => {
    for (const locale of ["es", "en"]) {
      for (const file of readdirSync(join(MESSAGES, locale))) {
        if (file === "dashboard.json") continue;
        const text = readFileSync(join(MESSAGES, locale, file), "utf8");
        expect(`${locale}/${file}: ${LEFTOVERS.test(text)}`).toBe(
          `${locale}/${file}: false`,
        );
      }
    }
  });

  test("in the files for assistants", () => {
    expect(buildLlmsTxt()).not.toMatch(LEFTOVERS);
    expect(buildLlmsFullTxt()).not.toMatch(LEFTOVERS);
  });

  test("the treatment page closes on booking online at the centre", () => {
    for (const locale of ["es", "en"]) {
      const wellness = JSON.parse(
        readFileSync(join(MESSAGES, locale, "wellness.json"), "utf8"),
      ) as { treatments: { serviceDetail: { ctaBody: string } } };
      const body = wellness.treatments.serviceDetail.ctaBody;
      expect(body).toContain("{service}");
      expect(body).toContain("Rambla de Santa Cruz, 83");
    }
  });
});

describe("booking is open", () => {
  test("the cancel page sends 'book another session' to the booking form, in the page's language", () => {
    const source = readFileSync(
      join(
        import.meta.dir,
        "../(site)/[locale]/(page)/booking/cancel/cancel-content.tsx",
      ),
      "utf8",
    );
    expect(source).not.toContain('href="/contact"');
    expect(source).not.toMatch(/booking is paused/i);
    expect(source).toContain('href: screen === "confirm" ? "/" : "/booking"');
    expect(getPathname({ locale: "es", href: "/booking" })).toBe("/es/reserva");
    expect(getPathname({ locale: "en", href: "/booking" })).toBe("/booking");
  });
});
