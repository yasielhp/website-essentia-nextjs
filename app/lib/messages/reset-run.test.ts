import { describe, expect, test } from "bun:test";
import { runReset } from "./reset-run";

describe("what a reset answers with, as the page needs to say it", () => {
  test("a reset that worked: which notice, and that the page may leave", async () => {
    expect(
      await runReset("email", async () => ({
        ok: true,
        removed: true,
        kept: null,
      })),
    ).toEqual({ status: "done", notice: "done" });
    expect(
      await runReset("email", async () => ({
        ok: true,
        removed: false,
        kept: null,
      })),
    ).toEqual({ status: "done", notice: "nothing" });
    expect(
      await runReset("email", async () => ({
        ok: true,
        removed: false,
        kept: "disabled",
      })),
    ).toEqual({ status: "done", notice: "keptDisabled" });
  });

  test("on WhatsApp the notice is that it was removed, whatever else the answer says", async () => {
    expect(
      await runReset("whatsapp", async () => ({
        ok: true,
        removed: false,
        kept: null,
      })),
    ).toEqual({ status: "done", notice: "whatsappRemoved" });
  });

  test("a refusal keeps the dialog open with what the action said, to try again", async () => {
    expect(
      await runReset("email", async () => ({ ok: false, error: "db" })),
    ).toEqual({ status: "failed", failure: { error: "db" } });
    expect(
      await runReset("email", async () => ({
        ok: false,
        error: "meta",
        detail: "x",
      })),
    ).toEqual({ status: "failed", failure: { error: "meta", detail: "x" } });
  });

  test("a call that throws is a failure too, never an unhandled one", async () => {
    expect(
      await runReset("email", async () => {
        throw new Error("network");
      }),
    ).toEqual({ status: "failed", failure: { error: "generic" } });
  });
});
