import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MESSAGE_CATALOG } from "@/lib/messages/catalog";

/**
 * The WhatsApp reminder is an appointment notice now (a campaign of that
 * kind). One fixed reminder as well would mean two messages for one
 * appointment, so it is gone, and the reminder email, which is a different
 * thing, is untouched.
 */

const ROOT = join(import.meta.dir, "../../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/**
 * The source without its comments: what the file does, not what it says about
 * itself. A comment that mentions WhatsApp (to explain why the reminder email
 * has none) is not a behaviour and must not fail the test.
 */
export function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("the fixed WhatsApp reminder is gone", () => {
  test("the cron of the reminder email does not know about WhatsApp", () => {
    expect(
      codeOnly(read("app/api/cron/booking-reminders/route.ts")),
    ).not.toMatch(/whatsapp/i);
  });

  test("its sender and its window are not there", () => {
    expect(existsSync(join(ROOT, "app/lib/whatsapp/reminders.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/lib/bookings/reminder-window.ts"))).toBe(
      false,
    );
  });

  test("the reminder is not a message that goes out on WhatsApp", () => {
    expect(MESSAGE_CATALOG.booking_reminder.whatsappEligible).toBe(false);
  });

  test("and the reminder email can still be switched off, as it always could", () => {
    expect(MESSAGE_CATALOG.booking_reminder.canDisable).toBe(true);
  });
});

describe("codeOnly", () => {
  test("drops line and block comments and keeps the code", () => {
    const source = [
      "// WhatsApp is not sent from here",
      "/* and neither is WhatsApp",
      "   here */",
      "const url = 'https://example.com'; // a WhatsApp mention",
      "sendEmail();",
    ].join("\n");
    const code = codeOnly(source);
    expect(code).not.toMatch(/whatsapp/i);
    expect(code).toContain("sendEmail();");
    expect(code).toContain("https://example.com");
  });
  test("still catches a real use of WhatsApp in code", () => {
    expect(codeOnly("import { send } from '@/lib/whatsapp/client';")).toMatch(
      /whatsapp/i,
    );
    expect(codeOnly("await sendWhatsAppReminder(b); // late")).toMatch(
      /whatsapp/i,
    );
  });
});
