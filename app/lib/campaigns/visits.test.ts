import { describe, expect, it } from "bun:test";
import {
  foldAppointments,
  foldVisits,
  type AppointmentBooking,
  type VisitBooking,
} from "./visits";

let seq = 0;
const b = (over: Partial<VisitBooking> = {}): VisitBooking => {
  seq += 1;
  return {
    id: `b${String(seq).padStart(3, "0")}`,
    service_title: "Manual Therapies",
    tier_id: null,
    date: "2026-12-10",
    time: "09:30",
    duration: "60 min",
    status: "confirmed",
    ...over,
  };
};

const labels = new Map([
  ["t1", "Sesión larga"],
  ["t2", "Sesión corta"],
]);

describe("foldVisits — the last visit", () => {
  it("is the latest booking by date", () => {
    const out = foldVisits([
      b({ date: "2026-12-01", service_title: "Old" }),
      b({ date: "2026-12-20", service_title: "New" }),
      b({ date: "2026-12-10", service_title: "Mid" }),
    ]);
    expect(out.lastVisit?.service).toBe("New");
  });

  it("is told apart by time on the same day", () => {
    const out = foldVisits([
      b({ time: "17:00", service_title: "Late" }),
      b({ time: "09:00", service_title: "Early" }),
    ]);
    expect(out.lastVisit?.service).toBe("Late");
  });

  it("with the same date and time, the lowest id wins whatever the order", () => {
    const a = b({ id: "a", service_title: "A" });
    const z = b({ id: "z", service_title: "Z" });
    expect(foldVisits([z, a]).lastVisit?.service).toBe("A");
    expect(foldVisits([a, z]).lastVisit?.service).toBe("A");
  });

  it("counts a pending booking, not a cancelled one", () => {
    const out = foldVisits([
      b({ date: "2026-12-01", status: "pending", service_title: "Pending" }),
      b({ date: "2026-12-20", status: "cancelled", service_title: "Gone" }),
    ]);
    expect(out.lastVisit?.service).toBe("Pending");
  });

  it("leaves out a booking without a date", () => {
    const out = foldVisits([b({ date: null, service_title: "Undated" })]);
    expect(out.lastVisit).toBeNull();
    expect(out.firstVisit).toBeNull();
  });

  it("cuts a time with seconds to HH:MM", () => {
    expect(foldVisits([b({ time: "09:30:00" })]).lastVisit?.time).toBe("09:30");
  });

  it("compares 09:30:00 and 09:30 as the same time", () => {
    const a = b({ id: "a", time: "09:30:00", service_title: "A" });
    const z = b({ id: "z", time: "09:30", service_title: "Z" });
    expect(foldVisits([z, a]).lastVisit?.service).toBe("A");
  });

  it("keeps a booking without a time, with an empty time", () => {
    const out = foldVisits([b({ time: null })]);
    expect(out.lastVisit?.time).toBe("");
    expect(out.firstVisit).toBeNull();
  });

  it("has no service when the booking has none", () => {
    expect(foldVisits([b({ service_title: null })]).lastVisit?.service).toBe(
      "",
    );
  });

  it("names the session type when it is known, and not when it is not", () => {
    expect(
      foldVisits([b({ tier_id: "t1" })], labels).lastVisit?.sessionType,
    ).toBe("Sesión larga");
    expect(
      foldVisits([b({ tier_id: "unknown" })], labels).lastVisit?.sessionType,
    ).toBeNull();
    expect(
      foldVisits([b({ tier_id: null })], labels).lastVisit?.sessionType,
    ).toBeNull();
  });

  it("is null for a contact without bookings", () => {
    expect(foldVisits([])).toEqual({
      lastVisit: null,
      firstVisit: null,
      firstVisitByTier: {},
      firstVisitEndsAt: null,
      firstVisitEndsAtByTier: {},
    });
  });
});

describe("foldVisits — the first visit", () => {
  it("is the confirmed or completed booking that ends earliest", () => {
    const out = foldVisits([
      b({ date: "2026-12-20", service_title: "Later" }),
      b({ date: "2026-12-05", status: "completed", service_title: "First" }),
      b({ date: "2026-12-01", status: "pending", service_title: "Pending" }),
    ]);
    expect(out.firstVisit?.service).toBe("First");
    expect(out.lastVisit?.service).toBe("Later");
  });

  it("carries the end instant the rule waits for (Canary time, summer)", () => {
    const out = foldVisits([
      b({ date: "2026-07-10", time: "09:00", duration: "60 min" }),
    ]);
    // 09:00 + 60 min in the Canaries (UTC+1 in July) is 09:00Z.
    expect(out.firstVisitEndsAt).toBe("2026-07-10T09:00:00.000Z");
  });

  it("with the same end, the lowest id wins whatever the order", () => {
    const a = b({ id: "a", service_title: "A" });
    const z = b({ id: "z", service_title: "Z" });
    expect(foldVisits([z, a]).firstVisit?.service).toBe("A");
  });

  it("is told apart by the end, not by the start, when durations differ", () => {
    const long = b({
      time: "09:00",
      duration: "120 min",
      service_title: "Long",
    });
    const short = b({
      time: "09:30",
      duration: "30 min",
      service_title: "Short",
    });
    // Long ends 11:00, short ends 10:00 (local): the short one ends first.
    expect(foldVisits([long, short]).firstVisit?.service).toBe("Short");
  });

  it("is kept per session type", () => {
    const out = foldVisits(
      [
        b({ tier_id: "t1", date: "2026-12-05", service_title: "Long first" }),
        b({ tier_id: "t2", date: "2026-12-02", service_title: "Short first" }),
        b({ tier_id: "t1", date: "2026-12-30", service_title: "Long later" }),
      ],
      labels,
    );
    expect(out.firstVisit?.service).toBe("Short first");
    expect(out.firstVisitByTier.t1.service).toBe("Long first");
    expect(out.firstVisitByTier.t1.sessionType).toBe("Sesión larga");
    expect(out.firstVisitByTier.t2.service).toBe("Short first");
    expect(Object.keys(out.firstVisitEndsAtByTier).sort()).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("has no entry for a type the contact never had a visit of", () => {
    const out = foldVisits([b({ tier_id: "t1" })], labels);
    expect(out.firstVisitByTier).not.toHaveProperty("t2");
    expect(out.firstVisitEndsAtByTier).not.toHaveProperty("t2");
  });
});

// ── the appointments a notice is about ─────────────────────────────────────

let aseq = 0;
const ab = (over: Partial<AppointmentBooking> = {}): AppointmentBooking => {
  aseq += 1;
  return {
    id: `a${String(aseq).padStart(3, "0")}`,
    service_id: "svc-1",
    service_title: "Drenaje linfático",
    tier_id: null,
    date: "2026-12-10",
    time: "09:30",
    duration: "60 min",
    status: "confirmed",
    ...over,
  };
};

describe("foldAppointments", () => {
  it("keeps the confirmed and the completed, and nothing else", () => {
    const out = foldAppointments([
      ab({ id: "ok-1", status: "confirmed" }),
      ab({ id: "ok-2", status: "completed" }),
      ab({ id: "no-1", status: "cancelled" }),
      ab({ id: "no-2", status: "pending" }),
      ab({ id: "no-3", status: "draft" }),
      ab({ id: "no-4", status: null }),
    ]);
    expect(out.map((a) => a.id).sort()).toEqual(["ok-1", "ok-2"]);
    expect(out.find((a) => a.id === "ok-2")?.status).toBe("completed");
  });

  it("leaves out a booking with no date", () => {
    expect(foldAppointments([ab({ date: null })])).toEqual([]);
  });

  it("reads the start as the clock of the Canaries, in winter", () => {
    const [a] = foldAppointments([ab({ date: "2026-12-10", time: "09:30" })]);
    // UTC+0 in December.
    expect(a?.startsAt).toBe("2026-12-10T09:30:00.000Z");
    expect(a?.endsAt).toBe("2026-12-10T10:30:00.000Z");
  });

  it("and in summer, an hour earlier in UTC", () => {
    const [a] = foldAppointments([ab({ date: "2026-07-10", time: "09:30" })]);
    // UTC+1 in July.
    expect(a?.startsAt).toBe("2026-07-10T08:30:00.000Z");
    expect(a?.endsAt).toBe("2026-07-10T09:30:00.000Z");
  });

  it("a session of another length ends when it ends", () => {
    const [a] = foldAppointments([ab({ duration: "45 min" })]);
    expect(a?.endsAt).toBe("2026-12-10T10:15:00.000Z");
  });

  it("a booking with no duration ends when it starts", () => {
    for (const duration of [null, "", "  "]) {
      const [a] = foldAppointments([ab({ duration })]);
      expect(a?.endsAt).toBe(a?.startsAt);
    }
  });

  it("cuts a time with seconds to HH:MM", () => {
    const [a] = foldAppointments([ab({ time: "09:30:00" })]);
    expect(a?.visit.time).toBe("09:30");
    expect(a?.startsAt).toBe("2026-12-10T09:30:00.000Z");
  });

  it("a booking with no time has none to say, and starts at the day's first moment", () => {
    for (const time of [null, ""]) {
      const [a] = foldAppointments([ab({ time })]);
      expect(a?.visit.time).toBe("");
      expect(a?.startsAt).toBe("2026-12-10T00:00:00.000Z");
    }
  });

  it("carries what a message says about it: service, session type, date, time", () => {
    const [a] = foldAppointments(
      [ab({ tier_id: "t1", service_id: "svc-9" })],
      labels,
    );
    expect(a?.serviceId).toBe("svc-9");
    expect(a?.visit).toEqual({
      service: "Drenaje linfático",
      sessionType: "Sesión larga",
      date: "2026-12-10",
      time: "09:30",
    });
  });

  it("a booking with no service has an empty one", () => {
    const [a] = foldAppointments([
      ab({ service_id: null, service_title: null }),
    ]);
    expect(a?.serviceId).toBeNull();
    expect(a?.visit.service).toBe("");
  });

  it("is ordered by start and, at the same moment, by id, whatever the order it came in", () => {
    const later = ab({ id: "z", date: "2026-12-12" });
    const a = ab({ id: "a" });
    const b2 = ab({ id: "b" });
    expect(foldAppointments([later, b2, a]).map((x) => x.id)).toEqual([
      "a",
      "b",
      "z",
    ]);
    expect(foldAppointments([a, b2, later]).map((x) => x.id)).toEqual([
      "a",
      "b",
      "z",
    ]);
  });

  it("is empty for a contact with no bookings", () => {
    expect(foldAppointments([])).toEqual([]);
  });
});
