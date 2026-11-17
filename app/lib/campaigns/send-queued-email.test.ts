import { describe, expect, test } from "bun:test";
import { sendQueued } from "./dispatch";
import { campaign, memoryDb, row, SOURCES } from "./whatsapp-fixtures";

// Only rows that cannot be mailed are used here: a row with an address would
// reach Resend, and these tests must never send anything.
describe("sendQueued on the email channel", () => {
  const emailCampaign = () =>
    campaign({
      channel: "email",
      content: {
        en: { subject: "Hi", preheader: "", title: "", doc: null },
        es: { subject: "Hola", preheader: "", title: "", doc: null },
        whatsapp: { templateId: null, params: SOURCES },
      } as never,
    });

  test("a row with no email fails as skipped, without trying to mail it", async () => {
    // The CHECK on the table allows a row with only a phone.
    const rows = [row(1, { email: null }), row(2, { email: null })];
    const mem = memoryDb(rows);
    const result = await sendQueued(emailCampaign(), rows, { db: mem.db });
    expect(result).toEqual({
      sent: 0,
      failed: 2,
      lastError: "[skipped] no_email",
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("[skipped] no_email");
    expect(mem.error("row-2")).toBe("[skipped] no_email");
  });

  test("an empty queue is a no-op", async () => {
    const mem = memoryDb([]);
    expect(await sendQueued(emailCampaign(), [], { db: mem.db })).toEqual({
      sent: 0,
      failed: 0,
      lastError: null,
    });
    expect(mem.writes).toHaveLength(0);
  });
});
