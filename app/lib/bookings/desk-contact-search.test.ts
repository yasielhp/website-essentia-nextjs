import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { argsOf, chainDb, has, type Step } from "@/lib/campaigns/fake-db";
import {
  deskConsents,
  toDeskOption,
  type DeskContactRow,
} from "./desk-consents";
import {
  clientFromContact,
  formInitial,
  formReducer,
} from "../../(dashboard)/dashboard/bookings/new/form-state";

/**
 * The desk's client search and how it reads a contact's two consents. The
 * search runs for real with the database replaced; `mock.module` is
 * process-wide, so the real module is put back afterwards.
 */

const none = {
  newsletter_subscribed: null,
  newsletter_unsubscribed_at: null,
  whatsapp_opted_in_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_out_at: null,
};

const row = (over: Partial<DeskContactRow> = {}): DeskContactRow => ({
  id: "c-1",
  first_name: "Ana",
  last_name: "García",
  email: "ana@example.com",
  phone: "+34600000000",
  gender: "female",
  preferred_language: "es",
  ...none,
  ...over,
});

describe("the two consents as the desk reads them", () => {
  test("nothing given is off for both", () => {
    expect(deskConsents(none)).toEqual({
      appointmentNotices: "off",
      marketing: "off",
    });
  });
  test("given is on; news and offers only with both channels", () => {
    expect(
      deskConsents({
        ...none,
        whatsapp_opted_in_at: "2026-01-01",
        newsletter_subscribed: true,
        whatsapp_marketing_opted_in_at: "2026-01-01",
      }),
    ).toEqual({ appointmentNotices: "on", marketing: "on" });
    expect(
      deskConsents({ ...none, newsletter_subscribed: true }).marketing,
    ).toBe("off");
  });
  test("a STOP withdraws both, an email unsubscribe news and offers", () => {
    expect(
      deskConsents({
        ...none,
        whatsapp_opted_in_at: "2026-01-01",
        whatsapp_opted_out_at: "2026-02-01",
      }),
    ).toEqual({ appointmentNotices: "stopped", marketing: "stopped" });
    expect(
      deskConsents({ ...none, newsletter_unsubscribed_at: "2026-02-01" }),
    ).toEqual({ appointmentNotices: "off", marketing: "stopped" });
  });
  test("a contact with no address is no option; a language that is not English is Spanish", () => {
    expect(toDeskOption(row({ email: null }))).toBeNull();
    expect(toDeskOption(row({ email: "  " }))).toBeNull();
    expect(toDeskOption(row({ preferred_language: null }))?.language).toBe(
      "es",
    );
    expect(toDeskOption(row({ preferred_language: "en" }))?.language).toBe(
      "en",
    );
  });
});

describe("the client step starts from a contact on file", () => {
  test("her details fill the form; a consent on file shows on, none starts the notices on", () => {
    const option = toDeskOption(row())!;
    expect(clientFromContact(option)).toEqual({
      contact: option,
      newClient: false,
      firstName: "Ana",
      lastName: "García",
      email: "ana@example.com",
      phone: "+34600000000",
      gender: "female",
      language: "es",
      marketing: false,
      appointmentNotices: true,
    });
  });
  test("a STOP starts both off; an unknown gender is unspecified", () => {
    const option = toDeskOption(
      row({ whatsapp_opted_out_at: "2026-02-01", gender: "x" }),
    )!;
    expect(clientFromContact(option)).toMatchObject({
      appointmentNotices: false,
      marketing: false,
      gender: "",
    });
  });
});

describe("the client step's three moments", () => {
  test("it opens on the search alone: no client, no new client, notices on", () => {
    expect(formInitial).toMatchObject({
      contact: null,
      newClient: false,
      appointmentNotices: true,
      marketing: false,
    });
  });
  test("New client shows the fields; Change goes back to the search, empty", () => {
    const typed = formReducer(
      formReducer(formInitial, { type: "NEW_CLIENT" }),
      { type: "SET_FIELD", field: "firstName", value: "Ana" },
    );
    expect(typed).toMatchObject({ newClient: true, firstName: "Ana" });
    expect(formReducer(typed, { type: "CLEAR_CONTACT" })).toMatchObject({
      newClient: false,
      contact: null,
      firstName: "",
      appointmentNotices: true,
    });
  });
  test("picking a client on file leaves the new-client fields", () => {
    const option = toDeskOption(row())!;
    const picked = formReducer(
      formReducer(formInitial, { type: "NEW_CLIENT" }),
      { type: "SELECT_CONTACT", value: option },
    );
    expect(picked).toMatchObject({ contact: option, newClient: false });
  });
});

let respond: (table: string, chain: Step[]) => unknown = () => ({
  data: [],
  error: null,
});
let queries: { table: string; chain: Step[] }[] = [];

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let search: typeof import("./desk-contact-search").searchDeskContactsCore;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      const { db, log } = chainDb((table, chain) => respond(table, chain));
      queries = log;
      return { database: db };
    },
  }));
  ({ searchDeskContactsCore: search } = await import("./desk-contact-search"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
});

describe("the search", () => {
  test("admin and staff look through every contact with an address, one filter per word", async () => {
    respond = () => ({ data: [row()], error: null });
    const result = await search({ role: "staff", userId: "me" }, "Ana Gar");
    expect(result).toEqual({ ok: true, contacts: [toDeskOption(row())!] });
    const contacts = queries.find((q) => q.table === "contacts")!;
    expect(contacts.chain.filter((s) => s.name === "or")).toHaveLength(2);
    expect(has(contacts.chain, "in")).toBe(false);
    expect(queries.some((q) => q.table === "bookings")).toBe(false);
  });

  test("a partner looks only through the clients of her own bookings", async () => {
    respond = (table) =>
      table === "bookings"
        ? { data: [{ contact_id: "c-1" }, { contact_id: "c-1" }], error: null }
        : { data: [row()], error: null };
    await search({ role: "partner", userId: "p-1" }, "ana");
    const bookings = queries.find((q) => q.table === "bookings")!;
    expect(argsOf(bookings.chain, "eq")).toEqual(["partner_id", "p-1"]);
    const contacts = queries.find((q) => q.table === "contacts")!;
    expect(argsOf(contacts.chain, "in")).toEqual(["id", ["c-1"]]);
  });

  test("a partner with no clients, or a role that is not the team's, finds nobody", async () => {
    respond = () => ({ data: [], error: null });
    expect(await search({ role: "partner", userId: "p-1" }, "ana")).toEqual({
      ok: true,
      contacts: [],
    });
    expect(queries.some((q) => q.table === "contacts")).toBe(false);
    expect(await search({ role: "member", userId: "x" }, "ana")).toEqual({
      ok: true,
      contacts: [],
    });
  });

  test("too short, too long or not text is refused; what the filter grammar reads is dropped", async () => {
    for (const bad of ["a", " ", "x".repeat(81), 42, null]) {
      expect(await search({ role: "admin", userId: "me" }, bad)).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    respond = () => ({ data: [], error: null });
    await search({ role: "admin", userId: "me" }, "ana,(x)*");
    const contacts = queries.find((q) => q.table === "contacts")!;
    for (const step of contacts.chain.filter((s) => s.name === "or")) {
      expect(String(step.args[0])).not.toMatch(/[(),]x|\*\*/);
    }
  });

  test("a database that fails is 'failed', never an empty list that looks like no match", async () => {
    respond = () => ({ data: null, error: { message: "down" } });
    expect(await search({ role: "admin", userId: "me" }, "ana")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});
