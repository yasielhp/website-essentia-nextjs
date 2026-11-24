import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { argsOf, chainDb, filters, type Step } from "@/lib/campaigns/fake-db";
import { EMPTY_FILTERS } from "@/utils/calendar-filters";

/**
 * The calendar's bookings, through the real loader with the database replaced:
 * what is asked for, what is drawn, and how a pending one says what it is.
 */

// The real client refuses to be built without its address; nothing here calls it.
process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";

type Booking = Record<string, unknown>;
const booking = (
  id: string,
  status: string | null,
  over: Booking = {},
): Booking => ({
  id,
  date: "2026-11-24",
  time: "10:30",
  service_id: "svc-1",
  service_title: "Drenaje linfático",
  tier_id: "tier-1",
  staff_id: "staff-1",
  duration: "60 min",
  status,
  first_name: "Ana",
  last_name: id,
  ...over,
});

let rows: Booking[] = [];
let chains: { table: string; chain: Step[] }[] = [];

const real = { insforge: { ...(await import("@/lib/insforge")) } };
let loadCalendarEvents: typeof import("./calendar-events").loadCalendarEvents;

beforeAll(async () => {
  mock.module("@/lib/insforge", () => ({
    insforge: {
      database: {
        from: (table: string) => {
          const made = chainDb(async (name, chain) => {
            chains.push({ table: name, chain: [...chain] });
            if (name === "bookings") return { data: rows, error: null };
            if (name === "service_tiers") {
              return {
                data: [{ id: "tier-1", label: "Sesión", color: "#0284c7" }],
                error: null,
              };
            }
            if (name === "profiles") {
              return {
                data: [
                  { id: "staff-1", full_name: "Marta", first_name: "Marta" },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          });
          return made.db.from(table);
        },
      },
    },
  }));
  ({ loadCalendarEvents } = await import("./calendar-events"));
});

afterAll(() => {
  mock.module("@/lib/insforge", () => real.insforge);
});

const LABELS = {
  bookingFallback: "Reserva",
  staff: "Personal",
  noStaff: "Sin personal asignado",
  status: "Estado",
  pending: "Pendiente",
};

const load = async (
  over: Partial<Parameters<typeof loadCalendarEvents>[0]> = {},
) => {
  chains = [];
  return loadCalendarEvents({
    view: "month",
    anchor: new Date(2026, 10, 24),
    isPartner: false,
    userId: undefined,
    filters: EMPTY_FILTERS,
    labels: LABELS,
    ...over,
  });
};
const bookingsChain = () => chains.find((c) => c.table === "bookings")!.chain;

describe("what the calendar asks for", () => {
  test("drafts and cancelled bookings are left out of the query itself, so they are not even fetched", async () => {
    rows = [];
    await load();
    const chain = bookingsChain();
    const neq = chain.filter((s) => s.name === "neq").map((s) => s.args);
    expect(neq).toEqual([
      ["status", "draft"],
      ["status", "cancelled"],
    ]);
  });

  test("the date range, a partner's own bookings and the filters are still in the query", async () => {
    rows = [];
    await load({
      isPartner: true,
      userId: "partner-1",
      filters: { staffId: "staff-1", serviceId: "svc-1", tierId: "tier-1" },
    });
    const chain = bookingsChain();
    expect(argsOf(chain, "gte")).toEqual(["date", "2026-11-01"]);
    expect(argsOf(chain, "lte")).toEqual(["date", "2026-11-30"]);
    const eq = chain.filter((s) => s.name === "eq").map((s) => s.args);
    expect(eq).toEqual(
      expect.arrayContaining([
        ["partner_id", "partner-1"],
        ["staff_id", "staff-1"],
        ["service_id", "svc-1"],
        ["tier_id", "tier-1"],
      ]),
    );
    expect(filters(chain)).toBeDefined();
  });
});

describe("what the calendar draws", () => {
  test("a draft or a cancelled booking is not drawn even if the database hands it back", async () => {
    rows = [
      booking("draft", "draft"),
      booking("cancelled", "cancelled"),
      booking("confirmed", "confirmed"),
      booking("pending", "pending"),
      booking("paid", "paid"),
      booking("completed", "completed"),
    ];
    const events = await load();
    expect(events.map((e) => e.id).sort()).toEqual([
      "completed",
      "confirmed",
      "paid",
      "pending",
    ]);
  });

  test("a pending booking keeps its colour and says its status in the tooltip, in the caller's words", async () => {
    rows = [booking("p", "pending")];
    const [pendingEvent] = await load();
    expect(pendingEvent).toMatchObject({ status: "pending", color: "#0284c7" });
    expect(pendingEvent!.tooltip).toContain("Estado: Pendiente");
    // The rest of the tooltip is as it was.
    expect(pendingEvent!.tooltip).toContain("Personal: Marta");
  });

  test("a confirmed one has no status line in its tooltip: nothing to explain", async () => {
    rows = [booking("c", "confirmed")];
    const [confirmedEvent] = await load();
    expect(confirmedEvent!.tooltip).not.toContain("Estado");
    expect(confirmedEvent!.status).toBe("confirmed");
  });

  test("a booking confirmed for payment at the centre (no payment) is drawn as any confirmed one", async () => {
    rows = [
      booking("c", "confirmed", {
        payment_mode: "none",
        payment_status: "pending",
      }),
    ];
    const [event] = await load();
    expect(event!.status).toBe("confirmed");
    expect(event!.tooltip).not.toContain("Pendiente");
  });
});
