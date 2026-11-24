import { describe, expect, it } from "bun:test";
import { REUSE_ORDER_MS, orderToReuse } from "./checkout-order";

const NOW = Date.parse("2026-11-24T18:00:00Z");
/** The order a checkout opened `ago` ms before NOW would carry. */
const orderAt = (ago: number) => String((NOW - ago) % 1e12).padStart(12, "0");

describe("orderToReuse", () => {
  it("reuses the order of a pending checkout opened within the window", () => {
    expect(
      orderToReuse(
        { payment_status: "pending", stripe_session_id: orderAt(60_000) },
        NOW,
      ),
    ).toBe(orderAt(60_000));
    expect(
      orderToReuse(
        {
          payment_status: "pending",
          stripe_session_id: orderAt(REUSE_ORDER_MS),
        },
        NOW,
      ),
    ).toBe(orderAt(REUSE_ORDER_MS));
  });

  it("opens a new one past the window, after a refusal, or with no order", () => {
    expect(
      orderToReuse(
        {
          payment_status: "pending",
          stripe_session_id: orderAt(REUSE_ORDER_MS + 1),
        },
        NOW,
      ),
    ).toBeNull();
    expect(
      orderToReuse(
        { payment_status: "failed", stripe_session_id: orderAt(60_000) },
        NOW,
      ),
    ).toBeNull();
    expect(
      orderToReuse({ payment_status: "pending", stripe_session_id: null }, NOW),
    ).toBeNull();
  });

  it("never reuses an order from the future or one that is not ours", () => {
    expect(
      orderToReuse(
        { payment_status: "pending", stripe_session_id: orderAt(-60_000) },
        NOW,
      ),
    ).toBeNull();
    expect(
      orderToReuse(
        { payment_status: "pending", stripe_session_id: "1234B5678901" },
        NOW,
      ),
    ).toBeNull();
  });
});
