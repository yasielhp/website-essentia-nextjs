/**
 * A session type being edited, and every way the modal changes it.
 *
 * The three prices move together: a centre price and a discount give the web
 * price, and typing the web price back-solves the discount. That arithmetic
 * lives here, away from the markup that shows it.
 */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The web price is the centre price minus the online discount.
 *
 * The percentage is not stored: it is whatever the two prices say, so the
 * discount shown on the website can never disagree with what is charged.
 */
function webFromCentre(centre: string, discount: string): string {
  const c = parseFloat(centre);
  const d = parseFloat(discount);
  if (!isFinite(c) || !isFinite(d)) return "";
  return String(round2(c * (1 - d / 100)));
}

export function discountFromPrices(centre: string, web: string): string {
  const c = parseFloat(centre);
  const w = parseFloat(web);
  if (!isFinite(c) || !isFinite(w) || c <= 0) return "";
  return String(round2((1 - w / c) * 100));
}

// ─── Form state reducer ───────────────────────────────────────

export type FormState = {
  duration: string;
  priceWeb: string;
  priceCenter: string;
  priceSuite: string;
  /** Percentage off the centre price for booking online. */
  discount: string;
  color: string;
  active: boolean;
};

export type FormAction =
  | { type: "SET_DURATION"; duration: string }
  | { type: "SET_PRICE_WEB"; price: string }
  | { type: "SET_PRICE_CENTER"; price: string }
  | { type: "SET_PRICE_SUITE"; price: string }
  | { type: "SET_DISCOUNT"; discount: string }
  | { type: "SET_COLOR"; color: string }
  | { type: "TOGGLE_ACTIVE" };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_DURATION":
      return { ...state, duration: action.duration };
    case "SET_PRICE_WEB":
      return {
        ...state,
        priceWeb: action.price,
        discount: discountFromPrices(state.priceCenter, action.price),
      };
    case "SET_PRICE_CENTER":
      return {
        ...state,
        priceCenter: action.price,
        // A discount already set is a rule, not a one-off: moving the centre
        // price moves the web price with it.
        priceWeb:
          state.discount !== ""
            ? webFromCentre(action.price, state.discount)
            : state.priceWeb,
      };
    case "SET_DISCOUNT":
      return {
        ...state,
        discount: action.discount,
        priceWeb:
          webFromCentre(state.priceCenter, action.discount) || state.priceWeb,
      };
    case "SET_PRICE_SUITE":
      return { ...state, priceSuite: action.price };
    case "SET_COLOR":
      return { ...state, color: action.color };
    case "TOGGLE_ACTIVE":
      return { ...state, active: !state.active };
    default:
      return state;
  }
}
