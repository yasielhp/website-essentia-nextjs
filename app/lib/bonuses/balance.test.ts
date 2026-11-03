import { describe, expect, it } from "bun:test";
import {
  bonusBalance,
  usableBonus,
  type BonusRow,
  type BonusUse,
} from "./balance";

const bonus: BonusRow = {
  id: "b1",
  tierId: "t1",
  sessionsTotal: 5,
  expiresAt: "2027-05-01",
};
const use = (status: string): BonusUse => ({ bonusId: "b1", status });

describe("bonusBalance", () => {
  it("counts pending, confirmed and completed bookings as used", () => {
    expect(
      bonusBalance(bonus, [use("confirmed"), use("pending"), use("completed")])
        .used,
    ).toBe(3);
  });
  it("ignores cancelled and draft bookings", () => {
    expect(bonusBalance(bonus, [use("cancelled"), use("draft")]).used).toBe(0);
  });
  it("remaining never goes below zero", () => {
    expect(bonusBalance(bonus, Array(7).fill(use("confirmed"))).remaining).toBe(
      0,
    );
  });
});

describe("usableBonus", () => {
  const today = "2026-12-01";
  it("picks the bonus for the tier with sessions left and not expired", () => {
    expect(usableBonus([bonus], [], "t1", today)?.id).toBe("b1");
  });
  it("refuses an expired bonus", () => {
    expect(
      usableBonus([{ ...bonus, expiresAt: "2026-11-30" }], [], "t1", today),
    ).toBeNull();
  });
  it("refuses a bonus for another tier", () => {
    expect(usableBonus([bonus], [], "t2", today)).toBeNull();
  });
  it("prefers the one expiring first", () => {
    const later = { ...bonus, id: "b2", expiresAt: "2027-12-01" };
    expect(usableBonus([later, bonus], [], "t1", today)?.id).toBe("b1");
  });
});
