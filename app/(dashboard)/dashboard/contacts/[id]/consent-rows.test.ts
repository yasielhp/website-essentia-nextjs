import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dashboardContactSchema } from "@/lib/schemas";

/**
 * The contact page's consent block has TWO switches, "Appointment notices" and
 * "News and offers" (one consent for email and WhatsApp). These pin that the
 * old "Newsletter" row is really gone from the details form, that the texts
 * exist in both languages, and that none outlives the markup that used it.
 */
const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");
const dashboard = (locale: "es" | "en") =>
  JSON.parse(read("messages", locale, "dashboard.json")).contacts.detail as {
    whatsapp: Record<string, unknown>;
    newsletter: Record<string, string>;
  };

function leaves(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const ROWS = read(
  "app/(dashboard)/dashboard/contacts/[id]/whatsapp-consent-rows.tsx",
);
const DIALOG = read(
  "app/(dashboard)/dashboard/contacts/[id]/whatsapp-consent-dialog.tsx",
);
const CARD = read(
  "app/(dashboard)/dashboard/contacts/[id]/contact-details-card.tsx",
);
const PAGE = read("app/(dashboard)/dashboard/contacts/[id]/page.tsx");
const FORM_STATE = read(
  "app/(dashboard)/dashboard/contacts/[id]/form-state.ts",
);
const SOURCE = `${ROWS}\n${DIALOG}`;

describe("contact consent messages", () => {
  test("Spanish and English have exactly the same keys", () => {
    expect(leaves(dashboard("es").whatsapp).sort()).toEqual(
      leaves(dashboard("en").whatsapp).sort(),
    );
  });

  test("every key is read by the rows or the dialog", () => {
    const used = (path: string) => {
      if (SOURCE.includes(`"${path}"`)) return true;
      // `t(`${purpose}.label`)` and the nested namespace of `RemovalConfirm`.
      if (/^(appointments|marketing)\.label$/.test(path)) {
        return (
          SOURCE.includes("`${purpose}.label`") || SOURCE.includes(`"${path}"`)
        );
      }
      if (path.startsWith("suppression.")) {
        return SOURCE.includes(`t("${path.split(".")[1]}")`);
      }
      return false;
    };
    expect(leaves(dashboard("es").whatsapp).filter((p) => !used(p))).toEqual(
      [],
    );
  });

  test("the keys the rows read exist", () => {
    const have = new Set(leaves(dashboard("es").whatsapp));
    const read = [
      ...ROWS.matchAll(
        /"((?:marketing|appointments)\.[A-Za-z.]+|accepted|none|optedOutNote|error)"/g,
      ),
    ].map((m) => m[1]);
    expect(read.filter((k) => !have.has(k))).toEqual([]);
  });

  test("the news and offers hints name both channels and the Newsletter row is gone", () => {
    for (const locale of ["es", "en"] as const) {
      const marketing = dashboard(locale).whatsapp.marketing as {
        hint: Record<string, string>;
      };
      expect(marketing.hint.on).toMatch(/WhatsApp/);
      expect(marketing.hint.on).toMatch(/[Ee]mail/);
      expect(marketing.hint.emailOnly).toMatch(/WhatsApp/);
      expect(marketing.hint.whatsappOnly).toMatch(/[Ee]mail/);
    }
  });
});

describe("the newsletter row of the details form is gone", () => {
  test("the card, the form state and the page no longer know it", () => {
    expect(CARD).not.toMatch(/newsletter|ToggleRow/i);
    expect(FORM_STATE).not.toMatch(/newsletter/i);
    expect(PAGE).not.toMatch(
      /newsletterSubscribed|setContactNewsletter|TOGGLE_NEWSLETTER/,
    );
  });

  test("saving a contact does not send the newsletter flag, and the schema has no such field", () => {
    expect(PAGE).not.toMatch(/newsletter_subscribed:\s*newsletter/);
    expect(Object.keys(dashboardContactSchema.shape)).not.toContain(
      "newsletter",
    );
    expect(Object.keys(dashboardContactSchema.shape)).not.toContain(
      "newsletterSubscribed",
    );
  });

  test("the shared newsletter texts stay, because other screens still read them", () => {
    const others = [
      read("app/(dashboard)/dashboard/bookings/new/client-step.tsx"),
      read(
        "app/(dashboard)/dashboard/bookings/[id]/booking-detail-sections.tsx",
      ),
      read("app/(dashboard)/dashboard/contacts/new/contact-fields.tsx"),
    ].join("\n");
    for (const key of Object.keys(dashboard("es").newsletter)) {
      expect(others).toMatch(new RegExp(`tNewsletter\\("${key}"\\)`));
    }
    expect(Object.keys(dashboard("en").newsletter).sort()).toEqual(
      Object.keys(dashboard("es").newsletter).sort(),
    );
  });
});

describe("accessibility of the two switches", () => {
  test("both are switches with an accessible name, through the shared ToggleRow", () => {
    expect(ROWS.match(/<ToggleRow/g)?.length).toBe(2);
    const toggle = read("app/components/dashboard/toggle-row.tsx");
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain("aria-checked");
  });

  test("the confirmation dialog is centred: m-auto on the <dialog>, not left to the browser", () => {
    // Tailwind's reset sets `margin: 0` on everything, which cancels the
    // browser's own centring of a modal <dialog> and pins it to the top left.
    const tag = DIALOG.slice(
      DIALOG.indexOf("<dialog"),
      DIALOG.indexOf("</dialog>"),
    );
    expect(tag).toMatch(/className="[^"]*\bm-auto\b[^"]*"/);
    expect(tag).toMatch(/className="[^"]*\bmax-w-sm\b[^"]*"/);
    // The box inside no longer carries the margin and width that did nothing.
    expect(tag).not.toContain("mx-4 w-full max-w-sm");
  });

  test("turning one on asks first, in a native dialog that takes the focus", () => {
    expect(ROWS).toContain("setAsking(");
    expect(DIALOG).toContain("showModal()");
  });
});
