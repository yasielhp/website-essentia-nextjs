import { describe, expect, test } from "bun:test";
import { getBreadcrumbs } from "./breadcrumbs";

const SETTINGS = { key: "sections.settings", href: "/dashboard/settings" };
const MESSAGES = {
  key: "sections.messages",
  href: "/dashboard/settings/messages?tab=email",
};

describe("the crumbs of a message's own page: Settings, Messages, the message", () => {
  test("Settings, then Messages (the list), then the message", () => {
    expect(
      getBreadcrumbs("/dashboard/settings/messages/email/booking_confirmed/es"),
    ).toEqual([
      SETTINGS,
      MESSAGES,
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
      getBreadcrumbs("/dashboard/settings/messages/whatsapp/booking_paid/en"),
    ).toEqual([
      SETTINGS,
      MESSAGES,
      {
        messageRow: { channel: "whatsapp", key: "booking_paid", locale: "en" },
      },
    ]);
  });
  test("a trailing slash changes nothing", () => {
    expect(
      getBreadcrumbs(
        "/dashboard/settings/messages/email/booking_confirmed/es/",
      ),
    ).toHaveLength(3);
  });
  test("an address that is no page has no message crumb", () => {
    for (const path of [
      "/dashboard/settings/messages/email/nope/es",
      "/dashboard/settings/messages/email/booking_reminder/en",
      "/dashboard/settings/messages/whatsapp/booking_received/es",
    ]) {
      const crumbs = getBreadcrumbs(path);
      expect(crumbs.some((c) => "messageRow" in c)).toBe(false);
    }
  });
});

describe("the list of messages is a page of Settings", () => {
  test("Settings (a link) › Messages", () => {
    expect(getBreadcrumbs("/dashboard/settings/messages")).toEqual([
      SETTINGS,
      { key: "sections.messages" },
    ]);
  });
  test("the old address is no section of its own any more: it is not given a crumb of Messages as a section", () => {
    const crumbs = getBreadcrumbs("/dashboard/messages");
    expect(crumbs.every((c) => c.key !== "sections.messages")).toBe(true);
  });
});

describe("the other sections are as they were", () => {
  test("Settings itself, its other pages, a sub-list and the overview", () => {
    expect(getBreadcrumbs("/dashboard/settings")).toEqual([
      { key: "sections.settings" },
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
