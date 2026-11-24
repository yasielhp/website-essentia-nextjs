import { describe, expect, it } from "bun:test";
import { classifyRedsysNotification } from "./redsys-notification";

describe("classifyRedsysNotification", () => {
  it("reads an authorised payment (type 0, 0000–0099) as paid", () => {
    for (const response of ["0000", "0001", "0099", "99"]) {
      expect(
        classifyRedsysNotification({
          Ds_TransactionType: "0",
          Ds_Response: response,
        }),
      ).toEqual({ kind: "paid" });
    }
  });

  it("reads a refused authorisation as declined, with its code", () => {
    expect(
      classifyRedsysNotification({
        Ds_TransactionType: "0",
        Ds_Response: "0190",
      }),
    ).toEqual({ kind: "declined", response: "0190" });
    expect(
      classifyRedsysNotification({
        Ds_TransactionType: "0",
        Ds_Response: "9915",
      }),
    ).toEqual({ kind: "declined", response: "9915" });
  });

  it("ignores a refund (type 3, 0900): it is never a declined payment", () => {
    expect(
      classifyRedsysNotification({
        Ds_TransactionType: "3",
        Ds_Response: "0900",
      }),
    ).toEqual({
      kind: "ignored",
      reason: "not_an_authorisation",
      transactionType: "3",
      response: "0900",
    });
  });

  it("ignores a refund that was refused (type 3, 0950) too", () => {
    expect(
      classifyRedsysNotification({
        Ds_TransactionType: "3",
        Ds_Response: "0950",
      }).kind,
    ).toBe("ignored");
  });

  it("ignores every other operation on the order", () => {
    for (const type of ["1", "2", "9", "O", "P", "Q"]) {
      expect(
        classifyRedsysNotification({
          Ds_TransactionType: type,
          Ds_Response: "0000",
        }).kind,
      ).toBe("ignored");
    }
  });

  it("ignores 0900 and 0400 even when the type is missing", () => {
    expect(classifyRedsysNotification({ Ds_Response: "0900" })).toMatchObject({
      kind: "ignored",
      reason: "refund_or_cancellation",
    });
    expect(classifyRedsysNotification({ Ds_Response: "0400" })).toMatchObject({
      kind: "ignored",
      reason: "refund_or_cancellation",
    });
  });

  it("still reads a payment whose notification does not state its type", () => {
    expect(classifyRedsysNotification({ Ds_Response: "0000" })).toEqual({
      kind: "paid",
    });
  });

  it("reads a notification with no response code as declined, never as paid", () => {
    expect(classifyRedsysNotification({ Ds_TransactionType: "0" })).toEqual({
      kind: "declined",
      response: "",
    });
  });
});
