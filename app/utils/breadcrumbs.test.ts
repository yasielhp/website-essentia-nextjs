import { describe, expect, test } from "bun:test";
import { getBreadcrumbs } from "./breadcrumbs";

describe("the crumbs of a message's own page", () => {
  test("Messages, then the message and its language", () => {
    expect(
      getBreadcrumbs("/dashboard/messages/email/booking_confirmed/es"),
    ).toEqual([
      { key: "sections.messages", href: "/dashboard/messages?tab=email" },
      {
        messageRow: {
          channel: "email",
          key: "booking_confirmed",
          locale: "es",
        },
      },
    ]);
  });
  test("a WhatsApp page says so", () => {
    expect(
      getBreadcrumbs("/dashboard/messages/whatsapp/booking_paid/en"),
    ).toEqual([
      { key: "sections.messages", href: "/dashboard/messages?tab=email" },
      {
        messageRow: { channel: "whatsapp", key: "booking_paid", locale: "en" },
      },
    ]);
  });
  test("a trailing slash changes nothing", () => {
    expect(
      getBreadcrumbs("/dashboard/messages/email/booking_confirmed/es/"),
    ).toHaveLength(2);
  });
  test("an address that is no page falls back to what any unknown address gets", () => {
    for (const path of [
      "/dashboard/messages/email/nope/es",
      "/dashboard/messages/email/booking_reminder/en",
      "/dashboard/messages/whatsapp/booking_received/es",
    ]) {
      const crumbs = getBreadcrumbs(path);
      expect(crumbs.some((c) => "messageRow" in c)).toBe(false);
    }
  });
  test("the list and the other sections are as they were", () => {
    expect(getBreadcrumbs("/dashboard/messages")).toEqual([
      { key: "sections.messages" },
    ]);
    expect(getBreadcrumbs("/dashboard/campaigns/segments")).toEqual([
      { key: "sections.campaigns", href: "/dashboard/campaigns" },
      { key: "leaves.segments" },
    ]);
    expect(getBreadcrumbs("/dashboard")).toEqual([
      { key: "sections.overview" },
    ]);
  });
});
