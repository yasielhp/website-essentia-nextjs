export type BonusRow = {
  id: string;
  tierId: string;
  sessionsTotal: number;
  expiresAt: string;
};
export type BonusUse = { bonusId: string; status: string };

const USES_SESSION = new Set(["pending", "confirmed", "completed"]);

export function bonusBalance(bonus: BonusRow, uses: BonusUse[]) {
  const used = uses.filter(
    (u) => u.bonusId === bonus.id && USES_SESSION.has(u.status),
  ).length;
  return { used, remaining: Math.max(0, bonus.sessionsTotal - used) };
}

/** The bonus a new booking for `tierId` should draw from, or null. */
export function usableBonus(
  bonuses: BonusRow[],
  uses: BonusUse[],
  tierId: string,
  today: string,
): BonusRow | null {
  return (
    bonuses
      .filter(
        (b) =>
          b.tierId === tierId &&
          b.expiresAt >= today &&
          bonusBalance(b, uses).remaining > 0,
      )
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0] ?? null
  );
}
