import { describe, expect, test } from "bun:test";
import { prepareTestSend } from "./whatsapp-test-send";
import { template } from "./whatsapp-fixtures";

describe("prepareTestSend", () => {
  test("sends the template with its own example values to the admin's number", () => {
    expect(prepareTestSend(template(), "es", "600 11 22 33")).toEqual({
      ok: true,
      to: "+34600112233",
      send: {
        to: "+34600112233",
        name: "reapertura",
        language: "es",
        bodyParams: ["Ana", "2 de diciembre"],
      },
    });
  });
  test("a profile with no usable number cannot receive a test", () => {
    for (const phone of [null, "", "12", "not a number"]) {
      expect(prepareTestSend(template(), "es", phone)).toEqual({
        ok: false,
        error: "no_phone",
      });
    }
  });
  test("a template that could not go out is not tested either", () => {
    expect(
      prepareTestSend(template({ status: "PENDING" }), "es", "600112233"),
    ).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_not_approved",
    });
    expect(prepareTestSend(null, "es", "600112233")).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_missing",
    });
    expect(
      prepareTestSend(template({ language: "en" }), "es", "600112233"),
    ).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_language",
    });
  });
  test("a missing example is a dash, as Meta refuses an empty parameter", () => {
    const send = prepareTestSend(
      template({ example_params: ["Ana"], param_count: 2 }),
      "es",
      "600112233",
    );
    expect(send.ok && send.send.bodyParams).toEqual(["Ana", "—"]);
  });
  test("extra examples are not sent", () => {
    const send = prepareTestSend(
      template({ example_params: ["a", "b", "c"], param_count: 2 }),
      "es",
      "600112233",
    );
    expect(send.ok && send.send.bodyParams).toEqual(["a", "b"]);
  });
  test("a template without parameters sends none", () => {
    const send = prepareTestSend(
      template({ example_params: [], param_count: 0 }),
      "es",
      "600112233",
    );
    expect(send.ok && send.send.bodyParams).toEqual([]);
  });
  test("an example the template stored oddly does not throw", () => {
    const send = prepareTestSend(
      template({
        example_params: [null, 7] as unknown as string[],
        param_count: 2,
      }),
      "es",
      "600112233",
    );
    expect(send.ok && send.send.bodyParams).toEqual(["—", "7"]);
  });
});
