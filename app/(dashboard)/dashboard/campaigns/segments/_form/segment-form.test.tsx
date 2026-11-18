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
const { PeopleBar } = await import("./people-bar");

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
  test("says the kind of segment beside the title, with the badge the list and the detail use", () => {
    const title = header.slice(0, header.indexOf("Filtros"));
    expect(title).toContain("Nuevo segmento");
    expect(title).toContain("Por filtro");
  });
  test("is ONE card: the name, the bar and the table, with no sentence over it and no second strip", () => {
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(html).not.toContain("Seleccionadas las");
    expect(html).not.toContain("Seleccionar las 163");
    expect((html.match(/Quitar selección/g) ?? []).length).toBe(0);
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
    expect(html).toContain(
      'aria-label="Seleccionar las personas de esta página"',
    );
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

describe("the one bar of the table", () => {
  const bar = (
    over: Partial<React.ComponentProps<typeof PeopleBar>> = {},
    locale: "es" | "en" = "es",
  ) =>
    wrap(
      <PeopleBar
        search=""
        onSearch={() => {}}
        ready
        shown={163}
        total={163}
        selected={0}
        canSelectAll={false}
        full={false}
        onSelectAll={() => {}}
        onClear={() => {}}
        {...over}
      />,
      locale,
    );
  const times = (html: string, text: string) => html.split(text).length - 1;

  test("nobody picked: the search and the count, and nothing else", () => {
    const html = bar();
    expect(html).toContain("Buscar por nombre, correo o teléfono");
    expect(html).toContain("163 personas");
    expect(html).not.toContain("Ver solo seleccionadas");
    expect(html).not.toContain("Quitar selección");
    expect(html).not.toContain("seleccionadas");
  });
  test("with a filter or a search the count says how many of how many", () => {
    expect(bar({ shown: 32 })).toContain("32 de 163 personas");
    expect(bar({ shown: 1, total: 1 })).toContain("1 persona");
    expect(bar({ shown: 32 }, "en")).toContain("32 of 163 people");
  });
  test("while the people load no count is told, never a made-up zero", () => {
    const html = bar({ ready: false, shown: 0, total: 0 });
    expect(html).not.toContain("personas");
    expect(html).toContain("Buscar");
  });
  test("people picked: how many, the way to pick all and the way to clear, each once, and no 'only selected' toggle", () => {
    const html = bar({ selected: 50, canSelectAll: true });
    expect(times(html, "50 seleccionadas")).toBe(1);
    expect(times(html, "Seleccionar las 163")).toBe(1);
    expect(html).not.toContain("Ver solo seleccionadas");
    expect(html).not.toContain("aria-pressed");
    expect(times(html, "Quitar selección")).toBe(1);
    expect(html).not.toContain("163 personas");
    // In that order.
    const order = [
      "50 seleccionadas",
      "Seleccionar las 163",
      "Quitar selección",
    ].map((t) => html.indexOf(t));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  test("when everyone listed is already picked there is no 'select all'", () => {
    expect(bar({ selected: 163, canSelectAll: false })).not.toContain(
      "Seleccionar las",
    );
  });
  test("a full list says so in the bar, and offers no more", () => {
    const html = bar({ selected: 2000, full: true, canSelectAll: false });
    expect(html).toContain("Una lista admite hasta 2000 personas");
    expect(html).not.toContain("Seleccionar las");
  });
  test("one person picked is singular, and in English", () => {
    expect(bar({ selected: 1 })).toContain("1 seleccionada");
    expect(bar({ selected: 50, canSelectAll: true }, "en")).toContain(
      "50 selected",
    );
    expect(bar({ selected: 50, canSelectAll: true }, "en")).toContain(
      "Select all 163",
    );
    expect(bar({ selected: 3 }, "en")).not.toContain("Show only selected");
  });
  test("on a phone the targets are 44 px and the controls can break into lines", () => {
    const html = bar({ selected: 50, canSelectAll: true });
    expect(html).toContain("min-h-11");
    expect(html).toContain("flex-wrap");
  });
});
