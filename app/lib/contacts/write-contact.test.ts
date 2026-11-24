import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fakeDb, type Row } from "@/lib/whatsapp/fake-contacts-db";
import {
  isDuplicate,
  publicConsentPatch,
  writeContact,
  type ContactWrite,
  type ExistingContact,
} from "./write-contact";

/**
 * The three ways a contact is written (decided by the owner on 2026-11-24),
 * run against an in-memory table: `overwrite` is the team's `upsert_contact`;
 * `public` creates a new contact as typed and only ADDS a yes to an existing
 * one, never over a STOP or an unsubscribe, never its name, phone, language
 * or gender; `link` creates a new one and never touches an existing one.
 */

const NOW = new Date("2026-11-24T10:00:00.000Z");
const now = () => NOW;

const typed: ContactWrite = {
  email: " Ana@Example.com ",
  firstName: "Otra",
  lastName: "Persona",
  phone: "699000111",
  language: "es",
  gender: "male",
  newsletter: true,
  whatsappMarketing: true,
};

const onFile = (over: Row = {}): Row => ({
  id: "c-ana",
  email: "ana@example.com",
  first_name: "Ana María",
  last_name: "Pérez",
  phone: "+34611222333",
  preferred_language: "en",
  gender: "female",
  newsletter_subscribed: false,
  newsletter_subscribed_at: null,
  newsletter_unsubscribed_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_in_at: null,
  whatsapp_opted_out_at: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

/** The fields that are hers and that only the team may change. */
const HERS = [
  "first_name",
  "last_name",
  "phone",
  "preferred_language",
  "gender",
] as const;
const hers = (row: Row) =>
  Object.fromEntries(HERS.map((key) => [key, row[key]]));

function database(rows: Row[], opts: Parameters<typeof fakeDb>[1] = {}) {
  const { db, calls } = fakeDb(rows, opts);
  const rpcs: { name: string; args: unknown }[] = [];
  Object.assign(db as object, {
    rpc: async (name: string, args: unknown) => {
      rpcs.push({ name, args });
      return { data: "contact-1", error: null };
    },
  });
  return { db, calls, rpcs };
}

describe("overwrite: the team's way, `upsert_contact` as it always was", () => {
  test("one call with what was given, and never the booking-notice consent", async () => {
    const { db, rpcs, calls } = database([onFile()]);
    expect(await writeContact(db, typed, "overwrite", now)).toBe("contact-1");
    expect(rpcs).toEqual([
      {
        name: "upsert_contact",
        args: {
          p_email: " Ana@Example.com ",
          p_first_name: "Otra",
          p_last_name: "Persona",
          p_phone: "699000111",
          p_language: "es",
          p_gender: "male",
          p_newsletter: true,
          p_whatsapp: null,
          p_whatsapp_marketing: true,
        },
      },
    ]);
    expect(calls.inserts).toEqual([]);
  });
});

describe("public: a new contact as typed; an existing one only gains a yes", () => {
  test("a new address is created with what was typed, lowercased, and the yes given", async () => {
    const rows: Row[] = [];
    const { db, rpcs } = database(rows);
    expect(await writeContact(db, typed, "public", now)).toBe("c1");
    expect(rpcs).toEqual([]);
    expect(rows[0]).toEqual({
      id: "c1",
      email: "ana@example.com",
      first_name: "Otra",
      last_name: "Persona",
      phone: "699000111",
      preferred_language: "es",
      gender: "male",
      newsletter_subscribed: true,
      newsletter_subscribed_at: NOW.toISOString(),
      whatsapp_marketing_opted_in_at: NOW.toISOString(),
    });
  });

  test("an existing contact keeps every field of hers, gains the yes, and is touched", async () => {
    const rows = [onFile()];
    const { db } = database(rows);
    expect(await writeContact(db, typed, "public", now)).toBe("c-ana");
    expect(hers(rows[0]!)).toEqual(hers(onFile()));
    expect(rows[0]).toMatchObject({
      newsletter_subscribed: true,
      newsletter_subscribed_at: NOW.toISOString(),
      whatsapp_marketing_opted_in_at: NOW.toISOString(),
      // Never given here.
      whatsapp_opted_in_at: null,
      updated_at: NOW.toISOString(),
    });
  });

  test("a STOP and an unsubscribe are never taken back", async () => {
    const stopped = onFile({
      whatsapp_opted_out_at: "2026-02-01T00:00:00.000Z",
      newsletter_unsubscribed_at: "2026-02-01T00:00:00.000Z",
    });
    const rows = [{ ...stopped }];
    const { db } = database(rows);
    await writeContact(db, typed, "public", now);
    expect(rows[0]).toEqual({ ...stopped, updated_at: NOW.toISOString() });
  });

  test("nothing ticked: only touched", async () => {
    const rows = [onFile()];
    const { db, calls } = database(rows);
    await writeContact(
      db,
      { ...typed, newsletter: null, whatsappMarketing: null },
      "public",
      now,
    );
    expect(calls.updates).toEqual([{ updated_at: NOW.toISOString() }]);
  });

  test("written by somebody else between the read and the insert: found, not overwritten", async () => {
    const rows: Row[] = [];
    const { db, calls } = database(rows);
    // The first read finds nothing; the other call's row lands right after
    // it, so the insert is refused as the unique index refuses it.
    const from = (db as { from: (t: string) => Record<string, unknown> }).from;
    let first = true;
    Object.assign(db as object, {
      from: (table: string) => {
        const chain = from(table);
        const maybeSingle = chain.maybeSingle as () => Promise<unknown>;
        chain.maybeSingle = () => {
          const answer = maybeSingle();
          if (first) {
            first = false;
            rows.push(onFile());
          }
          return answer;
        };
        return chain;
      },
    });
    expect(await writeContact(db, typed, "public", now)).toBe("c-ana");
    expect(calls.inserts).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(hers(rows[0]!)).toEqual(hers(onFile()));
  });

  test("a database that does not answer is null, never a throw", async () => {
    for (const failOn of ["read", "write"] as const) {
      const { db } = database([], { failOn });
      expect(await writeContact(db, typed, "public", now)).toBeNull();
    }
    const { db } = database([]);
    expect(
      await writeContact(db, { ...typed, email: "  " }, "public", now),
    ).toBeNull();
  });
});

describe("link: a new contact as given; an existing one is only found", () => {
  test("an existing contact is not written at all, not even touched", async () => {
    const rows = [onFile()];
    const { db, calls, rpcs } = database(rows);
    expect(await writeContact(db, typed, "link", now)).toBe("c-ana");
    expect({ rpcs, inserts: calls.inserts, updates: calls.updates }).toEqual({
      rpcs: [],
      inserts: [],
      updates: [],
    });
    expect(rows[0]).toEqual(onFile());
  });

  test("a new address is created as given", async () => {
    const rows: Row[] = [];
    const { db } = database(rows);
    expect(
      await writeContact(
        db,
        { ...typed, language: null, newsletter: null, whatsappMarketing: null },
        "link",
        now,
      ),
    ).toBe("c1");
    expect(rows[0]).toMatchObject({
      email: "ana@example.com",
      first_name: "Otra",
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
    });
    // No language given: the column's own default.
    expect(rows[0]).not.toHaveProperty("preferred_language");
  });
});

describe("the pure rules", () => {
  const existing = (over: Partial<ExistingContact> = {}): ExistingContact => ({
    id: "c",
    newsletter_subscribed: false,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: null,
    whatsapp_opted_out_at: null,
    ...over,
  });
  const iso = NOW.toISOString();

  test("a yes is added only where there is no no, and a yes given before keeps its date", () => {
    expect(
      publicConsentPatch(
        existing(),
        { newsletter: true, whatsappMarketing: true },
        iso,
      ),
    ).toEqual({
      newsletter_subscribed: true,
      newsletter_subscribed_at: iso,
      whatsapp_marketing_opted_in_at: iso,
    });
    expect(
      publicConsentPatch(
        existing({
          newsletter_unsubscribed_at: iso,
          whatsapp_opted_out_at: iso,
        }),
        { newsletter: true, whatsappMarketing: true },
        iso,
      ),
    ).toEqual({});
    expect(
      publicConsentPatch(
        existing({
          newsletter_subscribed: true,
          whatsapp_marketing_opted_in_at: "2026-01-01T00:00:00.000Z",
        }),
        { newsletter: true, whatsappMarketing: true },
        iso,
      ),
    ).toEqual({});
    expect(
      publicConsentPatch(
        existing(),
        { newsletter: null, whatsappMarketing: null },
        iso,
      ),
    ).toEqual({});
  });

  test("a unique violation is recognised by its code or its message", () => {
    expect(isDuplicate({ code: "23505" })).toBe(true);
    expect(
      isDuplicate({
        message: 'violates unique constraint "contacts_email_key"',
      }),
    ).toBe(true);
    expect(isDuplicate({ code: "23503", message: "foreign key" })).toBe(false);
    expect(isDuplicate(null)).toBe(false);
  });
});

describe("every door that proves no address writes the public way", () => {
  const ROOT = join(import.meta.dir, "..", "..", "..");
  const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

  test.each([
    [
      "the booking form's contact",
      "app/lib/contacts/public-contact.ts",
      "public",
    ],
    [
      "a run or course registration",
      "app/lib/contacts/event-registration.ts",
      "public",
    ],
    [
      "a client's own session on the form",
      "app/lib/whatsapp/self-consent.ts",
      "public",
    ],
    [
      "a bonus bought online",
      "app/services/bonus-payments.service.ts",
      "public",
    ],
    ["a sign-up with the newsletter ticked", "app/actions/auth.ts", "public"],
    ["the team's confirmation", "app/lib/bookings/notify.ts", "link"],
    ["a paid web booking", "app/services/booking-payments.service.ts", "link"],
  ])("%s", (_door, path, mode) => {
    const source = read(path);
    expect({ path, mode: source.includes(`"${mode}",\n`) }).toEqual({
      path,
      mode: true,
    });
    // None of them rewrites a contact by itself any more.
    expect(source).not.toMatch(/\.upsert\(|"upsert_contact"/);
    expect(source).not.toContain("newsletter_unsubscribed_at: null");
  });
});
