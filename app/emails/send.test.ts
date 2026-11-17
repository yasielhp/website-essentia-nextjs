import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

/**
 * `sendEmailBatch` says whether what failed was REFUSED by Resend (`rejected`):
 * an answer with a 4xx, after which nothing left. A request that got no
 * answer, or a 5xx, may have been sent all the same, and is not that.
 *
 * Resend and the database are replaced; nothing is sent.
 */

type Answer = {
  data: { data: { id: string }[] } | null;
  error: { message: string; statusCode: number | null; name: string } | null;
};

/** What Resend answers to each chunk, in order; a function may throw. */
let answers: (() => Answer)[] = [];
let calls = 0;

const taken = (count: number) => (): Answer => ({
  data: { data: Array.from({ length: count }, (_, i) => ({ id: `re_${i}` })) },
  error: null,
});
const refused =
  (statusCode: number | null, message = "no") =>
  (): Answer => ({
    data: null,
    error: { message, statusCode, name: "validation_error" },
  });
const thrown = () => (): Answer => {
  throw new Error("socket hang up");
};

const emails = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    to: `c${i}@example.test`,
    subject: "Hola",
    html: "<p>Hola</p>",
    blindCopy: false,
  }));

const real = {
  resend: { ...(await import("resend")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
};

let sendEmailBatch: typeof import("./send").sendEmailBatch;
const KEY = process.env.RESEND_API_KEY;
let quiet: ReturnType<typeof spyOn>;

beforeAll(async () => {
  mock.module("resend", () => ({
    ...real.resend,
    Resend: class {
      batch = {
        send: async () => {
          const answer = answers[calls] ?? taken(0);
          calls += 1;
          return answer();
        },
      };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      throw new Error("no database in this test");
    },
  }));
  ({ sendEmailBatch } = await import("./send"));
});

afterAll(() => {
  mock.module("resend", () => real.resend);
  mock.module("@/lib/insforge-admin", () => real.admin);
  if (KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = KEY;
});

beforeEach(() => {
  answers = [];
  calls = 0;
  process.env.RESEND_API_KEY = "test-key";
  quiet?.mockRestore();
  quiet = spyOn(console, "error").mockImplementation(() => {});
});

describe("sendEmailBatch: `rejected`", () => {
  test("nothing failed: not rejected, and the ids as always", async () => {
    answers = [taken(2)];
    const result = await sendEmailBatch(emails(2));
    quiet.mockRestore();
    expect(result).toEqual({
      sent: 2,
      ids: ["re_0", "re_1"],
      error: null,
      rejected: false,
    });
  });

  test.each([400, 401, 403, 422, 429])(
    "Resend answered a %i: rejected, nothing left",
    async (status) => {
      answers = [refused(status, "turned down")];
      const result = await sendEmailBatch(emails(2));
      quiet.mockRestore();
      expect(result).toEqual({
        sent: 0,
        ids: [null, null],
        error: "turned down",
        rejected: true,
      });
    },
  );

  test.each([500, 502, 503])(
    "a %i is not a refusal: Resend may have sent it",
    async (status) => {
      answers = [refused(status)];
      const result = await sendEmailBatch(emails(1));
      quiet.mockRestore();
      expect(result).toMatchObject({ sent: 0, error: "no", rejected: false });
    },
  );

  test("a request that got no answer (no status at all) is not a refusal", async () => {
    answers = [refused(null, "Unable to fetch data")];
    const result = await sendEmailBatch(emails(1));
    quiet.mockRestore();
    expect(result).toMatchObject({ sent: 0, rejected: false });
  });

  test("neither is a call that throws", async () => {
    answers = [thrown()];
    const result = await sendEmailBatch(emails(1));
    quiet.mockRestore();
    expect(result).toMatchObject({
      sent: 0,
      error: "socket hang up",
      rejected: false,
    });
  });

  test("no ids in an answer without an error is not a refusal either", async () => {
    answers = [() => ({ data: null, error: null })];
    const result = await sendEmailBatch(emails(1));
    quiet.mockRestore();
    expect(result).toMatchObject({
      error: "Resend returned no ids",
      rejected: false,
    });
  });

  test("one chunk taken and one refused: rejected, with the ids of the one that left", async () => {
    answers = [taken(100), refused(422, "turned down")];
    const result = await sendEmailBatch(emails(101));
    quiet.mockRestore();
    expect(result.sent).toBe(100);
    expect(result.ids[100]).toBeNull();
    expect(result.rejected).toBe(true);
  });

  test("one chunk refused and one with no answer: not rejected, because one may have left", async () => {
    answers = [refused(422, "turned down"), thrown()];
    const result = await sendEmailBatch(emails(101));
    quiet.mockRestore();
    expect(result).toMatchObject({
      sent: 0,
      error: "turned down",
      rejected: false,
    });
  });

  test("with nothing to send, or no key, nothing was rejected", async () => {
    expect(await sendEmailBatch([])).toMatchObject({ rejected: false });
    delete process.env.RESEND_API_KEY;
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const result = await sendEmailBatch(emails(1));
    warn.mockRestore();
    quiet.mockRestore();
    expect(result).toEqual({
      sent: 0,
      ids: [null],
      error: null,
      rejected: false,
    });
    expect(calls).toBe(0);
  });
});
