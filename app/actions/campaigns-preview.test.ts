import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";

/**
 * The reach the campaign form shows. A notice about her appointment is counted
 * with the consent to appointment notices, or the form would say "nobody would
 * receive it" for exactly the clients it is for, and refuse to go on.
 */

let calls: unknown[][] = [];

const real = {
  audience: { ...(await import("@/lib/campaigns/audience")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};
let previewAudience: typeof import("./campaigns").previewAudience;

beforeAll(async () => {
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({
      userId: "admin-1",
      email: "a@example.test",
      role: "admin",
    }),
  }));
  mock.module("@/lib/campaigns/audience", () => ({
    ...real.audience,
    resolveAudience: async (...args: unknown[]) => {
      calls.push(args);
      return [
        {
          id: "c-1",
          email: null,
          firstName: "Ana",
          language: "es",
          phone: "+34600112233",
        },
      ];
    },
  }));
  ({ previewAudience } = await import("./campaigns"));
});

afterAll(() => {
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/campaigns/audience", () => real.audience);
});

beforeEach(() => {
  calls = [];
});

describe("previewAudience", () => {
  test("an appointment notice is counted with the consent to appointment notices", async () => {
    const out = await previewAudience(
      "t",
      EMPTY_AUDIENCE,
      "whatsapp",
      "appointment",
    );
    expect(out).toMatchObject({ count: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toBe("whatsapp");
    expect(calls[0]?.[3]).toEqual({ purpose: "appointment" });
  });

  test("every other call is resolved exactly as before: three arguments", async () => {
    await previewAudience("t", EMPTY_AUDIENCE, "whatsapp");
    await previewAudience("t", EMPTY_AUDIENCE, "email");
    await previewAudience("t", EMPTY_AUDIENCE);
    await previewAudience("t", EMPTY_AUDIENCE, "whatsapp", "standard");
    await previewAudience("t", EMPTY_AUDIENCE, "whatsapp", "automated");
    for (const call of calls) expect(call).toHaveLength(3);
    expect(calls).toHaveLength(5);
  });

  test("a kind that is not one is refused before anything is read", async () => {
    const out = await previewAudience(
      "t",
      EMPTY_AUDIENCE,
      "whatsapp",
      "nope" as never,
    );
    expect(out).toEqual({ ok: false, error: "invalid" });
    expect(calls).toHaveLength(0);
  });
});
