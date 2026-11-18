import { describe, expect, test } from "bun:test";
import { clientWasNotified } from "./notify-outcome";

describe("clientWasNotified", () => {
  test("only a send the provider took is the client being told", () => {
    expect(clientWasNotified("sent")).toBe(true);
    expect(clientWasNotified("skipped")).toBe(false);
    expect(clientWasNotified("failed")).toBe(false);
  });
});
