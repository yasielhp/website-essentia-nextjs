import { describe, expect, it } from "bun:test";
import { MESSAGE_KEYS } from "./catalog";
import type { MessageRow } from "./compose";
import { legacySampleEmail } from "./samples";
import { buildTestEmail } from "./test-email";

const row = (over: Partial<MessageRow> = {}): MessageRow => ({
  subject: null,
  preheader: null,
  title: null,
  doc: null,
  enabled: true,
  ...over,
});

describe("buildTestEmail", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of ["en", "es"] as const) {
      it(`${key}/${locale}: with nothing saved it is the legacy email, with a real subject`, async () => {
        const out = await buildTestEmail(key, locale, null);
        expect(out.html).toBe(legacySampleEmail(key, locale));
        expect(out.subject.trim()).not.toBe("");
        expect(out.subject).not.toContain("{{");
      });
    }
  }

  it("a row that only carries the switch is still the legacy email", async () => {
    const out = await buildTestEmail(
      "booking_reminder",
      "es",
      row({ enabled: false }),
    );
    expect(out.html).toBe(legacySampleEmail("booking_reminder", "es"));
  });

  it("an edited message is composed with the sample data", async () => {
    const out = await buildTestEmail(
      "booking_confirmed",
      "es",
      row({
        subject: "Hasta pronto, {{first_name}}",
        title: "Hola {{first_name}}",
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Te esperamos el {{date}}." }],
            },
          ],
        },
      }),
    );
    expect(out.subject).toBe("Hasta pronto, Ana");
    expect(out.html).toContain("Hola Ana");
    expect(out.html).toContain("Te esperamos el jueves, 20 de agosto de 2026.");
    // The fixed blocks are still there after the admin's text.
    expect(out.html).toContain("example.com/cancel");
  });

  it("a switched-off reminder with its own text shows that text", async () => {
    const out = await buildTestEmail(
      "booking_reminder",
      "es",
      row({ enabled: false, subject: "Mañana, {{first_name}}" }),
    );
    expect(out.subject).toBe("Mañana, Ana");
  });

  it("never carries a real address: every link is example.com", async () => {
    for (const key of MESSAGE_KEYS) {
      const out = await buildTestEmail(key, "es", null);
      const links = [...out.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      // The email's own chrome (the font, the centre's address, a calendar
      // template) is not a client's link; everything the data fills is.
      const chrome = [
        "https://fonts.googleapis.com/",
        "https://calendar.google.com/calendar/",
        "mailto:info@essentiawellnessclub.com",
      ];
      for (const link of links) {
        const ok =
          link.startsWith("https://example.com/") ||
          chrome.some((prefix) => link.startsWith(prefix));
        expect(ok).toBe(true);
      }
    }
  });
});
