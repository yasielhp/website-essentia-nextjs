import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { argsOf, chainDb, filters, type Query } from "@/lib/campaigns/fake-db";

/**
 * The newsletter doors run for real, with the session check, the list and the
 * database replaced. What is under test is WHOSE address a signed-in client can
 * act on (her own, whatever she sends) and that a malformed call is an ordinary
 * refusal, not a crash.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Caller = {
  userId: string;
  /** The profile's address: hers to rewrite, so never proof of who she is. */
  email: string | null;
  /** The auth session's address, as the guard hands it: trimmed, lowercased. */
  verifiedEmail: string | null;
  role: string;
};

const ANA: Caller = {
  userId: "u-ana",
  email: "Ana@Example.com",
  verifiedEmail: "ana@example.com",
  role: "user",
};
const ADMIN: Caller = {
  userId: "u-admin",
  email: "admin@x.test",
  verifiedEmail: "admin@x.test",
  role: "admin",
};

let caller: Caller | null = ANA;
let listed: { email: string; subscribed: boolean }[] = [];
let listOk = true;
let profileUpdates: Query[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  newsletter: { ...(await import("@/lib/newsletter")) },
};

let actions: typeof import("@/actions/newsletter");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      const made = chainDb(async () => ({ data: null, error: null }));
      profileUpdates = made.log;
      return { database: made.db };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async () => {
      if (!caller)
        throw new real.guard.AuthError("Authentication required", 401);
      return caller;
    },
  }));
  mock.module("@/lib/newsletter", () => ({
    ...real.newsletter,
    setNewsletterState: async (email: string, subscribed: boolean) => {
      listed.push({ email, subscribed });
      return listOk ? { ok: true } : { ok: false, error: "provider text" };
    },
  }));
  actions = await import("@/actions/newsletter");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/newsletter", () => real.newsletter);
});

beforeEach(() => {
  caller = ANA;
  listed = [];
  listOk = true;
  profileUpdates = [];
});

describe("updateNewsletterForUser", () => {
  test("a signed-in client changes HER address, taken from her session", async () => {
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "Ana@Example.com",
      true,
    );
    expect(result).toEqual({ ok: true });
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: true }]);
    expect(profileUpdates).toHaveLength(1);
    expect(profileUpdates[0]!.table).toBe("profiles");
    expect(argsOf(profileUpdates[0]!.chain, "update")?.[0]).toEqual({
      newsletter_subscribed: true,
    });
    expect(filters(profileUpdates[0]!.chain)).toEqual({ id: "u-ana" });
  });

  test("she cannot unsubscribe somebody else: the address she sends is ignored", async () => {
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "victim@example.com",
      false,
    );
    expect(result.ok).toBe(true);
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: false }]);
    expect(listed.some((l) => l.email.includes("victim"))).toBe(false);
  });

  test("an address she wrote on her own profile is not hers either: the session's is used", async () => {
    // `profiles.email` is a column she can update from the browser.
    caller = { ...ANA, email: "victim@example.com" };
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "victim@example.com",
      false,
    );
    expect(result.ok).toBe(true);
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: false }]);
  });

  test("nor resubscribe somebody else", async () => {
    await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "victim@example.com",
      true,
    );
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: true }]);
  });

  test("the address she sends need not even be a string", async () => {
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      undefined as unknown as string,
      true,
    );
    expect(result.ok).toBe(true);
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: true }]);
  });

  test("somebody else's user id is refused, as before", async () => {
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-other",
      "ana@example.com",
      false,
    );
    expect(result.ok).toBe(false);
    expect(listed).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
  });

  test("a session with no address changes nothing, whatever the profile says", async () => {
    caller = { ...ANA, email: "victim@example.com", verifiedEmail: null };
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "victim@example.com",
      false,
    );
    expect(result.ok).toBe(false);
    expect(listed).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
  });

  test("no session is refused", async () => {
    caller = null;
    const result = await actions.updateNewsletterForUser(
      null,
      "u-ana",
      "ana@example.com",
      false,
    );
    expect(result.ok).toBe(false);
    expect(listed).toHaveLength(0);
  });

  test("an administrator acts on the address and the user she names", async () => {
    caller = ADMIN;
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      " Ana@Example.com ",
      false,
    );
    expect(result).toEqual({ ok: true });
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: false }]);
    expect(filters(profileUpdates[0]!.chain)).toEqual({ id: "u-ana" });
  });

  test("an administrator changing her own preference is on her own address too", async () => {
    caller = ADMIN;
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-admin",
      "victim@example.com",
      true,
    );
    expect(result.ok).toBe(true);
    expect(listed).toEqual([{ email: "admin@x.test", subscribed: true }]);
  });

  test("an administrator's address must be one", async () => {
    caller = ADMIN;
    for (const email of ["", "not-an-address", 7, null, undefined]) {
      const result = await actions.updateNewsletterForUser(
        "token",
        "u-ana",
        email as unknown as string,
        false,
      );
      expect(result.ok).toBe(false);
    }
    expect(listed).toHaveLength(0);
    expect(profileUpdates).toHaveLength(0);
  });

  test("what is not a yes or a no is refused", async () => {
    for (const subscribe of ["false", 0, null, undefined]) {
      const result = await actions.updateNewsletterForUser(
        "token",
        "u-ana",
        "ana@example.com",
        subscribe as unknown as boolean,
      );
      expect(result.ok).toBe(false);
    }
    expect(listed).toHaveLength(0);
  });

  test("a list that fails leaves the profile alone", async () => {
    listOk = false;
    const result = await actions.updateNewsletterForUser(
      "token",
      "u-ana",
      "ana@example.com",
      true,
    );
    expect(result.ok).toBe(false);
    expect(profileUpdates).toHaveLength(0);
  });
});

describe("subscribeToNewsletter", () => {
  test("puts a tidy address on the list", async () => {
    expect(await actions.subscribeToNewsletter("  Ana@Example.com ")).toEqual({
      ok: true,
    });
    expect(listed).toEqual([{ email: "ana@example.com", subscribed: true }]);
  });

  test("what is not a string is an ordinary refusal, not a crash", async () => {
    for (const email of [undefined, null, 7, {}, ["a@b.co"], true]) {
      expect(
        await actions.subscribeToNewsletter(email as unknown as string),
      ).toEqual({ ok: false, error: "invalid" });
    }
    expect(listed).toHaveLength(0);
  });

  test("what is not an address is refused", async () => {
    for (const email of ["", "   ", "ana", "ana@", "@example.com", "a b@c.d"]) {
      expect(await actions.subscribeToNewsletter(email)).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    expect(listed).toHaveLength(0);
  });
});
