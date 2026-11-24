import { describe, expect, test } from "bun:test";
import {
  cardLines,
  cardMeta,
  cardPrice,
  minutesOf,
  priceOf,
  priceText,
  toTierPrices,
} from "@/lib/treatments/prices";

// The space before the euro sign is the one the locale puts there (a no-break
// space), so the number and its sign never end up on two lines.
const plain = (text: string) => text.replace(/ /g, " ");

const tier = (
  label: string,
  durationMinutes: number | null,
  priceEur: number,
) => ({
  label,
  durationMinutes,
  priceEur,
});

describe("toTierPrices: what a session type costs, as the booking form shows it", () => {
  test("the centre's price, which is the one the form's own list shows", () => {
    expect(
      toTierPrices([
        {
          label: "Espira",
          duration_minutes: 30,
          price_eur: 63,
          price_center_eur: 70,
        },
      ]),
    ).toEqual([tier("Espira", 30, 70)]);
  });

  test("the web price when the centre's is not set", () => {
    expect(
      toTierPrices([
        {
          label: "Pulse",
          duration_minutes: 45,
          price_eur: 85,
          price_center_eur: null,
        },
      ]),
    ).toEqual([tier("Pulse", 45, 85)]);
  });

  test("the database hands numerics over as text: they are read as numbers", () => {
    expect(
      toTierPrices([
        {
          label: "Soma",
          duration_minutes: "60",
          price_eur: "140.00",
          price_center_eur: "140.00",
        },
      ]),
    ).toEqual([tier("Soma", 60, 140)]);
  });

  test("a session type with no length keeps its price and says it has none", () => {
    for (const duration_minutes of [null, undefined, 0, -30, "soon", 45.5]) {
      expect(
        toTierPrices([{ label: "Soma", duration_minutes, price_eur: 140 }]),
      ).toEqual([tier("Soma", null, 140)]);
    }
  });

  test("a session type with no name, or no price to show, is left out", () => {
    expect(
      toTierPrices([
        { label: null, price_eur: 70, price_center_eur: 70 },
        { label: "  ", price_eur: 70, price_center_eur: 70 },
        { label: "Sin precio", price_eur: null, price_center_eur: null },
        { label: "Cero", price_eur: 0, price_center_eur: 0 },
        { label: "Negativo", price_eur: -5, price_center_eur: null },
        { label: "Texto", price_eur: "abc", price_center_eur: null },
      ]),
    ).toEqual([]);
  });

  test("what is not a list of rows is no prices at all", () => {
    for (const rows of [null, undefined, "rows", 42, {}]) {
      expect(toTierPrices(rows)).toEqual([]);
    }
    expect(toTierPrices([null, "row", 7])).toEqual([]);
  });
});

describe("minutesOf: the length a card states", () => {
  test("'30 min' is thirty minutes, however it is spaced or cased", () => {
    expect(minutesOf("30 min")).toBe(30);
    expect(minutesOf(" 120 MIN ")).toBe(120);
    expect(minutesOf("45min")).toBe(45);
  });

  test("anything that is not one plain length is not guessed at", () => {
    for (const text of ["", "min", "45–60 min", "1 h", "First session", "60"]) {
      expect(minutesOf(text)).toBeNull();
    }
  });
});

describe("priceOf: the session type with the treatment's name AND the card's length", () => {
  const PRICES = [
    tier("Espira", 30, 70),
    tier("Drenaje Linfático Avanzado", 50, 100),
    tier("Soma", 60, 140),
    tier("Soma", 90, 190),
  ];

  test("found by name, as a tier meets its treatment everywhere else, and by length", () => {
    expect(priceOf(PRICES, "Espira", 30)).toBe(70);
    expect(priceOf(PRICES, "  drenaje linfático avanzado ", 50)).toBe(100);
  });

  test("a treatment sold in two lengths gets the price of the length on the card", () => {
    expect(priceOf(PRICES, "Soma", 60)).toBe(140);
    expect(priceOf(PRICES, "Soma", 90)).toBe(190);
  });

  test("a length nobody sells has no price, even if the name is on sale in another", () => {
    // The card says 45 min and the session type lasts 30: that 70 € is the
    // price of something else.
    expect(priceOf(PRICES, "Espira", 45)).toBeNull();
    expect(priceOf(PRICES, "Soma", 75)).toBeNull();
  });

  test("a treatment with no session type on sale has no price", () => {
    expect(priceOf(PRICES, "Alure Duo", 50)).toBeNull();
    expect(priceOf([], "Espira", 30)).toBeNull();
  });

  test("two session types with one name and one length agree on the price, or there is none to show", () => {
    expect(
      priceOf([tier("Espira", 30, 70), tier("espira", 30, 70)], "Espira", 30),
    ).toBe(70);
    expect(
      priceOf([tier("Espira", 30, 70), tier("Espira", 30, 90)], "Espira", 30),
    ).toBeNull();
  });

  test("a card that states no length takes the one price its name has", () => {
    expect(priceOf(PRICES, "Espira", null)).toBe(70);
  });

  test("and none when the name has several: the site has no 'from' price to say it with", () => {
    expect(priceOf(PRICES, "Soma", null)).toBeNull();
  });
});

describe("cardPrice: written as the facial cards always wrote theirs", () => {
  test("whole euros carry no decimals: '70 €' in Spanish, '€70' in English", () => {
    expect(plain(cardPrice(70, "es"))).toBe("70 €");
    expect(cardPrice(70, "en")).toBe("€70");
    expect(plain(cardPrice(350, "es"))).toBe("350 €");
  });

  test("a price with cents keeps both of them", () => {
    expect(plain(cardPrice(72.5, "es"))).toBe("72,50 €");
    expect(cardPrice(72.5, "en")).toBe("€72.50");
  });
});

describe("cardMeta: the line under a card's title", () => {
  const PRICES = [
    tier("Espira", 30, 70),
    tier("Soma", 60, 140),
    tier("Soma", 90, 190),
  ];
  const meta = (
    title: string,
    durations: string[],
    locale: "es" | "en" = "es",
  ) => plain(cardMeta(PRICES, title, durations, locale));

  test("the length, then its price, with the separator the cards already use", () => {
    expect(meta("Espira", ["30 min"])).toBe("30 min · 70 €");
    expect(meta("Espira", ["30 min"], "en")).toBe("30 min · €70");
  });

  test("before the prices arrive, and if they never do, it is the line it always was", () => {
    expect(plain(cardMeta([], "Espira", ["30 min"], "es"))).toBe("30 min");
  });

  test("a treatment that is not on sale, or not in that length, shows its length alone", () => {
    expect(meta("Alure Duo", ["50 min"])).toBe("50 min");
    expect(meta("Espira", ["45 min"])).toBe("45 min");
  });

  test("each length of a card is followed by its own price", () => {
    expect(meta("Soma", ["60 min", "90 min"])).toBe(
      "60 min · 140 € · 90 min · 190 €",
    );
    expect(meta("Soma", ["60 min", "75 min"])).toBe("60 min · 140 € · 75 min");
  });

  test("a card with no length shows the price alone, or nothing", () => {
    expect(meta("Espira", [])).toBe("70 €");
    expect(meta("Soma", [])).toBe("");
    expect(meta("Alure Duo", [])).toBe("");
  });
});

describe("priceText: what a treatment costs, for a list read by an assistant", () => {
  const PRICES = [
    tier("Espira", 30, 70),
    tier("Soma", 60, 140),
    tier("Soma", 90, 190),
  ];

  test("one length, one price", () => {
    expect(priceText(PRICES, "Espira", ["30 min"], "en")).toBe("€70");
    expect(plain(priceText(PRICES, "Espira", ["30 min"], "es"))).toBe("70 €");
  });

  test("several lengths say which price is whose", () => {
    expect(priceText(PRICES, "Soma", ["60 min", "90 min"], "en")).toBe(
      "60 min: €140, 90 min: €190",
    );
    expect(priceText(PRICES, "Soma", ["60 min", "75 min"], "en")).toBe(
      "60 min: €140",
    );
  });

  test("not on sale, or not in that length, is no text at all", () => {
    expect(priceText(PRICES, "Alure Duo", ["50 min"], "en")).toBe("");
    expect(priceText(PRICES, "Espira", ["45 min"], "en")).toBe("");
    expect(priceText([], "Espira", ["30 min"], "en")).toBe("");
  });

  test("a treatment with no length takes the one price its name has", () => {
    expect(priceText(PRICES, "Espira", [], "en")).toBe("€70");
    expect(priceText(PRICES, "Soma", [], "en")).toBe("");
  });
});

describe("cardLines: the line of every card of a page, made on the server", () => {
  const PRICES = [tier("Espira", 30, 70), tier("Anesis", 50, 70)];
  const TREATMENTS = [
    { id: "espira", title: "Espira", durations: ["30 min"] },
    { id: "alure-duo", title: "Alure Duo", durations: ["50 min"] },
    // A ritual with no length of its own prints the line written for it.
    { id: "kinea-signature", title: "Kinéa Signature" },
  ];
  const lines = (prices = PRICES, locale: "es" | "en" = "es") =>
    Object.fromEntries(
      Object.entries(cardLines(TREATMENTS, prices, locale)).map(
        ([id, line]) => [id, plain(line)],
      ),
    );

  test("each card that shows a length gets its line, priced or not", () => {
    expect(lines()).toEqual({ espira: "30 min · 70 €", "alure-duo": "50 min" });
    expect(lines(PRICES, "en")).toEqual({
      espira: "30 min · €70",
      "alure-duo": "50 min",
    });
  });

  test("with no prices every line is the length alone, as the cards always were", () => {
    expect(lines([])).toEqual({ espira: "30 min", "alure-duo": "50 min" });
  });

  test("a card with no length is not given a line: it keeps its own", () => {
    expect("kinea-signature" in lines()).toBe(false);
  });
});
