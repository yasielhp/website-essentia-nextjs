export type BonusRow = {
  id: string;
  tierId: string;
  sessionsTotal: number;
  expiresAt: string;
};
/**
 * A booking that drew on a bonus. `status` is the booking's, or `lost` for a
 * cancelled session lost under the 24-hour rule (`useStatus` in
 * `cancellation.ts`), which the bonus counts as used.
 */
export type BonusUse = { bonusId: string; status: string };

/** The statuses that hold, or used up, one of the bonus's sessions. */
export const USES_SESSION = new Set([
  "pending",
  "confirmed",
  "completed",
  "lost",
]);

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
