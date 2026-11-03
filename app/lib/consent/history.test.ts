import { describe, expect, it } from "bun:test";
import {
  appendHistory,
  consentState,
  historyEntryFrom,
  type ConsentSnapshot,
} from "./history";

const signed: ConsentSnapshot = {
  signed_at: "2026-11-03T10:00:00.000Z",
  signed_name: "Fiona Smith",
  data: { surgery: false, avoidZone: "cuello" },
  image_consent: true,
  health_data_consent: true,
  signature_path: "c1/1.png",
  filled_by_role: "client",
  version: 1,
};

describe("historyEntryFrom", () => {
  it("keeps everything that describes the signing, including the file path", () => {
    expect(historyEntryFrom(signed)).toEqual({
      signed_at: "2026-11-03T10:00:00.000Z",
      signed_name: "Fiona Smith",
      data: { surgery: false, avoidZone: "cuello" },
      image_consent: true,
      health_data_consent: true,
      signature_path: "c1/1.png",
      filled_by_role: "client",
      version: 1,
    });
  });

  it("makes no entry for a consent that was never signed", () => {
    expect(historyEntryFrom({ ...signed, signed_at: null })).toBeNull();
  });

  it("turns missing answers into an empty object", () => {
    expect(historyEntryFrom({ ...signed, data: null })?.data).toEqual({});
  });
});

describe("appendHistory", () => {
  const entry = historyEntryFrom(signed)!;

  it("adds the entry after the earlier ones, oldest first", () => {
    const older = { ...entry, version: 0 };
    expect(appendHistory([older], entry).map((e) => e.version)).toEqual([0, 1]);
  });

  it("starts a history from nothing or from junk", () => {
    expect(appendHistory(null, entry)).toEqual([entry]);
    expect(appendHistory("nope", entry)).toEqual([entry]);
  });

  it("does not change the array it was given", () => {
    const before = [entry];
    appendHistory(before, entry);
    expect(before).toHaveLength(1);
  });
});

describe("consentState", () => {
  it("is signed once there is a signing date", () => {
    expect(consentState({ signed_at: "2026-11-03", data: {} })).toBe("signed");
  });

  it("is reopened when answers remain but the signature is gone", () => {
    expect(consentState({ signed_at: null, data: { surgery: true } })).toBe(
      "reopened",
    );
  });

  it("is none for a row that was only created to hold a link", () => {
    expect(consentState({ signed_at: null, data: {} })).toBe("none");
    expect(consentState({ signed_at: null, data: null })).toBe("none");
  });
});
