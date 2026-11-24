import { describe, expect, test } from "bun:test";
import {
  haltMessage,
  haltMessageIn,
  parseHalted,
  parseLocaleHalt,
} from "./error-markers";
import { haltDecision, heldLocale } from "./language-halt";

const BOTH = { language: "any" as const };
const SPANISH = { language: "es" as const };
const NO_TRANSLATION =
  "132001: Template name does not exist in the translation";
const EXPIRED = "190: Access token expired";

describe("the marker of one language stopped", () => {
  test("names the language right after the prefix, where Meta's text cannot put it", () => {
    expect(haltMessageIn("en", NO_TRANSLATION)).toBe(
      `[halted] (en) ${NO_TRANSLATION}`,
    );
  });

  test("is read back as its language and its reason", () => {
    expect(parseLocaleHalt(haltMessageIn("es", EXPIRED))).toEqual({
      locale: "es",
      reason: EXPIRED,
    });
    expect(parseLocaleHalt(haltMessage(EXPIRED))).toBeNull();
    expect(parseLocaleHalt("template_unavailable: x (en)")).toBeNull();
    expect(parseLocaleHalt(null)).toBeNull();
  });

  test("Meta's own words ending in a language are not taken for one", () => {
    expect(parseLocaleHalt(haltMessage("132001: missing in (en)"))).toBeNull();
  });

  test("parseHalted still gives the bare reason of either marker", () => {
    expect(parseHalted(haltMessageIn("en", NO_TRANSLATION))).toBe(
      NO_TRANSLATION,
    );
    expect(parseHalted(haltMessage(EXPIRED))).toBe(EXPIRED);
  });
});

describe("heldLocale", () => {
  test("is the language a campaign in two holds", () => {
    expect(heldLocale(BOTH, haltMessageIn("en", NO_TRANSLATION))).toBe("en");
  });

  test("is none for a campaign in one language, or with nothing held", () => {
    expect(heldLocale(SPANISH, haltMessageIn("es", EXPIRED))).toBeNull();
    expect(heldLocale(BOTH, haltMessage(EXPIRED))).toBeNull();
    expect(heldLocale(BOTH, "190: Access token expired")).toBeNull();
    expect(heldLocale(BOTH, null)).toBeNull();
  });
});

describe("haltDecision", () => {
  test("nothing stopped and nothing held: nothing to do", () => {
    expect(haltDecision(BOTH, null, [])).toBeNull();
    expect(haltDecision(BOTH, "some Meta text", [])).toBeNull();
  });

  test("in two languages, the English template refused while Spanish goes out: English is held, the campaign goes on", () => {
    expect(
      haltDecision(BOTH, null, [{ locale: "en", reason: NO_TRANSLATION }]),
    ).toEqual({
      all: false,
      marker: `[halted] (en) ${NO_TRANSLATION}`,
      reason: NO_TRANSLATION,
      locale: "en",
    });
  });

  test("a hold found on the campaign lasts while nothing new is stopped", () => {
    expect(haltDecision(BOTH, haltMessageIn("en", NO_TRANSLATION), [])).toEqual(
      {
        all: false,
        marker: `[halted] (en) ${NO_TRANSLATION}`,
        reason: NO_TRANSLATION,
        locale: "en",
      },
    );
  });

  test("English held and now Spanish stopped for another reason: the whole campaign stops, naming Spanish", () => {
    expect(
      haltDecision(BOTH, haltMessageIn("en", NO_TRANSLATION), [
        { locale: "es", reason: EXPIRED },
      ]),
    ).toEqual({
      all: true,
      marker: `[halted] (es) ${EXPIRED}`,
      reason: EXPIRED,
      locale: "es",
    });
  });

  test("both stopped for the same reason is the account, not a template: no language named", () => {
    expect(
      haltDecision(BOTH, null, [
        { locale: "es", reason: EXPIRED },
        { locale: "en", reason: EXPIRED },
      ]),
    ).toEqual({
      all: true,
      marker: `[halted] ${EXPIRED}`,
      reason: EXPIRED,
      locale: null,
    });
    expect(
      haltDecision(BOTH, haltMessageIn("en", EXPIRED), [
        { locale: "es", reason: EXPIRED },
      ]),
    ).toMatchObject({ all: true, marker: `[halted] ${EXPIRED}` });
  });

  test("a campaign in one language stops whole, with the marker it always had", () => {
    expect(
      haltDecision(SPANISH, null, [{ locale: "es", reason: EXPIRED }]),
    ).toEqual({
      all: true,
      marker: `[halted] ${EXPIRED}`,
      reason: EXPIRED,
      locale: null,
    });
  });

  test("a stop in a language the campaign is not written in is ignored", () => {
    expect(
      haltDecision(SPANISH, null, [{ locale: "en", reason: EXPIRED }]),
    ).toBeNull();
  });
});
