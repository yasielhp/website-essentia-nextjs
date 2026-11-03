/**
 * The buyer's details, kept in the browser while a bonus is being bought.
 *
 * Only who the buyer is — name, email, phone — so a page reload, or a return
 * from the bank, does not make them type it again. Never the plan's price,
 * never the acceptance of the terms and nothing about the payment. The `:v1` is
 * the shape's version: change the shape, bump it, and an old draft is simply
 * not found.
 */
const STORAGE_KEY = "essentia_bonus_buyer:v1";

export type BuyerDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export const EMPTY_BUYER: BuyerDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

/** A stored draft read defensively: anything that is not a short string is dropped. */
export function parseBuyer(raw: string | null): BuyerDraft {
  if (!raw) return EMPTY_BUYER;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const text = (key: keyof BuyerDraft, max: number) =>
      typeof value[key] === "string"
        ? (value[key] as string).slice(0, max)
        : "";
    return {
      firstName: text("firstName", 80),
      lastName: text("lastName", 80),
      email: text("email", 160),
      phone: text("phone", 30),
    };
  } catch {
    return EMPTY_BUYER;
  }
}

export function readBuyer(): BuyerDraft {
  try {
    return parseBuyer(localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_BUYER;
  }
}

export function writeBuyer(buyer: BuyerDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buyer));
  } catch {}
}

export function clearBuyer(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
