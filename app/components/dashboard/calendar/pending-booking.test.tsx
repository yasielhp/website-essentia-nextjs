import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../messages/es/dashboard.json";
import en from "../../../../messages/en/dashboard.json";
import type { CalendarEvent } from "@/types/calendar";
import { DayList } from "./day-list";
import { EventPill } from "./event-pill";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "b-1",
  date: "2026-11-24",
  time: "10:30",
  title: "Ana García",
  subtitle: "Drenaje linfático",
  tooltip: "10:30 · 60 min\nAna García\nDrenaje\nEstado: Pendiente",
  color: "#0284c7",
  href: "/dashboard/bookings/b-1",
  type: "booking",
  status: "confirmed",
  ...over,
});
const pending = event({ status: "pending" });

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

const DASHED = "outline:1px dashed #0284c7";

describe("a pending booking in the pill (month and week)", () => {
  for (const compact of [true, false]) {
    test(`${compact ? "compact" : "full"}: dashed and striped in its colour, named 'Pendiente' for a screen reader, with its tooltip`, () => {
      const html = wrap(
        <EventPill event={pending} compact={compact} onClick={() => {}} />,
      );
      expect(html).toContain(DASHED);
      expect(html).toContain("repeating-linear-gradient");
      expect(html).toContain('<span class="sr-only">');
      expect(html).toContain("Pendiente");
      expect(html).toContain('title="10:30 · 60 min');
      expect(html).toContain("Estado: Pendiente");
    });

    test(`${compact ? "compact" : "full"}: a confirmed one is drawn as before, with nothing added`, () => {
      const html = wrap(
        <EventPill event={event()} compact={compact} onClick={() => {}} />,
      );
      expect(html).not.toContain("dashed");
      expect(html).not.toContain("repeating-linear-gradient");
      expect(html).not.toContain("sr-only");
      expect(html).not.toContain("Pendiente");
      expect(html).not.toContain("title=");
      expect(html).toContain("background-color:#0284c722");
    });
  }

  test("in English the screen reader says 'Pending'", () => {
    const html = wrap(
      <EventPill event={pending} compact onClick={() => {}} />,
      "en",
    );
    expect(html).toContain("Pending");
  });

  test("a race or a session is never marked, whatever status it carries", () => {
    const html = wrap(
      <EventPill
        event={event({ type: "race", status: "pending" })}
        compact
        onClick={() => {}}
      />,
    );
    expect(html).not.toContain("dashed");
  });
});

describe("the day view marks it too: in its slot and in 'all day'", () => {
  const anchor = new Date(2026, 10, 24);
  const day = (events: CalendarEvent[]) =>
    wrap(
      <DayList
        anchor={anchor}
        eventsByDay={new Map([["2026-11-24", events]])}
        loading={false}
        onEventClick={() => {}}
        onSlotClick={() => {}}
      />,
    );

  test("a pending booking at its hour", () => {
    const html = day([pending]);
    expect(html).toContain(DASHED);
    expect(html).toContain("Pendiente");
    expect(html).toContain("sr-only");
  });

  test("a pending booking with no time (all day)", () => {
    const html = day([event({ status: "pending", time: null })]);
    expect(html).toContain(DASHED);
    expect(html).toContain("Pendiente");
  });

  test("a confirmed one is as before", () => {
    const html = day([event()]);
    expect(html).not.toContain("dashed");
    expect(html).not.toContain("Pendiente");
  });
});

describe("month and week grids draw it through the pill", () => {
  test("the month grid", () => {
    const html = wrap(
      <MonthGrid
        anchor={new Date(2026, 10, 24)}
        eventsByDay={new Map([["2026-11-24", [pending]]])}
        loading={false}
        onDayClick={() => {}}
        onEventClick={() => {}}
      />,
    );
    expect(html).toContain(DASHED);
  });

  test("the week grid", () => {
    const html = wrap(
      <WeekGrid
        anchor={new Date(2026, 10, 24)}
        eventsByDay={new Map([["2026-11-24", [pending]]])}
        loading={false}
        onDayClick={() => {}}
        onEventClick={() => {}}
      />,
    );
    expect(html).toContain(DASHED);
  });
});
