import { afterAll, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { IntlMessageFormat } from "intl-messageformat";
import es from "../../../../../../messages/es/dashboard.json";
import en from "../../../../../../messages/en/dashboard.json";
import type { SegmentPerson } from "@/types/campaign";

// Bun's module mocks outlive the file: everything the router really exports is
// kept and only the hooks that need a mounted app are replaced.
const realNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...realNavigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
afterAll(() => {
  mock.module("next/navigation", () => realNavigation);
});

const { SegmentForm } = await import("./segment-form");
const { SegmentPeopleTable } = await import("./people-table");
const { FilterChips } = await import("./filter-chips");
const { SegmentKindBadge } = await import("./kind-badge");

const wrap = (node: React.ReactNode, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      {node}
    </NextIntlClientProvider>,
  );

const ana: SegmentPerson = {
  id: "a",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "+34600112233",
  language: "es",
  newsletter: true,
  serviceIds: [],
  bookingsCount: 1,
  lastBookingDate: "2026-10-01",
  emailIssue: "unsubscribed",
  whatsappIssue: "unreachable",
};
const luis: SegmentPerson = {
  ...ana,
  id: "b",
  firstName: "Luis",
  lastName: null,
  emailIssue: null,
  whatsappIssue: null,
  newsletter: false,
  lastBookingDate: null,
};

describe("the header of the screen where a segment is made", () => {
  const html = wrap(<SegmentForm />);
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));

  test("has Filters and Save on the right, and no Cancel", () => {
    expect(header).toContain("Filtros");
    expect(header).toContain("Guardar");
    expect(html).not.toContain("Cancelar");
    expect(header).toContain("Nuevo segmento");
  });
  test("keeps the name field, empty, with its label", () => {
    expect(html).toContain('id="segment-name"');
    expect(html).toContain("Nombre del segmento");
  });
  test("has the search over the table", () => {
    expect(html).toContain("Buscar por nombre, correo o teléfono");
  });
  test("Save waits for a name", () => {
    expect(header).toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>[^<]*)*Guardar/);
  });
  test("says nothing about who the segment includes while the people are not loaded: never a made-up zero", () => {
    expect(html).not.toContain("El segmento incluye");
  });
});

describe("the table of people", () => {
  const render = (selected: string[]) =>
    wrap(
      <SegmentPeopleTable
        rows={[ana, luis]}
        selected={new Set(selected)}
        locale="es"
        onToggle={() => {}}
        onToggleVisible={() => {}}
      />,
    );

  test("has a checkbox per person with her name, and one in the header for those shown", () => {
    const html = render([]);
    expect(html).toContain('aria-label="Seleccionar a Ana Pérez"');
    expect(html).toContain('aria-label="Seleccionar a Luis"');
    expect(html).toContain('aria-label="Seleccionar las personas de esta página"');
  });
  test("a selected person is checked and the others are not", () => {
    const html = render(["a"]);
    const box = (name: string) =>
      html.match(
        new RegExp(`<input[^>]*aria-label="Seleccionar a ${name}"[^>]*>`),
      )?.[0] ?? "";
    expect(box("Ana Pérez")).toMatch(/checked/);
    expect(box("Luis")).not.toMatch(/checked/);
  });
  test("shows what keeps a channel from reaching her, only for who it applies to", () => {
    const html = render([]);
    expect(html).toContain("Baja de email");
    expect(html).toContain("Sin WhatsApp");
    // Luis has no reason: the marks are two, in the table and two in the cards.
    expect(html.match(/Baja de email/g)).toHaveLength(2);
  });
  test("the columns are name, email, phone, language, subscription and last booking", () => {
    const html = render([]);
    for (const column of [
      "Nombre",
      "Email",
      "Teléfono",
      "Idioma",
      "Suscripción",
      "Última reserva",
    ]) {
      expect(html).toContain(column);
    }
  });
  test("a phone-sized layout exists too, with each fact labelled", () => {
    const html = render([]);
    expect(html).toContain('class="md:hidden"');
    expect(html).toContain("Email:");
    expect(html).toContain("Idioma:");
  });
  test("a person with no booking shows a dash, not a date", () => {
    const html = render([]);
    expect(html).toContain("—");
  });
});

describe("the active filters", () => {
  const filters = {
    language: "es" as const,
    newsletter: true,
    services: [],
    lastBooking: { op: "gt" as const, days: 60 },
    neverBooked: false,
    hasBooked: false,
  };
  const html = wrap(
    <FilterChips filters={filters} onRemove={() => {}} onClear={() => {}} />,
  );
  test("are chips that say what they are and can be removed", () => {
    expect(html).toContain("Idioma: Solo español");
    expect(html).toContain("Suscripción: Solo suscritos a la newsletter");
    expect(html).toContain("Última reserva: hace más de 60 días");
    expect(html).toContain(
      'aria-label="Quitar el filtro Idioma: Solo español"',
    );
    expect(html).toContain("Quitar filtros");
  });
  test("with none on, nothing is drawn", () => {
    const none = wrap(
      <FilterChips
        filters={{
          ...filters,
          language: "any",
          newsletter: null,
          lastBooking: null,
        }}
        onRemove={() => {}}
        onClear={() => {}}
      />,
    );
    expect(none).toBe("");
  });
});

describe("the kind of segment, said in words", () => {
  const base = {
    language: "any" as const,
    newsletter: null,
    services: [],
    lastBooking: null,
    neverBooked: false,
  };
  test("a filter, a list, and a segment saved before lists existed", () => {
    expect(wrap(<SegmentKindBadge conditions={base} />)).toContain(
      "Por filtro",
    );
    expect(
      wrap(
        <SegmentKindBadge
          conditions={{
            ...base,
            manualIds: ["6f1c2a3e-1111-4222-8333-444455556661"],
            manualOnly: true,
          }}
        />,
      ),
    ).toContain("Lista manual");
    expect(wrap(<SegmentKindBadge conditions={base} />, "en")).toContain(
      "By filter",
    );
  });
});

describe("the sentence under the header", () => {
  const say = (locale: "es" | "en", key: string, count: number) =>
    new IntlMessageFormat(
      (locale === "es" ? es : en).campaigns.segments.form[
        key as "filterSentence"
      ],
      locale,
    ).format({ count }) as string;

  test("a filter says it keeps including whoever meets it later", () => {
    expect(say("es", "filterSentence", 7)).toBe(
      "El segmento incluye a las 7 personas que cumplen los filtros, y a las que los cumplan más adelante.",
    );
    expect(say("es", "filterSentence", 1)).toContain("la persona que cumple");
    expect(say("en", "filterSentence", 7)).toContain(
      "anyone who meets them later",
    );
  });
  test("a list says it is only the people selected", () => {
    expect(say("es", "listSentence", 3)).toBe(
      "El segmento incluye solo a las 3 personas seleccionadas.",
    );
    expect(say("es", "listSentence", 1)).toBe(
      "El segmento incluye solo a la persona seleccionada.",
    );
    expect(say("en", "listSentence", 3)).toContain(
      "only the 3 people selected",
    );
  });
});
