import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mock } from "bun:test";
import { chainDb, has, type Step } from "@/lib/campaigns/fake-db";
import {
  buildStaffMessage,
  STAFF_TEMPLATE_BODY,
  staffNoticeLanguage,
  type StaffMessageInput,
} from "./messages";

/**
 * The notice to the team about a booking, in the language of each person's
 * account: English only once Meta has approved the English version of the
 * template, Spanish in every other case. The sender itself, the database and
 * the history are replaced; modules are put back afterwards (`mock.module` is
 * process-wide).
 */

const INPUT: StaffMessageInput = {
  event: "assigned",
  staffFirstName: "Jane",
  clientName: "Ana García",
  service: "Terapias manuales",
  sessionType: "Espira",
  date: "2099-08-20",
  time: "10:30",
  bookingId: "b-1",
};

describe("the message", () => {
  test("Spanish reads word for word as the approved template, as it always did", () => {
    const { params, bodyPreview, buttonUrlParam } = buildStaffMessage(INPUT);
    expect(params[1]).toBe("Se te ha asignado una sesión");
    expect(bodyPreview).toBe(
      `Hola Jane, tienes una actualización sobre una reserva de Essentia Social Wellness Club. Se te ha asignado una sesión. A continuación tienes los detalles de la reserva. Cliente: Ana García. Servicio: Terapias manuales — Espira. Cuándo: ${params[4]}. Puedes consultar todos los detalles en el botón de abajo.`,
    );
    expect(params[4]).toContain("agosto");
    expect(buttonUrlParam).toBe("b-1");
  });

  test("English is the registered English body with English sentences and an English date", () => {
    const { params, bodyPreview } = buildStaffMessage(INPUT, "en");
    expect(params[1]).toBe("You have been assigned a session");
    expect(params[4]).toContain("August");
    expect(params[4]).toEndWith(", 10:30");
    let expected = STAFF_TEMPLATE_BODY.en;
    params.forEach((value, i) => {
      expected = expected.replace(`{{${i + 1}}}`, value);
    });
    expect(bodyPreview).toBe(expected);
    expect(bodyPreview).not.toContain("{{");
  });

  test("every event has its sentence in both languages, a capital first", () => {
    for (const language of ["es", "en"] as const) {
      for (const event of [
        "assigned",
        "unassigned",
        "rescheduled",
        "cancelled",
      ] as const) {
        const sentence = buildStaffMessage({ ...INPUT, event }, language)
          .params[1];
        expect(sentence.length).toBeGreaterThan(10);
        expect(sentence[0]).toBe(sentence[0].toUpperCase());
      }
    }
  });

  test("no name on the account still greets", () => {
    expect(
      buildStaffMessage({ ...INPUT, staffFirstName: "" }, "en").bodyPreview,
    ).toStartWith("Hi there,");
    expect(
      buildStaffMessage({ ...INPUT, staffFirstName: "" }).bodyPreview,
    ).toStartWith("Hola hola,");
  });
});

describe("which language", () => {
  test("English only when the account says English AND an English version is approved", () => {
    expect(staffNoticeLanguage("en", ["es", "en"])).toEqual({
      language: "en",
      code: "en",
    });
    expect(staffNoticeLanguage("EN", ["en_US"])).toEqual({
      language: "en",
      code: "en_US",
    });
    expect(staffNoticeLanguage("en", ["en_GB", "en"])).toEqual({
      language: "en",
      code: "en",
    });
  });

  test("Spanish in every other case", () => {
    expect(staffNoticeLanguage("en", ["es"])).toEqual({
      language: "es",
      code: "es",
    });
    expect(staffNoticeLanguage("en", [])).toEqual({
      language: "es",
      code: "es",
    });
    expect(staffNoticeLanguage("es", ["es", "en"])).toEqual({
      language: "es",
      code: "es",
    });
    expect(staffNoticeLanguage(null, ["en"])).toEqual({
      language: "es",
      code: "es",
    });
    expect(staffNoticeLanguage("fr", ["en"])).toEqual({
      language: "es",
      code: "es",
    });
  });
});

type SentCall = {
  to: string;
  params: string[];
  buttonUrlParam: string;
  language?: string;
};

let sent: SentCall[] = [];
let recorded: Record<string, unknown>[] = [];
let approvedRows: { language: string }[] | "error" = [];
let professionalLanguage: string | null = "en";
let tables: string[] = [];

function respond(table: string, chain: Step[]): unknown {
  tables.push(table);
  switch (table) {
    case "profiles":
      if (has(chain, "maybeSingle")) {
        return {
          data: {
            id: "pro-1",
            first_name: "Jane",
            full_name: "Jane Doe",
            phone: "+34600000001",
            preferred_language: professionalLanguage,
          },
          error: null,
        };
      }
      return {
        data: [
          {
            id: "adm-1",
            first_name: "Yuli",
            full_name: "Yuli",
            phone: "+34600000002",
            preferred_language: "es",
          },
        ],
        error: null,
      };
    case "bookings":
      return {
        data: {
          first_name: "Ana",
          last_name: "García",
          service_title: "Terapias manuales",
          date: "2099-08-20",
          time: "10:30",
          service_tiers: { label: "Espira" },
        },
        error: null,
      };
    case "whatsapp_templates":
      if (approvedRows === "error")
        return { data: null, error: { message: "down" } };
      return { data: approvedRows, error: null };
    default:
      return { data: null, error: null };
  }
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  client: { ...(await import("@/lib/whatsapp/client")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};

let notifyStaffOnWhatsApp: typeof import("./notify").notifyStaffOnWhatsApp;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: chainDb(respond).db }),
  }));
  mock.module("@/lib/whatsapp/client", () => ({
    ...real.client,
    whatsAppTemplateName: () => "essentia_booking_update",
    sendTemplate: async (opts: SentCall) => {
      sent.push(opts);
      return { status: "sent", providerId: `wamid-${sent.length}` };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvents: async (inputs: Record<string, unknown>[]) => {
      recorded.push(...inputs);
    },
  }));
  ({ notifyStaffOnWhatsApp } = await import("./notify"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/whatsapp/client", () => real.client);
  mock.module("@/lib/booking-events/record", () => real.record);
});

beforeEach(() => {
  sent = [];
  recorded = [];
  tables = [];
  approvedRows = [{ language: "es" }, { language: "en" }];
  professionalLanguage = "en";
});

const run = () =>
  notifyStaffOnWhatsApp({
    bookingId: "b-1",
    staffId: "pro-1",
    event: "assigned",
  });

const byPhone = (phone: string) => sent.find((call) => call.to === phone);
const entryFor = (phone: string) =>
  recorded.find((entry) => entry.recipient === phone);

describe("notifyStaffOnWhatsApp", () => {
  test("an account in English gets the English version once it is approved; the admin her own, Spanish", async () => {
    await run();
    expect(sent).toHaveLength(2);
    const pro = byPhone("+34600000001");
    const admin = byPhone("+34600000002");
    expect(pro?.language).toBe("en");
    expect(pro?.params[0]).toBe("Jane");
    expect(pro?.params[1]).toBe("You have been assigned a session");
    // The admin's copy is the professional's message, in Spanish.
    expect(admin?.language).toBe("es");
    expect(admin?.params[0]).toBe("Jane");
    expect(admin?.params[1]).toBe("Se te ha asignado una sesión");
    expect(String(entryFor("+34600000001")?.summary)).toStartWith("Hi Jane,");
    expect(String(entryFor("+34600000002")?.summary)).toStartWith("Hola Jane,");
    expect(entryFor("+34600000001")?.payload).toEqual({
      params: pro?.params,
      language: "en",
    });
  });

  test("while the English version is not approved, everybody gets the Spanish one", async () => {
    approvedRows = [{ language: "es" }];
    await run();
    expect(sent.map((call) => call.language)).toEqual(["es", "es"]);
    expect(String(entryFor("+34600000001")?.summary)).toStartWith("Hola Jane,");
  });

  test("a local copy that cannot be read means Spanish", async () => {
    approvedRows = "error";
    await run();
    expect(sent.map((call) => call.language)).toEqual(["es", "es"]);
  });

  test("with nobody in English the copy is not even read", async () => {
    professionalLanguage = "es";
    await run();
    expect(tables).not.toContain("whatsapp_templates");
    expect(sent.map((call) => call.language)).toEqual(["es", "es"]);
  });
});
