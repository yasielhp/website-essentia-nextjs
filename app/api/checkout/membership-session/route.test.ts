import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { MEMBERSHIPS_ON_SALE } from "@/constants/memberships";

/**
 * The real membership checkout, with the database and the bank replaced. While
 * memberships are not on sale (`MEMBERSHIPS_ON_SALE`), a call, from the site or
 * straight at the route, is refused before anything is read or sent.
 */

let reads = 0;
let providerAsked = 0;

const ENV = ["NEXT_PUBLIC_INSFORGE_URL", "NEXT_PUBLIC_INSFORGE_ANON_KEY"];
const envBefore = ENV.map((name) => process.env[name]);
process.env.NEXT_PUBLIC_INSFORGE_URL ??= "https://insforge.invalid";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "not-a-key";
const real = {
  publicClient: { ...(await import("@/lib/insforge-public")) },
  payments: { ...(await import("@/lib/payments")) },
};
ENV.forEach((name, i) => {
  if (envBefore[i] === undefined) delete process.env[name];
  else process.env[name] = envBefore[i];
});

let POST: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  mock.module("@/lib/insforge-public", () => ({
    ...real.publicClient,
    insforgePublic: {
      database: {
        from: () => {
          reads += 1;
          throw new Error("no plan may be read");
        },
      },
    },
  }));
  mock.module("@/lib/payments", () => ({
    ...real.payments,
    getRedsysProvider: () => {
      providerAsked += 1;
      return null;
    },
  }));
  ({ POST } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-public", () => real.publicClient);
  mock.module("@/lib/payments", () => real.payments);
});

beforeEach(() => {
  reads = 0;
  providerAsked = 0;
});

describe("POST /api/checkout/membership-session", () => {
  test("memberships are not on sale", () => {
    expect(MEMBERSHIPS_ON_SALE).toBe(false);
  });

  test("a direct call is refused with a clear code, and nothing is read or sent to the bank", async () => {
    const res = await POST(
      new NextRequest(
        "https://app.example.test/api/checkout/membership-session",
        {
          method: "POST",
          body: JSON.stringify({ planId: "any", email: "a@b.test" }),
        },
      ),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "memberships_not_on_sale" });
    expect(reads).toBe(0);
    expect(providerAsked).toBe(0);
  });

  test("even a body that is not JSON gets the same answer", async () => {
    const res = await POST(
      new NextRequest(
        "https://app.example.test/api/checkout/membership-session",
        { method: "POST", body: "{" },
      ),
    );
    expect(res.status).toBe(404);
  });

  test("the page a payment returns to stays reachable", () => {
    const route = readFileSync(join(import.meta.dir, "route.ts"), "utf8");
    expect(route).toContain("/experiences/memberships?payment=success");
    const page = readFileSync(
      join(
        import.meta.dir,
        "../../../(site)/[locale]/(page)/experiences/memberships/page.tsx",
      ),
      "utf8",
    );
    expect(page).not.toContain("notFound");
    expect(page).not.toContain("redirect");
  });
});
