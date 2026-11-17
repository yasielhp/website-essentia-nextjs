import { describe, expect, test } from "bun:test";
import {
  recipientIdentity,
  recipientLastEvent,
  recipientMatches,
  recipientName,
} from "./recipient-row";

const base = {
  email: null,
  phone: null,
  sent_at: null,
  delivered_at: null,
  opened_at: null,
  clicked_at: null,
  read_at: null,
};

describe("recipientIdentity", () => {
  test("a WhatsApp recipient is its phone, a dash when it has none", () => {
    expect(
      recipientIdentity({ ...base, phone: "+34600000001" }, "whatsapp"),
    ).toBe("+34600000001");
    expect(recipientIdentity({ ...base, email: "a@b.c" }, "whatsapp")).toBe(
      "—",
    );
  });
  test("an email recipient is its address, or its phone when it has no address", () => {
    expect(
      recipientIdentity({ ...base, email: "a@b.c", phone: "+34" }, "email"),
    ).toBe("a@b.c");
    expect(recipientIdentity({ ...base, phone: "+34" }, "email")).toBe("+34");
    expect(recipientIdentity(base, "email")).toBe("—");
  });
});

describe("recipientLastEvent", () => {
  const stamps = {
    sent_at: "1",
    delivered_at: "2",
    opened_at: "3",
    clicked_at: "4",
    read_at: "5",
  };
  test("WhatsApp has no clicks: the read receipt is its last word", () => {
    expect(recipientLastEvent({ ...base, ...stamps }, "whatsapp")).toBe("5");
    expect(
      recipientLastEvent(
        { ...base, sent_at: "1", delivered_at: "2" },
        "whatsapp",
      ),
    ).toBe("2");
  });
  test("an email's last word is the click, then the open, then the delivery", () => {
    expect(recipientLastEvent({ ...base, ...stamps }, "email")).toBe("4");
    expect(
      recipientLastEvent({ ...base, sent_at: "1", opened_at: "3" }, "email"),
    ).toBe("3");
    expect(recipientLastEvent({ ...base, sent_at: "1" }, "email")).toBe("1");
    expect(recipientLastEvent(base, "email")).toBeNull();
  });
});

describe("the name of a recipient, and finding her by it", () => {
  const ana = { contact_name: "Ana Pérez", email: null, phone: "+34600112233" };
  test("a row with no contact (deleted since) has no name", () => {
    expect(recipientName({ contact_name: null })).toBeNull();
    expect(recipientName({})).toBeNull();
    expect(recipientName({ contact_name: "  " })).toBeNull();
    expect(recipientName(ana)).toBe("Ana Pérez");
  });
  test("the search finds by name, without minding case", () => {
    expect(recipientMatches(ana, "ana")).toBe(true);
    expect(recipientMatches(ana, "PÉREZ")).toBe(true);
    expect(recipientMatches(ana, "luis")).toBe(false);
  });
  test("and by phone, with or without spaces, and by address", () => {
    expect(recipientMatches(ana, "600 11")).toBe(true);
    expect(recipientMatches(ana, "+34600112233")).toBe(true);
    expect(
      recipientMatches(
        { contact_name: null, email: "Ana@Example.com", phone: null },
        "ana@exa",
      ),
    ).toBe(true);
  });
  test("an empty search finds everyone, and a row with no name is still found by its phone", () => {
    expect(recipientMatches(ana, "   ")).toBe(true);
    expect(
      recipientMatches(
        { contact_name: null, email: null, phone: "+34600112233" },
        "112233",
      ),
    ).toBe(true);
  });
});
