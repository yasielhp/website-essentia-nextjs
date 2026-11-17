import { describe, expect, it } from "bun:test";
import { editorNames, withEditors } from "./editors";
import type { MessageTemplateRowView } from "./types";

const view = (key: string, locale: string): MessageTemplateRowView =>
  ({
    key,
    channel: "email",
    locale,
    updated_at: "x",
  }) as MessageTemplateRowView;

describe("withEditors", () => {
  const raw = [
    {
      key: "booking_confirmed",
      channel: "email",
      locale: "es",
      updated_by: "u1",
    },
    {
      key: "booking_confirmed",
      channel: "email",
      locale: "en",
      updated_by: "gone",
    },
    { key: "booking_paid", channel: "email", locale: "es", updated_by: null },
  ];
  const names = new Map([["u1", "Nuria Pérez"]]);

  it("puts the name of whoever saved each row on it", () => {
    const rows = withEditors(
      [
        view("booking_confirmed", "es"),
        view("booking_confirmed", "en"),
        view("booking_paid", "es"),
      ],
      raw,
      names,
    );
    expect(rows.map((r) => r.updated_by_name)).toEqual([
      "Nuria Pérez",
      null,
      null,
    ]);
  });

  it("a row the raw data has no match for gets none", () => {
    expect(
      withEditors([view("consent_request", "es")], raw, names)[0]
        .updated_by_name,
    ).toBeNull();
  });
});

describe("editorNames", () => {
  it("prefers the full name, then the first", () => {
    const map = editorNames([
      { id: "a", full_name: "Ana García", first_name: "Ana" },
      { id: "b", full_name: null, first_name: "Berta" },
      { id: "c", full_name: " ", first_name: null },
    ]);
    expect(map.get("a")).toBe("Ana García");
    expect(map.get("b")).toBe("Berta");
    expect(map.has("c")).toBe(false);
  });
});
