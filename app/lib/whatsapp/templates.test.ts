import { describe, expect, test } from "bun:test";
import {
  hasDynamicUrlButton,
  countParams,
  paramIssues,
  renderPreview,
  templateStatusFromEvent,
  templateSupport,
} from "@/lib/whatsapp/templates";

describe("countParams", () => {
  test("counts the highest placeholder", () => {
    expect(countParams("Hola {{1}}, tu cita es el {{2}} a las {{3}}.")).toBe(3);
  });
  test("zero when there are none", () => {
    expect(countParams("Sin parámetros")).toBe(0);
  });
  test("an empty body has none", () => {
    expect(countParams("")).toBe(0);
  });
  test("a repeated index counts once", () => {
    expect(countParams("{{1}} y {{1}}")).toBe(1);
  });
  test("is the highest index, not how many there are", () => {
    expect(countParams("a {{3}} b")).toBe(3);
  });
  test("ignores malformed placeholders", () => {
    expect(countParams("a {{0}} {{01}} {{ 1 }} {{abc}} b")).toBe(0);
  });
  test("ignores anything above 50, so the int column never overflows", () => {
    expect(countParams("a {{51}} b")).toBe(0);
    expect(countParams("a {{99999999999999999999}} b")).toBe(0);
    expect(countParams("a {{50}} b")).toBe(50);
  });
});

describe("paramIssues", () => {
  test("placeholders must run 1..n with no gaps", () => {
    expect(paramIssues("Hola {{1}} y {{3}}, hasta pronto.")).toEqual([
      "paramGap",
    ]);
  });
  test("a body that starts or ends with a placeholder is refused by Meta", () => {
    expect(paramIssues("{{1}} te espera")).toEqual(["paramAtEdge"]);
    expect(paramIssues("Te espera {{1}}")).toEqual(["paramAtEdge"]);
  });
  test("whitespace around the edge does not hide the placeholder", () => {
    expect(paramIssues("  {{1}} hola")).toEqual(["paramAtEdge"]);
    expect(paramIssues("hola {{1}}\n\n")).toEqual(["paramAtEdge"]);
  });
  test("a placeholder followed by punctuation is not at the edge", () => {
    expect(paramIssues("hola {{1}}.")).toEqual([]);
  });
  test("clean body has no issues", () => {
    expect(paramIssues("Hola {{1}}, hasta pronto.")).toEqual([]);
  });
  test("a gap and an edge are both reported", () => {
    expect(paramIssues("Hola {{1}} y {{3}}")).toEqual([
      "paramGap",
      "paramAtEdge",
    ]);
  });
  test("an empty body has no issues", () => {
    expect(paramIssues("")).toEqual([]);
  });
  test("a repeated index is not a gap", () => {
    expect(paramIssues("Hola {{1}} y otra vez {{1}}, adiós.")).toEqual([]);
  });
  test("anything that is not exactly {{n}} with n in 1..50 is malformed", () => {
    for (const bad of [
      "{{0}}",
      "{{01}}",
      "{{ 1 }}",
      "{{abc}}",
      "{{}}",
      "{{51}}",
      "{{-1}}",
      "{{1.5}}",
      "{{99999999999999999999}}",
    ]) {
      expect(paramIssues(`Hola ${bad}, adiós.`)).toEqual(["paramMalformed"]);
    }
  });
  test("a malformed placeholder does not also raise a gap", () => {
    expect(paramIssues("Hola {{1}} y {{0}}, adiós.")).toEqual([
      "paramMalformed",
    ]);
  });
  test("both bounds are valid", () => {
    expect(paramIssues("a {{1}} b")).toEqual([]);
    expect(paramIssues("a {{50}} b")).not.toContain("paramMalformed");
  });
});

describe("renderPreview", () => {
  test("fills placeholders in order and leaves missing ones visible", () => {
    expect(renderPreview("Hola {{1}}, {{2}}.", ["Ana"])).toBe(
      "Hola Ana, {{2}}.",
    );
  });
  test("treats $ in a value literally", () => {
    expect(renderPreview("a {{1}} b", ["$&"])).toBe("a $& b");
    expect(renderPreview("a {{1}} b", ["$1"])).toBe("a $1 b");
    expect(renderPreview("a {{1}} b", ["$$"])).toBe("a $$ b");
  });
  test("fills the same index every time it appears", () => {
    expect(renderPreview("{{1}} y {{1}}", ["Ana"])).toBe("Ana y Ana");
  });
  test("an empty value keeps the placeholder, a blank one is filled", () => {
    expect(renderPreview("a {{1}} b", [""])).toBe("a {{1}} b");
    expect(renderPreview("a {{1}} b", ["  "])).toBe("a    b");
  });
  test("a value that looks like a placeholder is not expanded again", () => {
    expect(renderPreview("a {{1}} b {{2}}", ["{{2}}", "Luis"])).toBe(
      "a {{2}} b Luis",
    );
  });
  test("leaves malformed placeholders alone", () => {
    expect(renderPreview("a {{0}} {{ 1 }} {{abc}} b", ["x"])).toBe(
      "a {{0}} {{ 1 }} {{abc}} b",
    );
  });
});

describe("hasDynamicUrlButton", () => {
  const button = (url: string) => ({ type: "URL" as const, text: "Ver", url });
  test("a URL button whose address has a placeholder needs a value", () => {
    expect(
      hasDynamicUrlButton({ buttons: [button("https://x.test/{{1}}")] }),
    ).toBe(true);
  });
  test("a fixed address, a quick reply and no buttons need nothing", () => {
    expect(hasDynamicUrlButton({ buttons: [button("https://x.test/")] })).toBe(
      false,
    );
    expect(
      hasDynamicUrlButton({ buttons: [{ type: "QUICK_REPLY", text: "Vale" }] }),
    ).toBe(false);
    expect(hasDynamicUrlButton({ buttons: [] })).toBe(false);
  });
  test("a template read without its buttons is not judged by them", () => {
    expect(hasDynamicUrlButton({ buttons: undefined as never })).toBe(false);
  });
});

describe("templateSupport", () => {
  const base = {
    headerFormat: null,
    headerText: null,
    body: "Hola {{1}}, gracias por venir.",
    unsupportedButtons: [],
  };

  test("a plain template can be sent", () => {
    expect(templateSupport(base)).toBeNull();
  });

  test("a text header and URL/quick-reply buttons can be sent", () => {
    expect(
      templateSupport({ ...base, headerFormat: "TEXT", headerText: "Tu cita" }),
    ).toBeNull();
  });

  test.each(["IMAGE", "VIDEO", "DOCUMENT", "LOCATION"])(
    "a %s header is media_header",
    (headerFormat) => {
      expect(templateSupport({ ...base, headerFormat })).toBe("media_header");
    },
  );

  test("a text header with a variable is header_variable", () => {
    expect(
      templateSupport({
        ...base,
        headerFormat: "TEXT",
        headerText: "Hola {{1}}",
      }),
    ).toBe("header_variable");
  });

  test("named parameters in the body are named_params", () => {
    expect(
      templateSupport({ ...base, body: "Hola {{first_name}}, bienvenido." }),
    ).toBe("named_params");
  });

  test("a button that is neither URL nor quick reply is button_type", () => {
    expect(
      templateSupport({ ...base, unsupportedButtons: ["PHONE_NUMBER"] }),
    ).toBe("button_type");
  });

  test("the first reason wins: media before variables before buttons", () => {
    expect(
      templateSupport({
        headerFormat: "IMAGE",
        headerText: null,
        body: "Hola {{nombre}}",
        unsupportedButtons: ["COPY_CODE"],
      }),
    ).toBe("media_header");
  });
});

describe("templateStatusFromEvent", () => {
  test("Meta's own states pass through unchanged", () => {
    for (const event of [
      "APPROVED",
      "REJECTED",
      "PENDING",
      "PAUSED",
      "DISABLED",
      "FLAGGED",
      "IN_APPEAL",
      "PENDING_DELETION",
      "DELETED",
      "LIMIT_EXCEEDED",
      "ARCHIVED",
      "LOCKED",
    ]) {
      expect(templateStatusFromEvent(event)).toBe(event as never);
    }
  });
  test("REINSTATED means the template can be sent again", () => {
    expect(templateStatusFromEvent("REINSTATED")).toBe("APPROVED");
  });
  test("an unknown event is not mapped", () => {
    expect(templateStatusFromEvent("SOMETHING_NEW")).toBeNull();
    expect(templateStatusFromEvent("approved")).toBeNull();
    expect(templateStatusFromEvent("draft")).toBeNull();
    expect(templateStatusFromEvent("")).toBeNull();
    expect(templateStatusFromEvent(undefined)).toBeNull();
    expect(templateStatusFromEvent(42)).toBeNull();
  });
});
