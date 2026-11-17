import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

/**
 * `authenticate`, run for real with Insforge's session endpoint and the
 * profiles table replaced. What is under test is the two addresses it answers
 * with: `email`, which prefers the profile's and is what every caller has
 * always read, and `verifiedEmail`, which is the auth session's and nothing
 * else. A user can rewrite her own `profiles.email`, so anything that decides
 * WHOSE record to touch must read the second.
 *
 * The module and the globals are put back afterwards: `mock.module` is
 * process-wide.
 */

let sessionUser: { id?: string; email?: string | null } | null = null;
let sessionStatus = 200;
let profile: { role: string | null; email: string | null } | null = null;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  fetch: globalThis.fetch,
  url: process.env.NEXT_PUBLIC_INSFORGE_URL,
};

let authenticate: typeof import("@/lib/auth-guard").authenticate;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_INSFORGE_URL = "https://auth.example.test";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ user: sessionUser }), {
      status: sessionStatus,
    })) as unknown as typeof fetch;
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: profile, error: null }),
            }),
          }),
        }),
      },
    }),
  }));
  ({ authenticate } = await import("@/lib/auth-guard"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  globalThis.fetch = real.fetch;
  if (real.url === undefined) delete process.env.NEXT_PUBLIC_INSFORGE_URL;
  else process.env.NEXT_PUBLIC_INSFORGE_URL = real.url;
});

// The guard caches by token for 30 s: a token of its own for every test.
let n = 0;
const token = () => `token-${(n += 1)}`;

beforeEach(() => {
  sessionUser = { id: "u1", email: "Ana@Example.com " };
  sessionStatus = 200;
  profile = { role: "client", email: "ana@example.com" };
});

describe("authenticate: the two addresses", () => {
  test("verifiedEmail is the auth session's address, trimmed and lowercased", async () => {
    const context = await authenticate(token());
    expect(context.verifiedEmail).toBe("ana@example.com");
    expect(context).toMatchObject({ userId: "u1", role: "client" });
  });

  test("a profile whose address was rewritten changes `email`, never `verifiedEmail`", async () => {
    profile = { role: "client", email: "victim@example.com" };
    const context = await authenticate(token());
    // What every other caller has always read, untouched.
    expect(context.email).toBe("victim@example.com");
    expect(context.verifiedEmail).toBe("ana@example.com");
  });

  test("`email` still falls back to the session's when the profile has none, as it always did", async () => {
    profile = { role: "client", email: null };
    const context = await authenticate(token());
    expect(context.email).toBe("Ana@Example.com ");
    expect(context.verifiedEmail).toBe("ana@example.com");
  });

  test("a session with no address has no verified address, whatever the profile says", async () => {
    for (const email of [null, undefined, "", "   "]) {
      sessionUser = { id: "u1", email };
      const context = await authenticate(token());
      expect(context.verifiedEmail).toBeNull();
      expect(context.email).toBe("ana@example.com");
    }
  });

  test("the cached answer carries it too", async () => {
    const same = token();
    await authenticate(same);
    sessionUser = { id: "u1", email: "other@example.com" };
    expect((await authenticate(same)).verifiedEmail).toBe("ana@example.com");
  });

  test("no token, a refused session or no profile still throw, as before", async () => {
    await expect(authenticate(null)).rejects.toThrow("Authentication required");
    sessionStatus = 401;
    await expect(authenticate(token())).rejects.toThrow(
      "Invalid or expired session",
    );
    sessionStatus = 200;
    profile = null;
    await expect(authenticate(token())).rejects.toThrow(
      "No profile associated with this account",
    );
  });
});
