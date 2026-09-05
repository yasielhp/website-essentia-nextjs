import { describe, expect, it } from "bun:test";
import { dueRecipients, localDay } from "./automation-rules";
import type { Recipient } from "./audience-filter";

const NOW = new Date("2026-09-05T12:00:00Z"); // 2026-09-05 in the Canaries
const ACTIVATED = "2026-09-01T00:00:00Z";

const r = (over: Partial<Recipient> = {}): Recipient => ({
  id: "1",
  email: "a@x.com",
  firstName: "A",
  language: "es",
  lastBookingDate: null,
  firstBookingDate: null,
  subscribedAt: null,
  birthdate: null,
  ...over,
});

const cycles = (due: ReturnType<typeof dueRecipients>) =>
  due.map((d) => `${d.recipient.id}:${d.cycle}`);

describe("localDay", () => {
  it("formats the Canary day as YYYY-MM-DD", () => {
    expect(localDay(NOW)).toBe("2026-09-05");
    // Just before midnight UTC is still the same day in the Canaries (UTC+1).
    expect(localDay(new Date("2026-09-05T23:30:00Z"))).toBe("2026-09-06");
  });
});

describe("dueRecipients", () => {
  it("segment_entry owes everyone once", () => {
    const due = dueRecipients({
      trigger: { event: "segment_entry" },
      recipients: [r(), r({ id: "2", email: "b@x.com" })],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:", "2:"]);
  });

  it("newsletter_subscribed greets only those who joined after activation", () => {
    const due = dueRecipients({
      trigger: { event: "newsletter_subscribed" },
      recipients: [
        r({ subscribedAt: "2026-09-03T10:00:00Z" }),
        r({ id: "2", subscribedAt: "2026-08-20T10:00:00Z" }),
        r({ id: "3", subscribedAt: null }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:"]);
  });

  it("after_booking fires N days after the last booking, keyed by that date", () => {
    const due = dueRecipients({
      trigger: { event: "after_booking", days: 3 },
      recipients: [
        r({ lastBookingDate: "2026-09-02" }),
        r({ id: "2", lastBookingDate: "2026-09-01" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026-09-02"]);
  });

  it("birthday matches month and day, once per year", () => {
    const due = dueRecipients({
      trigger: { event: "birthday" },
      recipients: [
        r({ birthdate: "1990-09-05" }),
        r({ id: "2", birthdate: "1990-09-06" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026"]);
  });

  it("first_booking_anniversary skips the year of the booking itself", () => {
    const due = dueRecipients({
      trigger: { event: "first_booking_anniversary" },
      recipients: [
        r({ firstBookingDate: "2025-09-05" }),
        r({ id: "2", firstBookingDate: "2026-09-05" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026"]);
  });

  it("new_blog_post sends each post published since activation, with its vars", () => {
    const due = dueRecipients({
      trigger: { event: "new_blog_post" },
      recipients: [r({ language: "es" }), r({ id: "2", language: "en" })],
      activatedAt: ACTIVATED,
      now: NOW,
      posts: [
        {
          id: "p1",
          publishedAt: "2026-09-04T09:00:00Z",
          title: { en: "Autumn", es: "Otoño" },
          excerpt: { en: "e", es: "x" },
          url: { en: "https://a/blog/autumn", es: "https://a/es/blog/otono" },
        },
        {
          id: "p0",
          publishedAt: "2026-08-01T09:00:00Z",
          title: { en: "Old", es: "Viejo" },
          excerpt: { en: "", es: "" },
          url: { en: "https://a/blog/old", es: "https://a/es/blog/viejo" },
        },
      ],
    });
    expect(cycles(due)).toEqual(["1:p1", "2:p1"]);
    expect(due[0]?.vars?.post_title).toBe("Otoño");
    expect(due[1]?.vars?.post_url).toBe("https://a/blog/autumn");
  });

  it("an unknown or missing event owes nobody", () => {
    expect(
      dueRecipients({
        trigger: {},
        recipients: [r()],
        activatedAt: ACTIVATED,
        now: NOW,
      }),
    ).toEqual([]);
  });
});
