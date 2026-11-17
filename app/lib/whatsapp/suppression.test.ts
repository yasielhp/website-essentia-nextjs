import { describe, expect, it, spyOn } from "bun:test";
import { argsOf, chainDb, has, type Step } from "@/lib/campaigns/fake-db";
import {
  SUPPRESSED_TABLE,
  isPhoneSuppressed,
  loadAllSuppressedPhones,
  loadSuppressedPhones,
  recordOptOutSuppression,
  suppressPhones,
  suppressionRows,
} from "./suppression";

type Answer = { data?: unknown; error?: { message: string } | null };

function db(
  answer: (table: string, chain: Step[]) => Answer | Promise<Answer>,
) {
  return chainDb(async (table, chain) => {
    const out = await answer(table, chain);
    return { data: out.data ?? null, error: out.error ?? null };
  });
}

describe("suppressionRows", () => {
  it("normalises each sender to the E.164 the table accepts, once", () => {
    expect(
      suppressionRows(["34600112233", "+34 600 11 22 33", "600112233"]),
    ).toEqual([{ phone: "+34600112233", reason: "stop" }]);
  });

  it("drops what the table's own check would refuse", () => {
    expect(
      suppressionRows(["12345", "not a number", "", "+1234567890123456"]),
    ).toEqual([]);
  });

  it("keeps different numbers apart, in order", () => {
    expect(
      suppressionRows(["34600112233", "447911123456"]).map((r) => r.phone),
    ).toEqual(["+34600112233", "+447911123456"]);
  });
});

describe("suppressPhones", () => {
  it("writes the rows with 'on conflict do nothing' on the phone", async () => {
    const { db: client, log } = db(() => ({}));
    expect(await suppressPhones(client, ["34600112233"])).toBe(1);
    const write = log.find((q) => q.table === SUPPRESSED_TABLE)!;
    expect(argsOf(write.chain, "upsert")?.[0]).toEqual([
      { phone: "+34600112233", reason: "stop" },
    ]);
    expect(argsOf(write.chain, "upsert")?.[1]).toMatchObject({
      onConflict: "phone",
      ignoreDuplicates: true,
    });
  });

  it("with nothing valid to write it does not touch the database", async () => {
    const { db: client, log } = db(() => ({}));
    expect(await suppressPhones(client, ["nope"])).toBe(0);
    expect(log).toHaveLength(0);
  });

  it("throws what the database says, for the caller to log", async () => {
    const { db: client } = db(() => ({
      error: { message: 'relation "x" does not exist' },
    }));
    await expect(suppressPhones(client, ["34600112233"])).rejects.toThrow(
      "does not exist",
    );
  });
});

describe("recordOptOutSuppression", () => {
  it("writes the senders even when no contact matches any of them", async () => {
    const { db: client, log } = db(() => ({}));
    await recordOptOutSuppression(client, ["34600112233"]);
    expect(log.map((q) => q.table)).toEqual([SUPPRESSED_TABLE]);
    expect(has(log[0]!.chain, "upsert")).toBe(true);
  });

  it("a database error is logged and never thrown, a missing table included", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const { db: client } = db(() => ({
      error: {
        message: 'relation "whatsapp_suppressed_phones" does not exist',
      },
    }));
    await recordOptOutSuppression(client, ["34600112233"]);
    expect(quiet).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it("a client that throws is logged too", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      from() {
        throw new Error("no client");
      },
    } as unknown as Parameters<typeof recordOptOutSuppression>[0];
    await recordOptOutSuppression(broken, ["34600112233"]);
    expect(quiet).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });
});

describe("loadSuppressedPhones", () => {
  const listed = ["+34600112233"];
  const table = () =>
    db((_t, chain) => ({
      data: listed
        .filter((p) =>
          ((argsOf(chain, "in")?.[1] as string[]) ?? []).includes(p),
        )
        .map((phone) => ({ phone })),
    }));

  it("answers which of the phones are on the list, however they were written", async () => {
    const { db: client } = table();
    expect(
      await loadSuppressedPhones(client, ["600 11 22 33", "611222333"]),
    ).toEqual(new Set(["+34600112233"]));
  });

  it("asks for nothing when there is nothing to ask about", async () => {
    const { db: client, log } = table();
    expect((await loadSuppressedPhones(client, [])).size).toBe(0);
    expect((await loadSuppressedPhones(client, ["nope"])).size).toBe(0);
    expect(log).toHaveLength(0);
  });

  it("throws when the list cannot be read: callers must not send on a guess", async () => {
    const { db: client } = db(() => ({ error: { message: "boom" } }));
    await expect(loadSuppressedPhones(client, ["600112233"])).rejects.toThrow(
      "boom",
    );
  });

  it("isPhoneSuppressed is the same read for one number", async () => {
    const { db: client } = table();
    expect(await isPhoneSuppressed(client, "+34600112233")).toBe(true);
    expect(await isPhoneSuppressed(client, "+34611222333")).toBe(false);
  });

  it("reads the whole list for an audience, and throws if it cannot", async () => {
    const { db: client } = db(() => ({
      data: [{ phone: "+34600112233" }, { phone: "+34611222333" }],
    }));
    expect(await loadAllSuppressedPhones(client)).toEqual(
      new Set(["+34600112233", "+34611222333"]),
    );
    const { db: broken } = db(() => ({ error: { message: "no table" } }));
    await expect(loadAllSuppressedPhones(broken)).rejects.toThrow("no table");
  });
});
